import fs from "node:fs/promises";
import path from "node:path";

type ScenarioKind =
  | "variational_functional"
  | "nonlinear_functional"
  | "inequality_estimate"
  | "barrier_construction"
  | "moving_spheres"
  | "ode_reduction"
  | "manifold_integral"
  | "sub_super_solution"
  | "hessian_matrix";

type Scenario = {
  file: string;
  line: number;
  kind: ScenarioKind;
  score: number;
  prompt: string;
  snippet: string;
};

const root = process.cwd();
const inputRoot = process.argv[2] || path.join(root, "testexamples");
const outputDir = process.argv[3] || path.join(root, "output", "paper-assist");

const patterns: Array<{ kind: ScenarioKind; regex: RegExp; toolHints: string[] }> = [
  {
    kind: "variational_functional",
    regex: /variational|functional|minimi[sz]|mountain\s+pass|palais|nehari|pohozaev|euler[-\s]?lagrange|变分|泛函|极小|临界点|山路|流形/i,
    toolHints: ["theorem_advisor", "verification_template:first_variation_derivative", "wolfram_differentiate", "wolfram_simplify"]
  },
  {
    kind: "nonlinear_functional",
    regex: /nonlinear|choquard|yamabe|hessian\s+quotient|critical\s+exponent|非线性|临界指数|正规化|基态/i,
    toolHints: ["theorem_advisor", "wolfram_simplify", "wolfram_integrate", "inequality_engine"]
  },
  {
    kind: "inequality_estimate",
    regex: /inequality|estimate|holder|h[oö]lder|young|cauchy|sobolev|poincare|harnack|不等式|估计|吸收|赫尔德|庞加莱/i,
    toolHints: ["inequality_engine", "wolfram_simplify", "verification_template:parameter_absorption_check"]
  },
  {
    kind: "barrier_construction",
    regex: /barrier|auxiliary\s+function|test\s+function|maximum\s+principle|闸函数|辅助函数|比较函数|最大值原理/i,
    toolHints: ["theorem_advisor", "verification_template:barrier_operator_check", "wolfram_differentiate", "wolfram_simplify"]
  },
  {
    kind: "moving_spheres",
    regex: /moving\s+spheres|moving\s+planes|kelvin|inversion|reflection|sphere|球面|移动球|反演|Kelvin/i,
    toolHints: ["theorem_advisor", "verification_template:kelvin_power_check", "wolfram_simplify", "wolfram_differentiate"]
  },
  {
    kind: "ode_reduction",
    regex: /\bode\b|ordinary\s+differential|phase\s+plane|radial\s+equation|differential\s+inequality|常微分|相平面|径向|微分不等式/i,
    toolHints: ["wolfram_dsolve", "verification_template:ode_residual_check", "verification_template:radial_laplacian_check"]
  },
  {
    kind: "manifold_integral",
    regex: /manifold|sphere|spherical|representation|group|invariant\s+measure|integral\s+on|流形|球面|表示论|不变测度|群作用/i,
    toolHints: ["theorem_advisor", "wolfram_integrate", "wolfram_transform", "wolfram_simplify"]
  },
  {
    kind: "sub_super_solution",
    regex: /sub[-\s]?solution|super[-\s]?solution|upper\s+solution|lower\s+solution|上下解|上解|下解/i,
    toolHints: ["theorem_advisor", "verification_template:barrier_operator_check", "wolfram_simplify"]
  },
  {
    kind: "hessian_matrix",
    regex: /hessian|matrix|eigenvalue|determinant|principal\s+minor|maclaurin|newton|大hessian|矩阵|特征值|行列式|主子式/i,
    toolHints: ["wolfram_matrix", "verification_template:hessian_matrix_invariants", "wolfram_simplify"]
  }
];

async function main(): Promise<void> {
  const files = await texFiles(inputRoot);
  const scenarios: Scenario[] = [];
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const pattern of patterns) {
        if (!pattern.regex.test(line)) continue;
        scenarios.push({
          file: path.relative(root, file),
          line: index + 1,
          kind: pattern.kind,
          score: scoreScenario(lines, index),
          prompt: buildPrompt(pattern.kind, pattern.toolHints),
          snippet: contextSnippet(lines, index)
        });
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
    .filter(scenario => scenario.score >= 1)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);
  for (const scenario of ranked) {
    const key = `${scenario.kind}:${scenario.file}`;
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
  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length, index + 3);
  return lines.slice(start, end).join("\n").trim();
}

function buildPrompt(kind: ScenarioKind, toolHints: string[]): string {
  return [
    `Act as a mathematician using ai4math for a local paper-assistance task of kind ${kind}.`,
    "Assume the global proof framework is already known.",
    `Prefer these tools when applicable: ${toolHints.join(", ")}.`,
    "Use at most three tool calls.",
    "If the excerpt does not contain a concrete expression to check, do not invent one; report the missing local data instead.",
    "Return selected local checks, analytic assumptions still requiring the author, and one concrete improvement request for the assistant."
  ].join(" ");
}

function scoreScenario(lines: string[], index: number): number {
  const snippet = contextSnippet(lines, index);
  let score = 0;
  if (/\\begin\{(?:equation|align|aligned|lemma|proposition|theorem)\}|\$\$|\\\[|\\eqref|\\label/.test(snippet)) score += 3;
  if (/[=<>]|\\le|\\ge|\\sum|\\int|\\Delta|D\^2|S_\{|\\nabla|\\partial/.test(snippet)) score += 2;
  if (/constant|choose|sufficiently|boundary|operator|coefficient|estimate|inequality|假设|边界|常数|估计/.test(snippet)) score += 1;
  if (/paper\s+is\s+organized|this\s+paper\s+is\s+organized|bibliography|abstract|本文结构|本文安排/i.test(snippet)) score -= 4;
  if (snippet.length < 80) score -= 1;
  return score;
}

function renderMarkdown(scenarios: Scenario[]): string {
  const lines = ["# Paper Assist Scenarios", ""];
  for (const scenario of scenarios) {
    lines.push(`## ${scenario.kind}`);
    lines.push("");
    lines.push(`- file: ${scenario.file}`);
    lines.push(`- line: ${scenario.line}`);
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
