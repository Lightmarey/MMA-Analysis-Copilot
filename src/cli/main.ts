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

const program = new Command();

program
  .name("wma")
  .description("Wolfram-backed math agent CLI")
  .argument("[question...]", "question to ask")
  .option("-o, --output <path>", "write final Markdown answer to a file")
  .option("--direct-wolfram", "evaluate the question as raw Wolfram Language code without LLM")
  .action(async (questionParts: string[], options: { output?: string; directWolfram?: boolean }) => {
    const question = questionParts.join(" ").trim();
    if (options.directWolfram) {
      await runDirectWolfram(question);
      return;
    }
    if (question) {
      const answer = await askOnce(question);
      await maybeWrite(options.output, answer);
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
  .description("show environment and Wolfram worker configuration")
  .action(async () => {
    const command = findDefaultWolframCommand();
    console.log(`${chalk.bold("Root:")} ${config.rootDir}`);
    console.log(`${chalk.bold("Protocol:")} ${config.wolframProtocolPath}`);
    console.log(`${chalk.bold("Worker:")} ${config.wolframWorkerPath}`);
    console.log(`${chalk.bold("Wolfram command:")} ${command || "(not found)"}`);
    console.log(`${chalk.bold("Wolfram backend mode:")} ${config.wolframBackendMode}`);
    console.log(`${chalk.bold("Model:")} ${config.model}`);
    console.log(`${chalk.bold("Auto route:")} ${config.autoRoute ? "enabled" : "disabled"}`);
    console.log(`${chalk.bold("Flash model:")} ${config.flashModel}`);
    console.log(`${chalk.bold("Pro model:")} ${config.proModel}`);
    console.log(`${chalk.bold("Preplanning:")} ${config.preplanEnabled ? "enabled" : "disabled"}`);
    console.log(`${chalk.bold("OPENAI_API_KEY:")} ${config.openaiApiKey ? "set" : "missing"}`);
    console.log(`${chalk.bold("OPENAI_BASE_URL:")} ${config.openaiBaseUrl ?? "(default)"}`);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

async function askOnce(question: string): Promise<string> {
  const agent = new MathAgent();
  try {
    const answer = await agent.chat(question, {
      onRoute(difficulty, model) {
        console.error(chalk.dim(`route ${difficulty} -> ${model}`));
      },
      onToolCall(name, args) {
        console.error(chalk.dim(`tool ${name} ${JSON.stringify(args)}`));
      }
    });
    console.log();
    console.log(answer);
    return answer;
  } finally {
    agent.close();
  }
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
        const answer = await agent.chat(line, {
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
  console.log(chalk.dim(`model=${config.model} route=${config.autoRoute ? "auto" : "off"} worker=${config.wolframWorkerPath}`));
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
