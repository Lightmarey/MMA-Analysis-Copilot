import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import {
  formulaRegistryTargetPath,
  inferFormulaRegistryKind,
  lintFormulaRegistryCandidate,
  lintFormulaRegistry,
  type FormulaRegistryIssue
} from "../formula-transform/registry-schema.js";
import { WolframBackend } from "../wolfram/backend.js";

export function runFormulaRegistryLint(): void {
  const issues = lintFormulaRegistry(config.rootDir, config.formulaTransformEnginePath);
  if (issues.length) {
    printIssues(issues);
    process.exit(1);
    return;
  }
  console.log("formula registry lint passed");
}

export function runFormulaRegistryDiff(file: string): void {
  const incomingPath = path.resolve(file);
  const incoming = readJson(incomingPath);
  const suffix = inferFormulaRegistryKind(incomingPath, incoming);
  if (!suffix) {
    throw new Error(`Cannot infer formula registry kind for ${file}`);
  }
  const name = typeof incoming.name === "string" && incoming.name.trim() ? incoming.name.trim() : path.basename(incomingPath, suffix.suffix);
  const installedPath = formulaRegistryTargetPath(config.rootDir, suffix, name, config.formulaTransformEnginePath);
  if (!fs.existsSync(installedPath)) {
    console.log(`new ${suffix.key}: ${name}`);
    console.log(`target: ${installedPath}`);
    console.log(`keys: ${Object.keys(incoming).sort().join(", ")}`);
    return;
  }
  const installed = readJson(installedPath);
  const incomingText = stableJson(incoming);
  const installedText = stableJson(installed);
  if (incomingText === installedText) {
    console.log(`unchanged ${suffix.key}: ${name}`);
    console.log(`target: ${installedPath}`);
    return;
  }
  const incomingKeys = Object.keys(incoming).sort();
  const installedKeys = Object.keys(installed).sort();
  const changedKeys = incomingKeys.filter(key => stableJson(incoming[key]) !== stableJson(installed[key]));
  const addedKeys = incomingKeys.filter(key => !installedKeys.includes(key));
  const removedKeys = installedKeys.filter(key => !incomingKeys.includes(key));
  console.log(`changed ${suffix.key}: ${name}`);
  console.log(`target: ${installedPath}`);
  if (changedKeys.length) console.log(`changed keys: ${changedKeys.join(", ")}`);
  if (addedKeys.length) console.log(`added keys: ${addedKeys.join(", ")}`);
  if (removedKeys.length) console.log(`removed keys: ${removedKeys.join(", ")}`);
}

export async function runFormulaRegistryTest(file: string): Promise<void> {
  const incomingPath = path.resolve(file);
  const payload = readJson(incomingPath);
  const issues = lintFormulaRegistryCandidate(incomingPath, payload);
  if (issues.length) {
    printIssues(issues);
    process.exit(1);
    return;
  }
  const kind = inferFormulaRegistryKind(incomingPath, payload);
  if (!kind) throw new Error(`Cannot infer formula registry kind for ${file}`);
  const compileAction = compileActionForKind(kind.key);
  const backend = new WolframBackend();
  try {
    const compiled = await backend.call("formula_transform", {
      action: compileAction,
      formula: "",
      rule: "",
      direction: "Auto",
      part: "Whole",
      parameters: "",
      assumptions: "",
      context: "",
      state: "",
      payload: JSON.stringify(payload)
    });
    if (!compiled.ok || !compiled.output?.includes("Compiled")) {
      console.error(compiled.error ?? compiled.output ?? "candidate compile failed");
      process.exit(1);
      return;
    }
    const exampleCount = await runExamples(backend, payload);
    console.log(`formula registry candidate test passed (${kind.key}: ${payload.name}, examples=${exampleCount})`);
  } finally {
    backend.close();
  }
}

