import type { WolframResponse } from "../wolfram/types.js";

export type TraceEvent =
  | { type: "route"; difficulty: "simple" | "complex"; model: string }
  | { type: "plan"; context: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; markdown: string; result?: WolframResponse };

export type ChatRun = {
  answer: string;
  trace: TraceEvent[];
};

export function formatQuestionMarkdown(question: string, answer: string, elapsedMs?: number): string {
  const lines = [
    "# Wolfram Math Agent Answer",
    "",
    elapsedMs === undefined ? "" : `Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`,
    "",
    "## Question",
    "",
    question,
    "",
    "## Answer",
    "",
    answer.trim(),
    ""
  ];
  return compactBlankLines(lines);
}

export function formatMarkdownReport(question: string, run: ChatRun, elapsedMs?: number): string {
  const route = run.trace.find((event): event is Extract<TraceEvent, { type: "route" }> => event.type === "route");
  const plan = run.trace.find((event): event is Extract<TraceEvent, { type: "plan" }> => event.type === "plan");
  const lines = [
    "# Wolfram Math Agent Report",
    "",
    elapsedMs === undefined ? "" : `Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`,
    "",
    "## Question",
    "",
    question,
    "",
    "## Route",
    "",
    route ? `- Difficulty: ${route.difficulty}\n- Model: ${route.model}` : "- Not recorded",
    "",
    "## Preplanning",
    "",
    plan ? fenced(plan.context, "text") : "Not recorded.",
    "",
    "## Tool Trace",
    "",
    formatTrace(run.trace),
    "",
    "## Verification Summary",
    "",
    formatVerificationSummary(run.trace),
    "",
    "## Answer",
    "",
    run.answer.trim(),
    ""
  ];
  return compactBlankLines(lines);
}

export function formatTrace(trace: TraceEvent[]): string {
  const lines: string[] = [];
  let toolIndex = 0;
  for (const event of trace) {
    if (event.type === "tool_call") {
      toolIndex += 1;
      lines.push(`### Tool ${toolIndex}: ${event.name}`);
      lines.push("");
      lines.push(fenced(JSON.stringify(event.args, null, 2), "json"));
      lines.push("");
      continue;
    }
    if (event.type === "tool_result") {
      lines.push(event.markdown || "(no display result)");
      lines.push("");
    }
  }
  return lines.length ? lines.join("\n").trim() : "No tool calls recorded.";
}

export function formatVerificationSummary(trace: TraceEvent[]): string {
  const plan = trace.find((event): event is Extract<TraceEvent, { type: "plan" }> => event.type === "plan");
  const toolResults = trace.filter((event): event is Extract<TraceEvent, { type: "tool_result" }> => event.type === "tool_result");
  const toolCalls = trace.filter((event): event is Extract<TraceEvent, { type: "tool_call" }> => event.type === "tool_call");
  const targets = plan ? parsePlanList(plan.context, "verification_targets") : [];
  const invariants = plan ? parsePlanList(plan.context, "key_invariants") : [];
  const conditions = toolResults
    .map(event => formatCondition(event.result))
    .filter((value): value is string => Boolean(value?.trim()));
  const structuredTools = [...new Set(toolCalls.map(event => event.name).filter(name => name !== "theorem_advisor"))];

  const lines: string[] = [];
  lines.push(`- Structured tools used: ${formatList(structuredTools)}`);
  lines.push(`- Conditions returned by Wolfram: ${conditions.length ? conditions.join(" | ") : "none recorded"}`);
  lines.push(`- Preplanned invariants: ${formatList(invariants)}`);
  lines.push(`- Preplanned verification targets: ${formatList(targets)}`);
  lines.push(`- Audit status: ${auditStatus(targets, conditions, structuredTools)}`);
  return lines.join("\n");
}

function auditStatus(targets: string[], conditions: string[], tools: string[]): string {
  if (!tools.length) return "no structured tool evidence was recorded";
  if (!targets.length && !conditions.length) return "no explicit theorem verification targets or Wolfram conditions were recorded";
  if (targets.length && !conditions.length) return "tool evidence exists; theorem verification targets still require reasoning in the final answer";
  if (!targets.length && conditions.length) return "Wolfram returned explicit conditions; final answer should state them";
  return "Wolfram conditions and theorem verification targets are both visible in the report";
}

function formatCondition(result: WolframResponse | undefined): string {
  if (!result?.conditions) return "";
  return result.conditionLatex
    ? `${result.conditions} ($${result.conditionLatex}$)`
    : result.conditions;
}

function parsePlanList(context: string, key: string): string[] {
  const pattern = new RegExp(`^- ${escapeRegExp(key)}: (.+)$`, "m");
  const match = pattern.exec(context);
  if (!match || match[1].trim() === "none") return [];
  return match[1].split(",").map(part => part.trim()).filter(Boolean);
}

function formatList(values: string[]): string {
  return values.length ? values.join(", ") : "none";
}

function fenced(content: string, language: string): string {
  return `\`\`\`${language}\n${content.trim()}\n\`\`\``;
}

function compactBlankLines(lines: string[]): string {
  return lines.filter((line, index) => line !== "" || lines[index - 1] !== "").join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
