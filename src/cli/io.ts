import fs from "node:fs/promises";
import path from "node:path";
import { stdin as input } from "node:process";
import chalk from "chalk";

export async function maybeWrite(targetPath: string | undefined, content: string): Promise<void> {
  if (!targetPath) return;
  const dir = pathModuleDir(targetPath);
  if (dir) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
  console.error(chalk.green(`Wrote ${targetPath}`));
}

export async function resolveQuestion(positional: string, filePath: string | undefined): Promise<string> {
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

export function printInlinedPaths(paths: string[]): void {
  for (const inlinedPath of paths) {
    console.error(chalk.dim(`inlined ${inlinedPath}`));
  }
}

function pathModuleDir(target: string): string {
  const dir = path.dirname(target);
  return dir === "." ? "" : dir;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

