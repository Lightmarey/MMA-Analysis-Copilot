import { stderr } from "node:process";
import chalk from "chalk";
import type { AgentCallbacks } from "../agent/agent.js";
import type { ThinkingMode } from "./types.js";

export function createLiveLlmPrinter(thinkingMode: ThinkingMode): Pick<AgentCallbacks, "onThinkingDelta" | "onOutputDelta"> {
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

