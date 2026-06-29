import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { config } from "../../src/config.js";
import { analyzePaperPreflight, formatPaperPreflight, type PaperPreflight } from "../agent/paper-preflight.js";

type Scenario = {
  file: string;
  line: number;
  method: string;
  score: number;
  preflight: PaperPreflight;
  prompt: string;
  snippet: string;
};

const root = process.cwd();
const inputRoot = process.argv[2] || path.join(root, "testexamples");
const outputDir = process.argv[3] || path.join(root, "output", "paper-assist");

async function main(): Promise<void> {
  if (!config.openaiApiKey) {
    throw new Error("OpenAI API Key is required for paper-assist script.");
  }
  const client = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl
  });

  const files = await texFiles(inputRoot);
  const scenarios: Scenario[] = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split(/\r?\n/);
    
    let lastCheckedIndex = -1;

    for (let index = 0; index < lines.length; index += 1) {
      // Skip if we recently checked this area
      if (index <= lastCheckedIndex + 2) continue;

      const score = scoreScenario(lines, index);
      // We only run LLM analysis on high-potential math blocks to save API calls
      if (score < 2) continue;

      const snippet = contextSnippet(lines, index);
      
      try {
        const preflight = await analyzePaperPreflight(client, snippet);
        
        if (preflight.method && preflight.method !== "unknown") {
          scenarios.push({
            file: path.relative(root, file),
            line: index + 1,
            method: preflight.method,
            score,
            preflight,
            prompt: buildPrompt(preflight.method, preflight.symbolicTools, preflight),
            snippet
          });
          
          // Skip the next few lines since they are part of the same snippet
          lastCheckedIndex = index;
        }
      } catch (error) {
        console.error(`Error analyzing snippet in ${file}:${index + 1}:`, error);
      }
    }
  }

  const selected = selectScenarios(scenarios);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "scenarios.json"), JSON.stringify(selected, null, 2), "utf8");
  await fs.writeFile(path.join(outputDir, "scenarios.md"), renderMarkdown(selected), "utf8");
  await fs.writeFile(path.join(outputDir, "batch.md"), renderBatch(selected), "utf8");
  console.log(`paper assist scenarios: ${selected.length}`);
  console.log(`output: ${outputDir}`);
}

async function texFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await texFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".tex")) {
      results.push(fullPath);
    }
  }
  return results;
}

function selectScenarios(scenarios: Scenario[]): Scenario[] {
  const seen = new Set<string>();
  const groupCounts = new Map<string, number>();
  const selected: Scenario[] = [];
  const ranked = scenarios
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);
  
  for (const scenario of ranked) {
    const key = `${scenario.method}:${scenario.file}`;
    if (seen.has(key)) continue;
    const group = topLevelExample(scenario.file);
    if ((groupCounts.get(group) ?? 0) >= 6) continue;
    seen.add(key);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    selected.push(scenario);
  }
  return selected.slice(0, 18);
}

function topLevelExample(file: string): string {
  const normalized = file.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[0] === "testexamples" && parts[1] ? parts[1] : parts[0] ?? file;
}

function contextSnippet(lines: string[], index: number): string {
  const start = Math.max(0, index - 3);
  const end = Math.min(lines.length, index + 4);
  return lines.slice(start, end).join("\n").trim();
}

function buildPrompt(method: string, toolHints: string[], preflight: PaperPreflight): string {
  return [
    `Act as a mathematician using ai4math for a local paper-assistance task of kind ${method}.`,
    "Assume the global proof framework is already known.",
    toolHints.length > 0 ? `Prefer these tools when applicable: ${toolHints.join(", ")}.` : "",
    `Use at most ${preflight.maxToolCalls} tool calls.`,
    formatPaperPreflight(preflight),
    "If the excerpt does not contain a concrete expression to check, do not invent one; report the missing local data instead.",
    "Return selected local checks, analytic assumptions still requiring the author, and one concrete improvement request for the assistant."
  ].filter(Boolean).join(" ");
}

function scoreScenario(lines: string[], index: number): number {
  const snippet = contextSnippet(lines, index);
  let score = 0;
  if (/\\begin\{(?:equation|align|aligned|lemma|proposition|theorem)\}|\$\$|\\\[|\\eqref|\\label/.test(snippet)) score += 3;
  if (/[=<>]|\\le|\\ge|\\sum|\\int|\\Delta|D\^2|S_\{|\\nabla|\\partial/.test(snippet)) score += 2;
  if (/constant|choose|sufficiently|boundary|operator|coefficient|estimate|inequality|?؊r_|_1 O|,, |r/.test(snippet)) score += 1;
  if (/paper\s+is\s+organized|this\s+paper\s+is\s+organized|bibliography|abstract|o-؇"z,|o-؆r%Z'/i.test(snippet)) score -= 4;
  if (snippet.length < 80) score -= 1;
  return score;
}

function renderMarkdown(scenarios: Scenario[]): string {
  const lines = ["# Paper Assist Scenarios", ""];
  for (const scenario of scenarios) {
    lines.push(`## ${scenario.method}`);
    lines.push("");
    lines.push(`- file: ${scenario.file}`);
    lines.push(`- line: ${scenario.line}`);
    lines.push(`- preflight: ${scenario.preflight.class} (${scenario.preflight.method})`);
    lines.push(`- max_tool_calls: ${scenario.preflight.maxToolCalls}`);
    lines.push(`- missing: ${scenario.preflight.missing.length ? scenario.preflight.missing.join(", ") : "none"}`);
    lines.push(`- prompt: ${scenario.prompt}`);
    lines.push("");
    lines.push("```tex");
    lines.push(scenario.snippet);
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

function renderBatch(scenarios: Scenario[]): string {
  return scenarios.map(scenario => [
    scenario.prompt,
    "",
    "Local excerpt:",
    "```tex",
    scenario.snippet,
    "```"
  ].join("\n")).join("\n\n---\n\n");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
