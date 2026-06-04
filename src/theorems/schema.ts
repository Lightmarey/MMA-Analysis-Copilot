import fs from "node:fs";
import path from "node:path";

export type TheoremDraft = {
  id: string;
  name: string;
  domains: string[];
  keywords: string[];
  signals?: string[];
  reduces?: string;
  prerequisites?: string[];
  invariantHints?: string[];
  verificationHints?: string[];
  preferredRecipe?: string[];
  avoidPatterns?: string[];
  wolframHint?: string;
  casHint?: string;
  confidence?: "low" | "medium" | "high";
};

export type LintIssue = {
  file: string;
  id?: string;
  message: string;
};

export const knownWolframTools = [
  "proof_pattern_engine",
  "inequality_engine",
  "wolfram_eval",
  "wolfram_simplify",
  "wolfram_integrate",
  "wolfram_differentiate",
  "wolfram_limit",
  "wolfram_solve",
  "wolfram_algebra",
  "wolfram_matrix",
  "wolfram_series",
  "wolfram_sum",
  "wolfram_convergence",
  "wolfram_dsolve",
  "wolfram_transform",
  "wolfram_residue"
];

export function createTheoremDraft(input: {
  name: string;
  domains: string[];
  keywords: string[];
  id?: string;
  wolframHint?: string;
}): TheoremDraft {
  const id = input.id || toSnakeCase(input.name);
  const domains = unique(input.domains);
  const keywords = unique([input.name, ...input.keywords]);
  return {
    id,
    name: input.name,
    domains,
    keywords,
    signals: keywords.map(keyword => escapeSignal(keyword)),
    reduces: "Describe what this theorem reduces the problem to.",
    prerequisites: ["List hypotheses that must be checked before applying the theorem."],
    invariantHints: ["List quantities or structures to compute before applying the theorem."],
    verificationHints: ["List checks that must appear before the final answer."],
    preferredRecipe: ["Identify hypotheses", "Compute key invariants", "Apply theorem", "Verify conclusion"],
    avoidPatterns: ["Do not apply the theorem before checking its hypotheses."],
    wolframHint: input.wolframHint || "Use structured Wolfram tools to verify algebraic or analytic side conditions.",
    confidence: "medium"
  };
}

export function lintTheoremFiles(files: string[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const seenIds = new Map<string, string>();
  for (const file of files) {
    const payload = readJson(file, issues);
    if (!payload) continue;
    const theorems = extractTheorems(payload);
    if (!theorems) {
      issues.push({ file, message: "Expected a JSON object with a theorems array or a theorem array." });
      continue;
    }
    for (const theorem of theorems) {
      const id = typeof theorem?.id === "string" ? theorem.id : undefined;
      lintOne(file, theorem, issues);
      if (!id) continue;
      const previous = seenIds.get(id);
      if (previous) {
        issues.push({ file, id, message: `Duplicate theorem id also found in ${previous}.` });
      } else {
        seenIds.set(id, file);
      }
    }
  }
  return issues;
}

export function theoremJsonFiles(directory: string): string[] {
  return fs.readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .map(file => path.join(directory, file));
}

function lintOne(file: string, raw: any, issues: LintIssue[]): void {
  const id = typeof raw?.id === "string" ? raw.id : undefined;
  requireString(file, id, "id", raw?.id, issues);
  requireString(file, id, "name", raw?.name, issues);
  requireStringArray(file, id, "domains", raw?.domains, issues);
  requireStringArray(file, id, "keywords", raw?.keywords, issues);
  optionalStringArray(file, id, "signals", raw?.signals, issues);
  optionalStringArray(file, id, "prerequisites", raw?.prerequisites, issues);
  optionalStringArray(file, id, "invariantHints", raw?.invariantHints ?? raw?.invariant_hints, issues);
  optionalStringArray(file, id, "verificationHints", raw?.verificationHints ?? raw?.verification_hints, issues);
  optionalStringArray(file, id, "preferredRecipe", raw?.preferredRecipe ?? raw?.preferred_recipe, issues);
  optionalStringArray(file, id, "avoidPatterns", raw?.avoidPatterns ?? raw?.avoid_patterns, issues);
  if (id && !/^[a-z][a-z0-9_]*$/.test(id)) {
    issues.push({ file, id, message: "id must be snake_case and start with a lowercase letter." });
  }
  for (const signal of stringArray(raw?.signals)) {
    try {
      new RegExp(signal, "i");
    } catch {
      issues.push({ file, id, message: `Invalid signal regex: ${signal}` });
    }
  }
  const hint = typeof raw?.wolframHint === "string" ? raw.wolframHint : typeof raw?.wolfram_hint === "string" ? raw.wolfram_hint : "";
  for (const match of hint.matchAll(/\bwolfram_[a-z_]+\b/g)) {
    if (!knownWolframTools.includes(match[0])) {
      issues.push({ file, id, message: `wolframHint references unknown tool ${match[0]}.` });
    }
  }
}

function readJson(file: string, issues: LintIssue[]): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch (error) {
    issues.push({ file, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

function extractTheorems(payload: unknown): any[] | null {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as { theorems?: unknown }).theorems)) {
    return (payload as { theorems: any[] }).theorems;
  }
  return null;
}

function requireString(file: string, id: string | undefined, key: string, value: unknown, issues: LintIssue[]): void {
  if (typeof value !== "string" || !value.trim()) {
    issues.push({ file, id, message: `${key} must be a non-empty string.` });
  }
}

function requireStringArray(file: string, id: string | undefined, key: string, value: unknown, issues: LintIssue[]): void {
  if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== "string" || !item.trim())) {
    issues.push({ file, id, message: `${key} must be a non-empty string array.` });
  }
}

function optionalStringArray(file: string, id: string | undefined, key: string, value: unknown, issues: LintIssue[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) {
    issues.push({ file, id, message: `${key} must be a string array when present.` });
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toSnakeCase(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "new_theorem";
}

function escapeSignal(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
