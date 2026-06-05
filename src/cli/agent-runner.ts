import chalk from "chalk";
import { MathAgent } from "../agent/agent.js";
import { createLiveLlmPrinter } from "./llm-printer.js";
import type { ChatRun, TraceEvent } from "./report.js";
import type { ThinkingMode } from "./types.js";

export async function askOnce(question: string, thinkingMode: ThinkingMode): Promise<ChatRun> {
  const run = await askOnceWithTrace(question, true, thinkingMode);
  console.log();
  console.log(run.answer);
  return run;
}

export async function askOnceWithTrace(question: string, printTrace: boolean, thinkingMode: ThinkingMode): Promise<ChatRun> {
  const agent = new MathAgent();
  const trace: TraceEvent[] = [];
  try {
    const answer = await agent.chat(question, {
      onRoute(difficulty, model) {
        trace.push({ type: "route", difficulty, model });
        if (printTrace) console.error(chalk.dim(`route ${difficulty} -> ${model}`));
      },
      onPlan(context) {
        trace.push({ type: "plan", context });
      },
      onHook(result) {
        trace.push({ type: "hook", result });
        if (printTrace) console.error(chalk.dim(`hook ${result.id} ${result.severity}: ${result.message}`));
      },
      onToolCall(name, args) {
        trace.push({ type: "tool_call", name, args });
        if (printTrace) console.error(chalk.dim(`\ntool ${name} ${JSON.stringify(args)}`));
      },
      onToolResult(name, markdown, result) {
        trace.push({ type: "tool_result", name, markdown, result });
      },
      ...(printTrace ? createLiveLlmPrinter(thinkingMode) : {})
    });
    return { answer, trace };
  } finally {
    agent.close();
  }
}
