import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { config } from "../config.js";
import { MathAgent } from "../agent/agent.js";
import { toolDefinitions } from "../agent/tools.js";
import { getModelRoute } from "../agent/model-routing.js";
import { expandAtPaths } from "./input.js";
import { maybeWrite, printInlinedPaths } from "./io.js";
import { createLiveLlmPrinter } from "./llm-printer.js";
import type { ThinkingMode } from "./types.js";

export async function repl(thinkingMode: ThinkingMode): Promise<void> {
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

