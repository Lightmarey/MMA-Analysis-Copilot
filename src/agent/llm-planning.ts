import OpenAI from "openai";
import { config } from "../config.js";
import { toolDefinitions } from "./tools.js";

export type LlmSubproblem = {
  id: string;
  statement: string;
  dependsOn: string[];
  domain: string;
};

export type LlmExecutionPlan = {
  difficulty: "simple" | "complex";
  routeReason: string;
  problemType: string;
  shouldUseTheoryFirst: boolean;
  recommendedTools: string[];
  keyInvariants: string[];
  theoremFocus: string[];
  invariantTargets: string[];
  verificationTargets: string[];
  strategy: string;
  subproblems: LlmSubproblem[];
  finalTarget: string;
};

const PLANNER_PROMPT = `You are the planning and routing stage for a Wolfram-backed math agent.

Return JSON only. Do not solve the problem.

Your job:
- decide whether the problem is "simple" or "complex"
- identify a solution strategy
- decompose multi-step problems into ordered subproblems
- recommend exact available tool names when computation is needed
- include verification targets before the final answer
- do not assert mathematical conclusions as facts in the plan; phrase them as checks to verify
- for sign conventions, ask the solver to verify maximum/minimum roles rather than deciding them in the plan

Use "complex" for proof-heavy, multi-step, PDE, functional analysis, inequality estimate, theorem-first, or any task requiring several symbolic checks.

Available tool names:
{{TOOLS}}

JSON schema:
{
  "difficulty": "simple" | "complex",
  "routeReason": "short reason",
  "problemType": "short domain label",
  "shouldUseTheoryFirst": boolean,
  "recommendedTools": ["tool_name"],
  "keyInvariants": ["..."],
  "theoremFocus": ["..."],
  "invariantTargets": ["..."],
  "verificationTargets": ["..."],
  "strategy": "short strategy",
  "subproblems": [{"id":"sp1","statement":"...","dependsOn":[],"domain":"..."}],
  "finalTarget": "..."
}`;

export async function createLlmExecutionPlan(
  client: OpenAI,
  problem: string,
  model: string
): Promise<LlmExecutionPlan | null> {
  if (!config.llmPlanningEnabled) return null;
  return await requestPlannerJson(client, problem, model, true)
    ?? await requestPlannerJson(client, problem, model, false);
}

async function requestPlannerJson(
  client: OpenAI,
  problem: string,
  model: string,
  useJsonMode: boolean
): Promise<LlmExecutionPlan | null> {
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: PLANNER_PROMPT.replace("{{TOOLS}}", toolDefinitions.map(tool => tool.name).join(", ")) },
        { role: "user", content: problem }
      ],
      temperature: 0,
      max_tokens: 1600,
      ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {})
    });
    return parseLlmExecutionPlan(response.choices[0]?.message?.content ?? "");
  } catch {
    return null;
  }
}

export function parseLlmExecutionPlan(raw: string): LlmExecutionPlan | null {
  try {
    const parsed = JSON.parse(extractJson(raw)) as unknown;
    return normalizeLlmExecutionPlan(parsed);
  } catch {
    return null;
  }
}

export function normalizeLlmExecutionPlan(raw: unknown): LlmExecutionPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const difficulty = record.difficulty === "complex" ? "complex" : "simple";
  const recommendedTools = readStringArray(record.recommendedTools ?? record.recommended_tools)
    .filter(tool => toolDefinitions.some(definition => definition.name === tool));
  const subproblems = readSubproblems(record.subproblems);
  return {
    difficulty,
    routeReason: readString(record.routeReason ?? record.route_reason, difficulty === "complex" ? "LLM planner marked this as multi-step/theory-first." : "LLM planner marked this as direct."),
    problemType: readString(record.problemType ?? record.problem_type, "general"),
    shouldUseTheoryFirst: typeof record.shouldUseTheoryFirst === "boolean"
      ? record.shouldUseTheoryFirst
      : typeof record.should_use_theory_first === "boolean"
        ? record.should_use_theory_first
        : difficulty === "complex",
    recommendedTools,
    keyInvariants: readStringArray(record.keyInvariants ?? record.key_invariants),
    theoremFocus: readStringArray(record.theoremFocus ?? record.theorem_focus),
    invariantTargets: readStringArray(record.invariantTargets ?? record.invariant_targets),
    verificationTargets: readStringArray(record.verificationTargets ?? record.verification_targets),
    strategy: readString(record.strategy, "Use structured Wolfram tools for computations and verify assumptions before concluding."),
    subproblems,
    finalTarget: readString(record.finalTarget ?? record.final_target, subproblems.at(-1)?.statement ?? "solve the original problem")
  };
}

export function buildLlmPlanContext(plan: LlmExecutionPlan): string {
  const lines: string[] = [];
  lines.push("LLM planning context:");
  lines.push(`- route: ${plan.difficulty}`);
  lines.push(`- route_reason: ${plan.routeReason}`);
  lines.push(`- problem_type: ${plan.problemType}`);
  lines.push(`- should_use_theory_first: ${String(plan.shouldUseTheoryFirst)}`);
  lines.push(`- recommended_tools: ${formatList(plan.recommendedTools)}`);
  lines.push(`- theorem_focus: ${formatList(plan.theoremFocus)}`);
  lines.push(`- key_invariants: ${formatList(plan.keyInvariants)}`);
  lines.push(`- invariant_targets: ${formatList(plan.invariantTargets)}`);
  lines.push(`- verification_targets: ${formatList(plan.verificationTargets)}`);
  lines.push(`- strategy: ${plan.strategy}`);
  if (plan.subproblems.length) {
    lines.push("");
    lines.push("Problem decomposition from LLM planner:");
    for (const subproblem of plan.subproblems) {
      lines.push(`- [${subproblem.id}] ${subproblem.statement} (depends: ${subproblem.dependsOn.join(", ") || "none"}; domain: ${subproblem.domain})`);
    }
    lines.push(`- final_target: ${plan.finalTarget}`);
    lines.push(`- decomposition_rule: solve subproblems in dependency order; use Wolfram tools for explicit derivative, integral, algebraic, and inequality checks.`);
  }
  lines.push("- execution_rule: do not present a final answer until verification targets have been checked or explicitly marked as assumptions.");
  return lines.join("\n");
}

function readSubproblems(value: unknown): LlmSubproblem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      id: readString(record.id, `sp${index + 1}`),
      statement: readString(record.statement, ""),
      dependsOn: readStringArray(record.dependsOn ?? record.depends_on),
      domain: readString(record.domain, "general")
    };
  }).filter(item => item.statement);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean))];
}

function formatList(values: string[]): string {
  return values.length ? values.join(", ") : "none";
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}
