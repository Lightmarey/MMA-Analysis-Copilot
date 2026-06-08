import type { WolframResponse } from "../../wolfram/types.js";

export function formatToolResult(toolName: string, args: unknown, result: WolframResponse): string {
  if (!result.ok) {
    return `Tool ${toolName} failed: ${result.error ?? "unknown error"}`;
  }

  const lines = [`Tool ${toolName} result:`];
  if (result.output) lines.push(toolName === "theorem_advisor" ? `JSON: ${result.output}` : `InputForm: ${result.output}`);
  if (result.latex) lines.push(`LaTeX: ${result.latex}`);
  if (result.conditions) lines.push(`Conditions: ${result.conditions}`);
  if (result.conditionLatex) lines.push(`Conditions LaTeX: ${result.conditionLatex}`);
  if (result.rawOutput) lines.push(`Raw InputForm: ${result.rawOutput}`);
  if (result.messages?.length) lines.push(`Messages: ${result.messages.join(" | ")}`);
  lines.push(`Arguments: ${JSON.stringify(args)}`);
  return lines.join("\n");
}

export function formatToolResultMarkdown(toolName: string, result: WolframResponse): string {
  if (!result.ok) return `> ${result.title || toolName} failed: ${result.error ?? "unknown error"}`;
  if (toolName === "theorem_advisor") {
    const summary = summarizeTheoremAdvisor(result.output ?? "");
    return summary ? `> Theorem advisor: ${summary}` : "";
  }

  const title = result.title || toolName;
  if (result.latex) {
    return result.conditionLatex
      ? `> ${title}: $${result.latex}$ under $${result.conditionLatex}$`
      : `> ${title}: $${result.latex}$`;
  }
  if (result.output) {
    return result.conditions
      ? `> ${title}: \`${result.output}\` under \`${result.conditions}\``
      : `> ${title}: \`${result.output}\``;
  }
  return "";
}

function summarizeTheoremAdvisor(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      scale?: string;
      recommendedApproach?: string;
      suggestedTheorems?: Array<{ theorem?: string }>;
      verificationChecks?: string[];
    };
    const theorem = parsed.suggestedTheorems?.[0]?.theorem;
    const checks = parsed.verificationChecks?.slice(0, 2).join(", ");
    return [
      `scale=${parsed.scale ?? "unknown"}`,
      theorem ? `top=${theorem}` : "",
      parsed.recommendedApproach ? `strategy=${parsed.recommendedApproach}` : "",
      checks ? `verify=${checks}` : ""
    ].filter(Boolean).join("; ");
  } catch {
    return "";
  }
}
