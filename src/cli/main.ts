#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { stderr, stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import { config } from "../config.js";
import { MathAgent } from "../agent/agent.js";
import { toolDefinitions } from "../agent/tools.js";
import { findDefaultWolframCommand, WolframBackend } from "../wolfram/backend.js";
import { expandAtPaths } from "./input.js";
import { formatMarkdownReport, formatQuestionMarkdown } from "./report.js";
import { applyRuntimeOptions } from "./runtime.js";
import { getModelRoute } from "../agent/model-routing.js";
import type { AgentCallbacks } from "../agent/agent.js";
import type { ChatRun, TraceEvent, TraceMode } from "./report.js";

type ThinkingMode = "off" | "brief" | "full";
type CliOptions = {
  output?: string;
  file?: string;
  batch?: string;
  trace?: boolean | TraceMode;
  directWolfram?: boolean;
  temperature?: number;
  maxIterations?: number;
  thinking?: ThinkingMode;
};

const program = new Command();

program
  .name("wma")
  .description("Wolfram-backed math agent CLI")
  .argument("[question...]", "question to ask")
  .option("-o, --output <path>", "write final Markdown answer to a file")
  .option("-f, --file <path>", "read a single question from a file")
  .option("-b, --batch <path>", "process a batch file; split questions with ---")
  .option("-t, --temperature <number>", "override model temperature for this run", Number.parseFloat)
  .option("-n, --max-iterations <number>", "override maximum tool-calling iterations for this run", parsePositiveInteger)
  .option("--trace [mode]", "include route, preplanning, and tool trace in saved Markdown: compact or full")
  .option("--thinking <mode>", "show streamed reasoning: off, brief, or full", parseThinkingMode, "brief")
  .option("--direct-wolfram", "evaluate the question as raw Wolfram Language code without LLM")
  .action(async (
    questionParts: string[],
    options: CliOptions
  ) => {
    applyRuntimeOptions(options);
    const traceMode = parseTraceMode(options.trace);
    if (options.batch && !options.directWolfram) {
      await runBatch(options.batch, options.output, traceMode, options.thinking ?? "brief");
      return;
    }
    const question = await resolveQuestion(questionParts.join(" ").trim(), options.file);
    if (options.directWolfram) {
      await runDirectWolfram(question);
      return;
    }
    if (question) {
      const expanded = await expandAtPaths(question, config.rootDir);
      printInlinedPaths(expanded.inlinedPaths);
      const run = await askOnce(expanded.text, options.thinking ?? "brief");
      await maybeWrite(options.output, traceMode ? formatMarkdownReport(expanded.text, run, undefined, traceMode) : run.answer);
      return;
    }
    await repl(options.thinking ?? "brief");
  });

program
  .command("tools")
  .description("list available tools")
  .action(() => {
    for (const tool of toolDefinitions) {
      console.log(`${chalk.yellow(tool.name)} - ${tool.description}`);
    }
  });

