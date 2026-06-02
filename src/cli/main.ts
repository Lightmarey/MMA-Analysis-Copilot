#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import { config } from "../config.js";
import { MathAgent } from "../agent/agent.js";
import { toolDefinitions } from "../agent/tools.js";
import { findDefaultWolframCommand, WolframBackend } from "../wolfram/backend.js";
import { expandAtPaths } from "./input.js";
import { formatMarkdownReport, formatQuestionMarkdown } from "./report.js";
import { applyRuntimeOptions } from "./runtime.js";
import type { ChatRun, TraceEvent } from "./report.js";

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
  .option("--trace", "include route, preplanning, and tool trace in saved Markdown")
  .option("--direct-wolfram", "evaluate the question as raw Wolfram Language code without LLM")
  .action(async (
    questionParts: string[],
    options: { output?: string; file?: string; batch?: string; trace?: boolean; directWolfram?: boolean; temperature?: number; maxIterations?: number }
  ) => {
    applyRuntimeOptions(options);
    if (options.batch && !options.directWolfram) {
      await runBatch(options.batch, options.output, options.trace ?? false);
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
      const run = await askOnce(expanded.text);
      await maybeWrite(options.output, options.trace ? formatMarkdownReport(expanded.text, run) : run.answer);
      return;
    }
    await repl();
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
    console.log(`${chalk.bold("Protocol:")} ${config.wolframProtocolPath}`);
    console.log(`${chalk.bold("Worker:")} unsupported in this release`);
    console.log(`${chalk.bold("Wolfram command:")} ${command || "(not found)"}`);
    console.log(`${chalk.bold("Wolfram backend mode:")} ${config.wolframBackendMode}`);
    console.log(`${chalk.bold("Model:")} ${config.model}`);
    console.log(`${chalk.bold("Auto route:")} ${config.autoRoute ? "enabled" : "disabled"}`);
    console.log(`${chalk.bold("Flash model:")} ${config.flashModel}`);
    console.log(`${chalk.bold("Pro model:")} ${config.proModel}`);
    console.log(`${chalk.bold("Preplanning:")} ${config.preplanEnabled ? "enabled" : "disabled"}`);
    console.log(`${chalk.bold("Max iterations:")} ${config.maxIterations}`);
    console.log(`${chalk.bold("Temperature:")} ${config.temperature}`);
    console.log(`${chalk.bold("OPENAI_API_KEY:")} ${config.openaiApiKey ? "set" : "missing"}`);
    console.log(`${chalk.bold("OPENAI_BASE_URL:")} ${config.openaiBaseUrl ?? "(default)"}`);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

async function askOnce(question: string): Promise<ChatRun> {
  const run = await askOnceWithTrace(question, true);
  console.log();
  console.log(run.answer);
  return run;
}

async function askOnceWithTrace(question: string, printTrace: boolean): Promise<ChatRun> {
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
        if (printTrace) console.error(chalk.dim(`tool ${name} ${JSON.stringify(args)}`));
      },
      onToolResult(name, markdown, result) {
        trace.push({ type: "tool_result", name, markdown, result });
      }
    });
    return { answer, trace };
  } finally {
    agent.close();
  }
}

async function runBatch(batchPath: string, outputPath: string | undefined, includeTrace: boolean): Promise<void> {
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
      run = await askOnceWithTrace(expanded.text, true);
    } catch (error) {
      failed = error instanceof Error ? error.message : String(error);
      run = {
        answer: `**Error:** ${failed}`,
        trace: []
      };
    }
    const elapsedMs = Date.now() - started;
    const report = includeTrace ? formatMarkdownReport(questionForReport, run, elapsedMs) : formatQuestionMarkdown(questionForReport, run.answer, elapsedMs);
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

async function repl(): Promise<void> {
  banner();
  const rl = readline.createInterface({ input, output });
  const agent = new MathAgent();
  let lastAnswer = "";

  try {
    while (true) {
      const line = (await rl.question(chalk.green("You > "))).trim();
      if (!line) continue;
      if (line === "/quit" || line === "/exit" || line === "/q") break;
      if (line === "/help") {
        printHelp();
        continue;
      }
      if (line === "/tools") {
        for (const tool of toolDefinitions) console.log(`${tool.name} - ${tool.description}`);
        continue;
      }
      if (line === "/reset") {
        agent.reset();
        lastAnswer = "";
        console.log(chalk.green("Conversation reset."));
        continue;
      }
      if (line === "/last") {
        console.log(lastAnswer || chalk.yellow("No answer yet."));
        continue;
      }
      if (line.startsWith("/save")) {
        const [, rawPath] = line.split(/\s+/, 2);
        const target = rawPath || `output/wolfram-agent-${Date.now()}.md`;
        if (!lastAnswer) {
          console.log(chalk.yellow("No answer to save."));
          continue;
        }
        await maybeWrite(target, lastAnswer);
        continue;
      }

      try {
        const expanded = await expandAtPaths(line, config.rootDir);
        printInlinedPaths(expanded.inlinedPaths);
        const answer = await agent.chat(expanded.text, {
          onRoute(difficulty, model) {
            console.log(chalk.dim(`route ${difficulty} -> ${model}`));
          },
          onToolCall(name, args) {
            console.log(chalk.dim(`tool ${name} ${JSON.stringify(args)}`));
          }
        });
        lastAnswer = answer;
        console.log();
        console.log(answer);
        console.log();
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    }
  } finally {
    agent.close();
    rl.close();
  }
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
  console.log(chalk.dim("Commands: /help /tools /reset /last /save [path] /quit"));
  console.log();
}

function printHelp(): void {
  console.log(`
Ask math questions in natural language. The agent may call Wolfram tools.

Commands:
  /tools         list tools
  /reset         reset conversation
  /last          show last Markdown answer
  /save [path]   save last Markdown answer
  /quit          exit
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
