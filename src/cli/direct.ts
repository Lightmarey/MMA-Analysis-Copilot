import chalk from "chalk";
import { WolframBackend } from "../wolfram/backend.js";

export async function runDirectWolfram(code: string): Promise<void> {
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

