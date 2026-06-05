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

const hooks: AgentHook[] = [
  {
    id: "proof-pattern-opportunity",
    phase: "after_plan",
    run(context) {
      if (!TRANSFORM_SIGNAL_RE.test(`${context.userMessage}\n${context.planContext ?? ""}`)) return [];
      return [{
        id: "proof-pattern-opportunity",
        phase: "after_plan",
        severity: "hint",
        traceTag: "proof-transform-ledger",
        message: "A supplied formula transformation or side-condition ledger may benefit from proof_pattern_engine compile before concrete Wolfram checks.",
        promptHint: [
          "Hook hint: if the task includes a supplied formula transformation, consider using proof_pattern_engine with operation=compile to record the proof move, bindings, side conditions, and missing assumptions before concrete Wolfram checks.",
          "This is optional guidance; verify explicit formulas with structured Wolfram tools when available."
        ].join(" ")
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
      if (context.toolHistory.some(entry => entry.name.startsWith("wolfram_") || entry.name === "verification_template")) return [];
      return [{
        id: "symbolic-target-before-final",
        phase: "before_final",
        severity: "warning",
        traceTag: "unverified-symbolic-claim",
        message: "The draft final answer contains explicit symbolic claims but no structured Wolfram verification was recorded.",
        promptHint: "Hook warning: the draft answer contains explicit symbolic identities, inequalities, expansions, or transformations without recorded structured Wolfram evidence. If the formulas are explicit, run a compact structured check; otherwise state that the formula is missing or remains an analytic assumption."
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
    name === "wolfram_solve" ||
    name === "wolfram_differentiate" ||
    name === "wolfram_integrate" ||
    name === "wolfram_limit" ||
    name === "wolfram_series";
}