export async function runFormulaRegistryPersist(file: string, options: { force?: boolean; reload?: boolean }): Promise<void> {
  const incomingPath = path.resolve(file);
  const payload = readJson(incomingPath);
  const issues = lintFormulaRegistryCandidate(incomingPath, payload);
  if (issues.length) {
    printIssues(issues);
    process.exit(1);
    return;
  }
  await runFormulaRegistryTest(incomingPath);
  if (process.exitCode) return;
  const persisted = persistFormulaRegistryCandidate(incomingPath, config.rootDir, {
    force: options.force,
    formulaTransformEnginePath: config.formulaTransformEnginePath
  });
  console.log(`persisted ${persisted.kind}: ${persisted.name}`);
  console.log(`target: ${persisted.targetPath}`);
  if (options.reload) {
    const backend = new WolframBackend();
    try {
      const reloaded = await backend.call("formula_transform", {
        action: "reload_registry",
        formula: "",
        rule: "",
        direction: "Auto",
        part: "Whole",
        parameters: "",
        assumptions: "",
        context: "",
        state: "",
        payload: ""
      });
      if (!reloaded.ok) throw new Error(reloaded.error ?? "reload_registry failed");
      console.log("formula registry reloaded");
    } finally {
      backend.close();
    }
  }
}

export function persistFormulaRegistryCandidate(file: string, rootDir: string, options: { force?: boolean; formulaTransformEnginePath?: string } = {}): { kind: string; name: string; targetPath: string } {
  const incomingPath = path.resolve(file);
  const payload = readJson(incomingPath);
  const issues = lintFormulaRegistryCandidate(incomingPath, payload);
  if (issues.length) {
    throw new Error(issues.map(issue => `${issue.file}: ${issue.message}`).join("\n"));
  }
  const kind = inferFormulaRegistryKind(incomingPath, payload);
  if (!kind) throw new Error(`Cannot infer formula registry kind for ${file}`);
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : path.basename(incomingPath, kind.suffix);
  const installedPath = formulaRegistryTargetPath(rootDir, kind, name, options.formulaTransformEnginePath);
  if (fs.existsSync(installedPath) && !options.force && stableJson(readJson(installedPath)) !== stableJson(payload)) {
    throw new Error(`${installedPath} already exists with different content; rerun with --force to overwrite.`);
  }
  fs.mkdirSync(path.dirname(installedPath), { recursive: true });
  fs.writeFileSync(installedPath, `${JSON.stringify(sortJson(payload), null, 2)}\n`);
  return { kind: kind.key, name, targetPath: installedPath };
}

function printIssues(issues: FormulaRegistryIssue[]): void {
  for (const issue of issues) {
    const name = issue.name ? ` [${issue.name}]` : "";
    console.error(`${issue.file}${name}: ${issue.message}`);
  }
}

function readJson(file: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>;
}

function compileActionForKind(kind: string): string {
  switch (kind) {
    case "rule":
      return "compile_rule";
    case "heuristic":
      return "compile_heuristic";
    case "estimate-seed":
      return "compile_seed";
    case "structural-transform":
      return "compile_structural";
    case "target-planner":
      return "compile_planner";
    case "obligation-discharger":
      return "compile_discharger";
    default:
      throw new Error(`Unsupported formula registry kind ${kind}`);
  }
}

async function runExamples(backend: WolframBackend, payload: Record<string, any>): Promise<number> {
  const examples = Array.isArray(payload.examples) ? payload.examples : [];
  for (const [index, example] of examples.entries()) {
    if (!example || typeof example !== "object") {
      throw new Error(`examples[${index}] must be an object.`);
    }
    const args = {
      action: "apply",
      formula: "",
      rule: typeof payload.name === "string" ? payload.name : "",
      direction: "Auto",
      part: "Whole",
      parameters: "",
      assumptions: "",
      context: "",
      state: "",
      payload: "",
      ...example.args
    };
    const result = await backend.call("formula_transform", args);
    if (!result.ok) throw new Error(`examples[${index}] failed: ${result.error ?? result.output ?? "unknown error"}`);
    const contains = typeof example.outputContains === "string" ? [example.outputContains] : Array.isArray(example.outputContains) ? example.outputContains : [];
    for (const expected of contains) {
      if (typeof expected === "string" && !result.output?.includes(expected)) {
        throw new Error(`examples[${index}] output did not contain ${expected}`);
      }
    }
  }
  return examples.length;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)])
  );
}