program
  .command("doctor")
  .description("show environment and Wolfram backend configuration")
  .action(async () => {
    const command = findDefaultWolframCommand();
    console.log(`${chalk.bold("Root:")} ${config.rootDir}`);
    console.log(`${chalk.bold("Config:")} ${config.configPath} (${config.configFileLoaded ? "loaded" : "not found"})`);
    console.log(`${chalk.bold("Protocol:")} ${config.wolframProtocolPath}`);
    console.log(`${chalk.bold("Worker:")} unsupported in this release`);
    console.log(`${chalk.bold("Wolfram command:")} ${command || "(not found)"}`);
    console.log(`${chalk.bold("Wolfram backend mode:")} ${config.wolframBackendMode}`);
    console.log(`${chalk.bold("Model:")} ${config.model}`);
    console.log(`${chalk.bold("Auto route:")} ${config.autoRoute ? "enabled" : "disabled"}`);
    console.log(`${chalk.bold("Flash model:")} ${config.flashModel}`);
    console.log(`${chalk.bold("Pro model:")} ${config.proModel}`);
    console.log(`${chalk.bold("Model discovery:")} ${config.autoDiscoverModels ? "enabled" : "disabled"}`);
    if (config.openaiApiKey && config.autoDiscoverModels) {
      const route = await getModelRoute();
      console.log(`${chalk.bold("Discovered models:")} ${route.discovered ? route.availableModels.join(", ") : `failed (${route.warning ?? "unknown"})`}`);
      console.log(`${chalk.bold("Resolved flash model:")} ${route.flashModel}`);
      console.log(`${chalk.bold("Resolved pro model:")} ${route.proModel}`);
    }
    console.log(`${chalk.bold("Preplanning:")} ${config.preplanEnabled ? "enabled" : "disabled"}`);
    console.log(`${chalk.bold("LLM planning:")} ${config.llmPlanningEnabled ? "enabled" : "disabled"}`);
    console.log(`${chalk.bold("Max iterations:")} ${config.maxIterations}`);
    console.log(`${chalk.bold("Temperature:")} ${config.temperature}`);
    console.log(`${chalk.bold("OpenAI API key:")} ${config.openaiApiKey ? "set" : "missing"}`);
    console.log(`${chalk.bold("OpenAI base URL:")} ${config.openaiBaseUrl ?? "(default)"}`);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

async function askOnce(question: string, thinkingMode: ThinkingMode): Promise<ChatRun> {
  const run = await askOnceWithTrace(question, true, thinkingMode);
  console.log();
  console.log(run.answer);
  return run;
}

async function askOnceWithTrace(question: string, printTrace: boolean, thinkingMode: ThinkingMode): Promise<ChatRun> {
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

async function runBatch(batchPath: string, outputPath: string | undefined, traceMode: TraceMode | null, thinkingMode: ThinkingMode): Promise<void> {
  const content = await fs.readFile(batchPath, "utf8");
  const questions = content.split(/^---\s*$/m).map(part => part.trim()).filter(Boolean);
  if (!questions.length) {
    throw new Error(`No questions found in ${batchPath}`);
  }

  const outputDir = outputPath || path.join("output", `batch-${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });
  console.error(chalk.cyan(`Batch: ${questions.length} questions -> ${outputDir}`));

  const summary: string[] = [
    "# Wolfram Math Agent Batch",
    "",
    `Source: ${batchPath}`,
    `Questions: ${questions.length}`,
    "",
    "---",
    ""
  ];

  for (const [idx, question] of questions.entries()) {
    const number = idx + 1;
    const label = String(number).padStart(3, "0");
    const started = Date.now();
    console.error(chalk.bold.cyan(`Question ${number}/${questions.length}`));
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

    summary.push(`## Question ${number}`);
    summary.push("");
    summary.push(question.length > 240 ? `${question.slice(0, 237)}...` : question);
    summary.push("");
    summary.push(`- File: [${fileName}](${fileName})`);
    summary.push(`- Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
    summary.push(`- Status: ${failed ? "error" : "ok"}`);
    summary.push("");
  }

  await fs.writeFile(path.join(outputDir, "summary.md"), summary.join("\n"), "utf8");
  console.error(chalk.green(`Batch complete: ${path.join(outputDir, "summary.md")}`));
}

async function repl(thinkingMode: ThinkingMode): Promise<void> {
  banner();
  const rl = readline.createInterface({ input, output, prompt: chalk.green("You > ") });
  const agent = new MathAgent();
  let lastAnswer = "";
  let bufferedLines: string[] = [];
  let flushTimer: NodeJS.Timeout | null = null;
  let processing = false;
  let closed = false;

  const prompt = () => {
    if (!closed && !processing) rl.prompt();
  };

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushBuffered();
    }, 150);
  };

  const flushBuffered = async () => {
    if (processing || !bufferedLines.length) return;
    const rawInput = bufferedLines.join("\n");
    bufferedLines = [];
    const text = rawInput.trim();
    if (!text) {
      prompt();
      return;
    }
    processing = true;
    try {
      const shouldContinue = await handleReplInput(text, agent, thinkingMode, {
        getLastAnswer: () => lastAnswer,
        setLastAnswer: value => {
          lastAnswer = value;
        },
        close: () => {
          closed = true;
          rl.close();
        }
      });
      if (!shouldContinue) return;
    } finally {
      processing = false;
    }
    if (bufferedLines.length) {
      await flushBuffered();
      return;
    }
    prompt();
  };

  try {
    rl.on("line", line => {
      bufferedLines.push(line);
      scheduleFlush();
    });
    prompt();
    await new Promise<void>(resolve => rl.once("close", resolve));
  } finally {
    if (flushTimer) clearTimeout(flushTimer);
    agent.close();
    if (!closed) rl.close();
  }
}

type ReplState = {
  getLastAnswer: () => string;
  setLastAnswer: (value: string) => void;
  close: () => void;
};

async function handleReplInput(line: string, agent: MathAgent, thinkingMode: ThinkingMode, state: ReplState): Promise<boolean> {
  if (line === "/quit" || line === "/exit" || line === "/q") {
    state.close();
    return false;
  }
  if (line === "/help") {
    printHelp();
    return true;
  }
  if (line === "/tools") {
    for (const tool of toolDefinitions) console.log(`${tool.name} - ${tool.description}`);
    return true;
  }
  if (line.startsWith("/model")) {
    await handleModelCommand(line, agent);
    return true;
  }
  if (line === "/reset") {
    agent.reset();
    state.setLastAnswer("");
    console.log(chalk.green("Conversation reset."));
    return true;
  }
  if (line === "/last") {
    console.log(state.getLastAnswer() || chalk.yellow("No answer yet."));
    return true;
  }
  if (line.startsWith("/save")) {
    const [, rawPath] = line.split(/\s+/, 2);
    const target = rawPath || `output/wolfram-agent-${Date.now()}.md`;
    if (!state.getLastAnswer()) {
      console.log(chalk.yellow("No answer to save."));
      return true;
    }
    await maybeWrite(target, state.getLastAnswer());
    return true;
  }

  try {
    const expanded = await expandAtPaths(line, config.rootDir);
    printInlinedPaths(expanded.inlinedPaths);
    const answer = await agent.chat(expanded.text, {
      onRoute(difficulty, model) {
        console.log(chalk.dim(`route ${difficulty} -> ${model}`));
      },
      onToolCall(name, args) {
        console.log(chalk.dim(`\ntool ${name} ${JSON.stringify(args)}`));
      },
      ...createLiveLlmPrinter(thinkingMode)
    });
    state.setLastAnswer(answer);
    console.log();
    console.log(answer);
    console.log();
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
  return true;
}

async function handleModelCommand(line: string, agent: MathAgent): Promise<void> {
  const [, rawModel] = line.split(/\s+/, 2);
  const route = await getModelRoute();
  const forcedModel = agent.getForcedModel();

  if (!rawModel) {
    console.log(chalk.bold("Models"));
    console.log(`Current: ${forcedModel ? `${forcedModel} (forced)` : "auto route"}`);
    console.log(`Resolved default: ${route.defaultModel}`);
    console.log(`Resolved flash: ${route.flashModel}`);
    console.log(`Resolved pro: ${route.proModel}`);
    if (route.discovered) {
      console.log("Available:");
      for (const model of route.availableModels) {
        const marker = model === forcedModel ? "*" : "-";
        console.log(`  ${marker} ${model}`);
      }
    } else {
      console.log(`Available: discovery unavailable${route.warning ? ` (${route.warning})` : ""}`);
    }
    return;
  }

  const model = rawModel.trim();
  if (model === "auto" || model === "clear" || model === "default") {
    agent.setForcedModel(null);
    console.log(chalk.green("Model override cleared; automatic flash/pro routing is active."));
    return;
  }
  if (route.discovered && !route.availableModels.includes(model)) {
    console.log(chalk.yellow(`Model '${model}' was not in the discovered provider model list.`));
    console.log(chalk.dim(`Use one of: ${route.availableModels.join(", ")}`));
    return;
  }
  agent.setForcedModel(model);
  console.log(chalk.green(`Model override for this session: ${model}`));
}

function createLiveLlmPrinter(thinkingMode: ThinkingMode): Pick<AgentCallbacks, "onThinkingDelta" | "onOutputDelta"> {
  let thinkingStarted = false;
  let outputStarted = false;
  let thinkingChars = 0;
  return {
    onThinkingDelta(text) {
      if (thinkingMode === "off") return;
      if (!thinkingStarted) {
        thinkingStarted = true;
        stderr.write(chalk.dim(thinkingMode === "full" ? "\n[think]\n" : "\n[think]"));
      }
      if (thinkingMode === "full") {
        stderr.write(chalk.dim(text));
        return;
      }
      const previousBucket = Math.floor(thinkingChars / 1000);
      thinkingChars += text.length;
      const currentBucket = Math.floor(thinkingChars / 1000);
      if (currentBucket > previousBucket) {
        stderr.write(chalk.dim(` ${thinkingChars} chars`));
      }
    },
    onOutputDelta(text) {
      if (!outputStarted) {
        outputStarted = true;
        stderr.write(chalk.cyan("\n[output]\n"));
      }
      stderr.write(text);
    }
  };
}

async function runDirectWolfram(code: string): Promise<void> {
  if (!code.trim()) {
    throw new Error("--direct-wolfram requires code");
  }
  const backend = new WolframBackend();
  try {
    const result = await backend.call("wolfram_eval", { code });
    if (!result.ok) {
      console.error(chalk.red(result.error ?? "Wolfram evaluation failed"));
      process.exitCode = 1;
      return;
    }
    console.log(result.output ?? "");
    if (result.latex) console.log(`LaTeX: ${result.latex}`);
  } finally {
    backend.close();
  }
}

function banner(): void {
  console.log(chalk.cyan.bold("Wolfram Math Agent"));
  console.log(chalk.dim(`model=${config.model} route=${config.autoRoute ? "auto" : "off"} backend=${config.wolframBackendMode}`));
  console.log(chalk.dim("Commands: /help /tools /model [id|auto] /reset /last /save [path] /quit"));
  console.log(chalk.dim("Multiline paste is collected as one question."));
  console.log();
}

function printHelp(): void {
  console.log(`
Ask math questions in natural language. The agent may call Wolfram tools.

Commands:
  /tools         list tools
  /model         list discovered models and show current selection
  /model <id>    force the current session to use a model
  /model auto    return to automatic flash/pro routing
  /reset         reset conversation
  /last          show last Markdown answer
  /save [path]   save last Markdown answer
  /quit          exit

Paste a multiline LaTeX problem directly; lines pasted together are submitted
as one question.
`);
}

async function maybeWrite(path: string | undefined, content: string): Promise<void> {
  if (!path) return;
  const dir = pathModuleDir(path);
  if (dir) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path, content, "utf8");
  console.error(chalk.green(`Wrote ${path}`));
}

function pathModuleDir(target: string): string {
  const dir = path.dirname(target);
  return dir === "." ? "" : dir;
}

async function resolveQuestion(positional: string, filePath: string | undefined): Promise<string> {
  if (filePath) {
    return (await fs.readFile(filePath, "utf8")).trim();
  }
  if (positional.trim()) {
    return positional.trim();
  }
  if (!input.isTTY) {
    return (await readStdin()).trim();
  }
  return "";
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function printInlinedPaths(paths: string[]): void {
  for (const inlinedPath of paths) {
    console.error(chalk.dim(`inlined ${inlinedPath}`));
  }
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Expected a positive integer");
  }
  return parsed;
}

function parseTraceMode(value: boolean | TraceMode | undefined): TraceMode | null {
  if (value === undefined || value === false) return null;
  if (value === true) return "compact";
  const normalized = value.trim().toLowerCase();
  if (normalized === "compact" || normalized === "full") return normalized;
  throw new Error("--trace must be compact or full");
}

function parseThinkingMode(value: string): ThinkingMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === "off" || normalized === "brief" || normalized === "full") return normalized;
  throw new Error("--thinking must be off, brief, or full");
}
