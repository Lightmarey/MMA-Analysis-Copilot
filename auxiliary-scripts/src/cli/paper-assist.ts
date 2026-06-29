import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { config } from "../../../src/config.js";
import { analyzePaperPreflight, formatPaperPreflight, type PaperPreflight } from "../agent/paper-preflight.js";
import { llmCallText } from "../../../src/agent/json-utils.js";

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
    if (scenarios.length >= 40) break; // Early exit to prevent huge API costs on drafts
    console.log(`Processing ${file}...`);
    const text = await fs.readFile(file, "utf8");
    // Chunk TeX by paragraphs (double newlines)
    const paragraphs = text.split(/\r?\n\s*\r?\n/);
    
    let currentLine = 1;

    for (const para of paragraphs) {
      if (scenarios.length >= 40) break;
      const lineCount = para.split(/\r?\n/).length;
      
      // Lightweight pre-filter to skip purely text paragraphs and save tokens
      if (containsMath(para)) {
        try {
          const score = await scoreSnippetWithLLM(client, para);
          
          if (score >= 3) {
            console.log(`  [Score ${score}] Analyzing snippet at line ${currentLine}...`);
            const preflight = await analyzePaperPreflight(client, para);
            
            if (preflight.method && preflight.method !== "unknown") {
              console.log(`    -> Selected as ${preflight.method}`);
              scenarios.push({
                file: path.relative(root, file),
                line: currentLine,
                method: preflight.method,
                score,
                preflight,
                prompt: buildPrompt(preflight.method, preflight.symbolicTools, preflight),
                snippet: para.trim()
              });
            }
          }
        } catch (error) {
          console.error(`Error analyzing snippet in ${file}:${currentLine}:`, error);
        }
      }
      
      currentLine += lineCount + 1; // +1 for the blank line separator
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

function containsMath(text: string): boolean {
  // Simple check for mathematical environments or inline math to filter out plain text paragraphs
  return /\\begin\{(?:equation|align|aligned|lemma|proposition|theorem|proof)\}|\$\$|\\\[|\\\(|\$/.test(text);
}

async function scoreSnippetWithLLM(client: OpenAI, snippet: string): Promise<number> {
  const prompt = `Evaluate the following LaTeX snippet for its potential to be automatically verified by a symbolic math assistant.
Score it from 1 to 5:
1: Purely text, qualitative, or trivial definitions.
3: Contains some formulas but they are standard or mostly qualitative.
5: Contains critical inequalities, PDE bounds, complex algebraic identities, or non-trivial parameter choices that strongly benefit from symbolic verification.

Provide only the integer score (1, 2, 3, 4, or 5).

Snippet:
${snippet}`;

  // Use the weaker/faster model for bulk scoring
  const result = await llmCallText(client, config.flashModel || "gemini-2.5-flash", prompt, "");
  const match = result.match(/\d/);
  return match ? parseInt(match[0], 10) : 1;
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
