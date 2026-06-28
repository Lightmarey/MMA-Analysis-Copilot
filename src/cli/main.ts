#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import { config } from "../config.js";
import { toolDefinitions } from "../agent/tools.js";
import { expandAtPaths } from "./input.js";
import { applyRuntimeOptions } from "./runtime.js";
import { formatMarkdownReport } from "./report.js";
import { askOnce } from "./agent-runner.js";
import { runBatch } from "./batch-runner.js";
import { runDirectWolfram } from "./direct.js";
import { runDoctor } from "./doctor.js";
import { runFormulaRegistryDiff, runFormulaRegistryLint, runFormulaRegistryPersist, runFormulaRegistryTest } from "./formula-registry.js";
import { daemonStatus, runDaemonForeground, startDaemonDetached, stopDaemon } from "../wolfram/daemon.js";
import { maybeWrite, printInlinedPaths, resolveQuestion } from "./io.js";
import { parsePositiveInteger, parseThinkingMode, parseTraceMode } from "./parsers.js";
import { repl } from "./repl.js";
import type { CliOptions } from "./types.js";

const program = new Command();

program
  .name("wma")
  .description("Wolfram-backed math agent CLI")
  .argument("[question...]", "question to ask")
  .option("-o, --output <path>", "write final Markdown answer to a file")
  .option("-f, --file <path>", "read a single question from a file")
  .option("-b, --batch <path>", "process a batch file; split questions with ---")
  .option("--batch-start <number>", "1-based source question number to start a batch run from", parsePositiveInteger)
  .option("--batch-count <number>", "maximum number of source questions to process from --batch-start", parsePositiveInteger)
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
    const thinkingMode = options.thinking ?? "brief";
    if (options.batch && !options.directWolfram) {
      await runBatch(options.batch, options.output, traceMode, thinkingMode, {
        start: options.batchStart,
        count: options.batchCount
      });
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
      const run = await askOnce(expanded.text, thinkingMode);
      await maybeWrite(options.output, traceMode ? formatMarkdownReport(expanded.text, run, undefined, traceMode) : run.answer);
      return;
    }
    await repl(thinkingMode);
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
  .action(runDoctor);

const formulaRegistry = program
  .command("formula-registry")
  .description("validate and inspect FormulaTransformEngine registry JSON files");

formulaRegistry
  .command("lint")
  .description("validate all FormulaTransformEngine registry JSON files")
  .action(runFormulaRegistryLint);

formulaRegistry
  .command("diff")
  .description("show whether a registry JSON file would add or change an installed entry")
  .argument("<file>", "candidate registry JSON file")
  .action(runFormulaRegistryDiff);

formulaRegistry
  .command("test")
  .description("lint and compile a candidate FormulaTransformEngine registry JSON file, then run optional examples")
  .argument("<file>", "candidate registry JSON file")
  .action(runFormulaRegistryTest);

formulaRegistry
  .command("persist")
  .description("lint, compile, test, and persist a candidate registry JSON file")
  .argument("<file>", "candidate registry JSON file")
  .option("--force", "overwrite an existing registry entry with different content")
  .option("--reload", "reload the current Wolfram worker registry after persisting")
  .action(runFormulaRegistryPersist);

program
  .command("wolfram-daemon")
  .description("manage the cross-process Wolfram daemon")
  .argument("<action>", "start, run, status, or stop")
  .action(async (action: string) => {
    if (action === "run") {
      await runDaemonForeground();
      return;
    }
    if (action === "start") {
      await startDaemonDetached();
      console.log(`Wolfram daemon started at ${config.wolframDaemonHost}:${config.wolframDaemonPort}`);
      return;
    }
    if (action === "status") {
      const status = await daemonStatus();
      console.log(status.output ?? (status.ok ? "running" : status.error));
      return;
    }
    if (action === "stop") {
      const stopped = await stopDaemon();
      console.log(stopped.output ?? (stopped.ok ? "stopping" : stopped.error));
      return;
    }
    throw new Error("wolfram-daemon action must be start, run, status, or stop");
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
