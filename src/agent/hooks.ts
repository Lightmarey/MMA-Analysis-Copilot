import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { AgentToolName } from "./tools.js";
import type { WolframResponse } from "../wolfram/types.js";

export type AgentHookPhase = "after_plan" | "before_tool_call" | "after_tool_call" | "before_final";
export type AgentHookSeverity = "hint" | "warning" | "block";

export type AgentHookResult = {
  id: string;
  phase: AgentHookPhase;
  severity: AgentHookSeverity;
  message: string;
  promptHint?: string;
  traceTag?: string;
  evidence?: Record<string, unknown>;
};

export type ToolHistoryEntry = {
  name: AgentToolName;
  args: Record<string, unknown>;
  result?: WolframResponse;
};

export type AgentHookContext = {
  phase: AgentHookPhase;
  userMessage: string;
  planContext?: string;
  messages: ChatCompletionMessageParam[];
  toolHistory: ToolHistoryEntry[];
  proposedTool?: ToolHistoryEntry;
  latestTool?: ToolHistoryEntry;
  finalText?: string;
  firedHookIds: Set<string>;
};

type AgentHook = {
  id: string;
  phase: AgentHookPhase;
  run(context: AgentHookContext): AgentHookResult[];
};

const TRANSFORM_SIGNAL_RE = /\b(transform|transformation|rewrite|derive|reduce\s+to|equivalent|substitution|replace|normalize|ledger|side[-\s]?condition|proof[-\s]?(move|step|level)|formula\s+(identity|change|relation))\b|变换|改写|代换|等价|条件账本/i;
const SYMBOLIC_CLAIM_RE = /(?:==|=|\\=|\\equiv|\\sim|\\leq|\\geq|<=|>=|D\[|Integrate\[|Limit\[|Series\[|O\[[^\]]+\]\^\d|[A-Za-z][A-Za-z0-9]*\[[^\]]+\]\s*(?:==|=)|\$\$?[^$]*(?:=|\\leq|\\geq|\\sim)[^$]*\$\$?)/;
const ASSUMPTION_SIGNAL_RE = /\b(assume|assuming|provided|under|where|subject to|side[-\s]?conditions?|missing assumptions?|condition|conditions|hypothes[ei]s|let)\b|假设|条件|满足|其中/i;
const EQUIVALENCE_SIGNAL_RE = /\b(equivalent|equivalence|same as|before\/after|verify .*==|verify .*equiv|candidate|substitute|substitution|solved by)\b|等价|代入|候选/i;
const CASE_SPLIT_RE = /\b(case|cases|split|depending on|separate regimes|mutually exclusive)\b|分情形/i;
const DISPLAY_MATH_RE = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g;
const INLINE_MATH_RE = /\$([^$\n]{3,220})\$|\\\(([^)]{3,220})\\\)/g;

const hooks: AgentHook[] = [
  {
    id: "expression-candidate-hook",
    phase: "after_plan",
    run(context) {
      const candidates = extractFormulaCandidates(context.userMessage);
      if (!candidates.length) return [];
      return [{
        id: "expression-candidate-hook",
        phase: "after_plan",
        severity: "hint",
        traceTag: "expression-candidates",
        message: `Detected ${candidates.length} candidate formula fragment${candidates.length === 1 ? "" : "s"} in supplied text.`,
        evidence: { candidates },
        promptHint: `Hook hint: candidate formula fragments were detected in the supplied text: ${candidates.map(item => `"${item}"`).join("; ")}. Treat them as candidates only; choose explicit verification targets and state uncertainty instead of inventing missing formulas.`
      }];
    }
  },
  {
    id: "transform-ledger-hook",
    phase: "after_plan",
    run(context) {
      if (!TRANSFORM_SIGNAL_RE.test(`${context.userMessage}\n${context.planContext ?? ""}`)) return [];
      return [{
        id: "transform-ledger-hook",
        phase: "after_plan",
        severity: "hint",
        traceTag: "proof-transform-ledger",
        message: "A supplied formula transformation or side-condition ledger may benefit from proof_pattern_engine compile before concrete Wolfram checks.",
        evidence: buildTransformLedgerEvidence(context.userMessage),
        promptHint: [
          "Hook hint: if the task includes a supplied formula transformation, first identify source formula, target formula, bindings, side conditions, and missing assumptions.",
          "Then consider proof_pattern_engine with operation=compile to record the proof move before concrete Wolfram checks; its payload must be a Wolfram InputForm Association like <|\"moveName\" -> \"...\", \"steps\" -> {...}|>, not pseudo XML, JSON, or <Association[...]> syntax.",
          "This is optional guidance; verify explicit formulas with structured Wolfram tools when available."
        ].join(" ")
      }];
    }
  },
  {
    id: "assumption-ledger-hook",
    phase: "after_plan",
    run(context) {
      if (!ASSUMPTION_SIGNAL_RE.test(`${context.userMessage}\n${context.planContext ?? ""}`)) return [];
      const assumptions = extractAssumptionCandidates(context.userMessage);
      return [{
        id: "assumption-ledger-hook",
        phase: "after_plan",
        severity: "hint",
        traceTag: "assumption-ledger",
        message: "Track condition sources explicitly before concluding.",
        evidence: { candidates: assumptions },
        promptHint: [
          "Hook hint: maintain an assumption ledger with source labels Supplied, DerivedByWolfram, AssumedFromContext, NeedsUser, or GeneratedByParameterChoice.",
          assumptions.length ? `Candidate supplied conditions: ${assumptions.map(item => `"${item}"`).join("; ")}.` : "",
          "Do not turn analytic assumptions into Wolfram-verified facts."
        ].filter(Boolean).join(" ")
      }];
    }
  },
  {
    id: "equivalence-check-hook",
    phase: "after_plan",
    run(context) {
      if (!EQUIVALENCE_SIGNAL_RE.test(context.userMessage)) return [];
      return [{
        id: "equivalence-check-hook",
        phase: "after_plan",
        severity: "hint",
        traceTag: "equivalence-check-opportunity",
        message: "An explicit before/after expression or candidate substitution may be best checked by wolfram_equivalence_check.",
        promptHint: "Hook hint: when a candidate result or before/after formula is already supplied, use wolfram_equivalence_check on the explicit lhs and rhs before considering wolfram_solve. Do not solve or reduce the original equation from scratch unless the candidate itself is missing or the equivalence check fails."
      }];
    }
  },
  {
    id: "case-split-hook",
    phase: "after_plan",
    run(context) {
      if (!CASE_SPLIT_RE.test(context.userMessage)) return [];
      return [{
        id: "case-split-hook",
        phase: "after_plan",
        severity: "hint",
        traceTag: "case-split-ledger",
        message: "A case split may need coverage, mutual exclusion, and per-case verification targets.",
        promptHint: "Hook hint: if using cases, list each case hypothesis, its target, whether cases are mutually exclusive, and whether their union covers the stated parameter domain. Use Wolfram only for explicit coverage or per-case symbolic checks."
      }];
    }
  },
  {
    id: "tool-loop-guard",
    phase: "after_tool_call",
    run(context) {
      if (context.firedHookIds.has("tool-loop-guard")) return [];
      const latest = context.latestTool;
      if (!latest?.result?.ok) return [];
      if (!isVerificationTool(latest.name)) return [];
      const output = String(latest.result.output ?? "").replace(/\s+/g, " ").trim();
      if (!/^(True|0|\{(?:True|0)(?:,\s*(?:True|0))*\})$/.test(output)) return [];
      if (context.toolHistory.length < 2) return [];
      return [{
        id: "tool-loop-guard",
        phase: "after_tool_call",
        severity: "hint",
        traceTag: "verified-check-convergence",
        message: `${latest.name} returned a compact successful verification result.`,
        promptHint: "Hook hint: a structured verification just returned True, 0, or a compact list of successful checks. If the requested explicit targets are covered, summarize now instead of adding confirmatory tool calls."
      }];
    }
  },
  {
    id: "tool-loop-guard",
    phase: "before_tool_call",
    run(context) {
      const proposed = context.proposedTool;
      if (!proposed) return [];
      if (proposed.name === "proof_pattern_engine" && readString(proposed.args.operation) === "compile") {
        const previousCompile = context.toolHistory.some(entry => (
          entry.name === "proof_pattern_engine" &&
          readString(entry.args.operation) === "compile" &&
          /"Status"\s*->\s*"Compiled"/.test(entry.result?.output ?? "")
        ));
        if (previousCompile) {
          return [{
            id: "tool-loop-guard",
            phase: "before_tool_call",
            severity: "warning",
            traceTag: "repeated-proof-ledger",
            message: "A proof_pattern_engine compile call already produced a compiled local ledger.",
            promptHint: "Hook warning: proof_pattern_engine has already compiled a local ledger. Do not recompile merely to restate Wolfram-verified checks; summarize unless there is a genuinely new proof move or changed side-condition ledger."
          }];
        }
      }
      const signature = toolSignature(proposed);
      const matching = context.toolHistory.filter(entry => toolSignature(entry) === signature);
      if (matching.length < 2) return [];
      return [{
        id: "tool-loop-guard",
        phase: "before_tool_call",
        severity: "warning",
        traceTag: "repeated-tool-call",
        message: `The proposed ${proposed.name} call is very similar to ${matching.length} earlier calls.`,
        promptHint: "Hook warning: the last tool request repeats an earlier structured check. Unless the next attempt changes the expression, assumptions, method, or target condition, stop retrying and summarize the remaining analytic gap."
      }];
    }
  },
  {
    id: "symbolic-target-before-final",
    phase: "before_final",
    run(context) {
      if (context.firedHookIds.has("symbolic-target-before-final")) return [];
      const finalText = context.finalText ?? "";
      if (!SYMBOLIC_CLAIM_RE.test(finalText)) return [];
      if (context.toolHistory.some(entry => isVerificationTool(entry.name))) return [];
      return [{
        id: "symbolic-target-before-final",
        phase: "before_final",
        severity: "warning",
        traceTag: "unverified-symbolic-claim",
        message: "The draft final answer contains explicit symbolic claims but no structured Wolfram verification was recorded.",
        promptHint: "Hook warning: the draft answer contains explicit symbolic identities, inequalities, expansions, or transformations without recorded structured Wolfram evidence. If the formulas are explicit, run a compact structured check; otherwise state that the formula is missing or remains an analytic assumption."
      }];
    }
  },
  {
    id: "assumption-ledger-before-final",
    phase: "before_final",
    run(context) {
      if (context.firedHookIds.has("assumption-ledger-before-final")) return [];
      const finalText = context.finalText ?? "";
      const conditionOutputs = context.toolHistory
        .map(entry => entry.result?.conditions)
        .filter((value): value is string => Boolean(value?.trim()));
      const hasNeedsUser = context.toolHistory.some(entry => /NeedsUser|MissingCondition/.test(entry.result?.output ?? ""));
      if (!conditionOutputs.length && !hasNeedsUser) return [];
      if (/condition|assumption|provided|under|NeedsUser|AssumedFromContext|条件|假设/i.test(finalText)) return [];
      return [{
        id: "assumption-ledger-before-final",
        phase: "before_final",
        severity: "warning",
        traceTag: "missing-condition-report",
        message: "Tool evidence contains explicit conditions or missing-condition statuses that are not visible in the draft final answer.",
        evidence: { wolframConditions: conditionOutputs, hasNeedsUser },
        promptHint: "Hook warning: tool evidence contains Wolfram conditions or missing-condition statuses. State these conditions explicitly in the final answer and distinguish them from verified computations."
      }];
    }
  }
];

export function runAgentHooks(context: AgentHookContext): AgentHookResult[] {
  return hooks
    .filter(hook => hook.phase === context.phase)
    .flatMap(hook => hook.run(context));
}

export function hookResultsToPrompt(results: AgentHookResult[]): string {
  const hints = results
    .map(result => result.promptHint?.trim())
    .filter((hint): hint is string => Boolean(hint));
  if (!hints.length) return "";
  return ["Agent workflow hook guidance:", ...hints.map(hint => `- ${hint}`)].join("\n");
}

function toolSignature(entry: ToolHistoryEntry): string {
  return `${entry.name}:${stableStringify(entry.args)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isVerificationTool(name: AgentToolName): boolean {
  return name === "verification_template" ||
    name === "wolfram_simplify" ||
    name === "wolfram_equivalence_check" ||
    name === "wolfram_solve" ||
    name === "wolfram_differentiate" ||
    name === "wolfram_integrate" ||
    name === "wolfram_limit" ||
    name === "wolfram_series" ||
    name === "series_coefficient_check";
}

function extractFormulaCandidates(text: string): string[] {
  const candidates: string[] = [];
  for (const regex of [DISPLAY_MATH_RE, INLINE_MATH_RE]) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const value = (match[1] ?? match[2] ?? match[3] ?? "").replace(/\s+/g, " ").trim();
      if (value && SYMBOLIC_CLAIM_RE.test(value)) candidates.push(truncate(value, 160));
    }
    regex.lastIndex = 0;
  }
  const wolframLike = [...text.matchAll(/\b(?:D|Integrate|Limit|Series|FullSimplify|Simplify|Reduce)\[[^\n]{3,180}\]/g)]
    .map(match => truncate(match[0].replace(/\s+/g, " ").trim(), 160));
  return [...new Set([...candidates, ...wolframLike])].slice(0, 6);
}

function extractAssumptionCandidates(text: string): string[] {
  const clauses = text
    .split(/[.;\n。；]+/)
    .map(part => part.trim())
    .filter(part => ASSUMPTION_SIGNAL_RE.test(part) || /\b[A-Za-z]\w*\s*(?:>|<|>=|<=|!=|==)\s*[^,;\n]+/.test(part));
  return [...new Set(clauses.map(item => truncate(item, 160)))].slice(0, 6);
}

function buildTransformLedgerEvidence(text: string): Record<string, unknown> {
  return {
    formulaCandidates: extractFormulaCandidates(text),
    assumptionCandidates: extractAssumptionCandidates(text)
  };
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}
