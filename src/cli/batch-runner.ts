import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { config } from "../config.js";
import { expandAtPaths } from "./input.js";
import { printInlinedPaths } from "./io.js";
import { selectBatchQuestions } from "./batch.js";
import { askOnceWithTrace } from "./agent-runner.js";
import { formatMarkdownReport, formatQuestionMarkdown } from "./report.js";
import type { ChatRun, TraceMode } from "./report.js";
import type { ThinkingMode } from "./types.js";

export async function runBatch(
  batchPath: string,
  outputPath: string | undefined,
  traceMode: TraceMode | null,
  thinkingMode: ThinkingMode,
  selectionOptions: { start?: number; count?: number } = {}
): Promise<void> {
  const content = await fs.readFile(batchPath, "utf8");
  const selection = selectBatchQuestions(content, selectionOptions);

  const outputDir = outputPath || path.join("output", `batch-${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });
  console.error(chalk.cyan(`Batch: ${selection.questions.length}/${selection.total} questions (${selection.start}-${selection.end}) -> ${outputDir}`));

  const summaryItems: BatchSummaryItem[] = [];
  const summary: string[] = [
    "# Wolfram Math Agent Batch",
    "",
    `Source: ${batchPath}`,
    `Questions: ${selection.questions.length} of ${selection.total}`,
    `Range: ${selection.start}-${selection.end}`,
    `Trace: ${traceMode ?? "off"}`,
    "",
    "---",
    ""
  ];

  for (const [idx, item] of selection.questions.entries()) {
    const number = item.sourceNumber;
    const question = item.text;
    const label = String(number).padStart(3, "0");
    const started = Date.now();
    console.error(chalk.bold.cyan(`Question ${idx + 1}/${selection.questions.length} (source ${number}/${selection.total})`));
    console.error(chalk.dim(question.slice(0, 120)));

    let run: ChatRun;
    let failed = "";
    let questionForReport = question;
    try {
      const expanded = await expandAtPaths(question, config.rootDir);
      printInlinedPaths(expanded.inlinedPaths);
      questionForReport = expanded.text;
      run = await askOnceWithTrace(expanded.text, true, thinkingMode);
    } catch (error) {
      failed = error instanceof Error ? error.message : String(error);
      run = {
        answer: `**Error:** ${failed}`,
        trace: []
      };
    }
    const elapsedMs = Date.now() - started;
    const report = traceMode ? formatMarkdownReport(questionForReport, run, elapsedMs, traceMode) : formatQuestionMarkdown(questionForReport, run.answer, elapsedMs);
    const fileName = `q${label}.md`;
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, report, "utf8");

    const iterationCapHit = run.answer.includes("Reached max tool iterations");
    const status = failed ? "error" : iterationCapHit ? "iteration-cap" : "ok";
    const toolCount = run.trace.filter(event => event.type === "tool_call").length;
    summaryItems.push({ status, failed, iterationCapHit, toolCount });

    summary.push(`## Question ${number}`);
    summary.push("");
    summary.push(question.length > 240 ? `${question.slice(0, 237)}...` : question);
    summary.push("");
    summary.push(`- File: [${fileName}](${fileName})`);
    summary.push(`- Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
    summary.push(`- Status: ${status}`);
    summary.push(`- Tool calls: ${toolCount}`);
    summary.push(`- Iteration cap: ${iterationCapHit ? "yes" : "no"}`);
    if (failed) summary.push(`- Error: ${failed}`);
    summary.push("");
  }

  summary.splice(8, 0, ...formatBatchTotals(summaryItems), "");
  await fs.writeFile(path.join(outputDir, "summary.md"), summary.join("\n"), "utf8");
  console.error(chalk.green(`Batch complete: ${path.join(outputDir, "summary.md")}`));
}

export type BatchSummaryItem = {
  status: "ok" | "error" | "iteration-cap";
  failed: string;
  iterationCapHit: boolean;
  toolCount: number;
};

export function formatBatchTotals(items: BatchSummaryItem[]): string[] {
  const ok = items.filter(item => item.status === "ok").length;
  const errors = items.filter(item => item.status === "error").length;
  const iterationCaps = items.filter(item => item.iterationCapHit).length;
  const toolCalls = items.reduce((sum, item) => sum + item.toolCount, 0);
  return [
    "## Summary",
    "",
    `- Success: ${ok}`,
    `- Errors: ${errors}`,
    `- Iteration cap hits: ${iterationCaps}`,
    `- Total tool calls: ${toolCalls}`
  ];
}
