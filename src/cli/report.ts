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

export type TraceMode = "compact" | "full";

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

export function formatMarkdownReport(question: string, run: ChatRun, elapsedMs?: number, traceMode: TraceMode = "full"): string {
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
    formatTrace(run.trace, traceMode),
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

export function formatTrace(trace: TraceEvent[], mode: TraceMode = "full"): string {
  const lines: string[] = [];
  let toolIndex = 0;
  for (const event of trace) {
    if (event.type === "tool_call") {
      toolIndex += 1;
      lines.push(`### Tool ${toolIndex}: ${event.name}`);
      lines.push("");
      lines.push(mode === "compact" ? formatCompactArgs(event.args) : fenced(JSON.stringify(event.args, null, 2), "json"));
      lines.push("");
      continue;
    }
    if (event.type === "tool_result") {
      lines.push(mode === "compact" ? formatCompactResult(event) : event.markdown || "(no display result)");
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

function formatCompactArgs(args: Record<string, unknown>): string {
  const summaryKeys = ["template", "expr", "equations", "code", "variable", "assumptions", "claimed"];
  const parts = summaryKeys
    .map(key => [key, args[key]] as const)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}=${truncateInline(String(value), key === "expr" || key === "code" || key === "equations" ? 120 : 80)}`);
  return parts.length ? `- ${parts.join("\n- ")}` : "- arguments omitted in compact trace";
}

function formatCompactResult(event: Extract<TraceEvent, { type: "tool_result" }>): string {
  const result = event.result;
  if (!result?.ok) return event.markdown || "(no display result)";
  const title = result.title || event.name;
  const value = result.output ? truncateInline(result.output, 160) : event.markdown ? truncateInline(event.markdown, 160) : "";
  const conditions = result.conditions ? `; conditions=${truncateInline(result.conditions, 100)}` : "";
  return value ? `> ${title}: \`${value}\`${conditions}` : `> ${title}: ok${conditions}`;
}

function truncateInline(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length <= maxLength ? oneLine : `${oneLine.slice(0, maxLength - 3)}...`;
}

function compactBlankLines(lines: string[]): string {
  return lines.filter((line, index) => line !== "" || lines[index - 1] !== "").join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
