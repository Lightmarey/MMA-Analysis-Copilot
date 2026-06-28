import fs from "node:fs";
import path from "node:path";

export type FormulaRegistryIssue = {
  file: string;
  name?: string;
  message: string;
};

export type FormulaRegistryKind = {
  key: string;
  directory: string;
  suffix: string;
  kind?: string;
};

export const formulaRegistryKinds: FormulaRegistryKind[] = [
  { key: "rule", directory: "Rules", suffix: ".transform.json" },
  { key: "heuristic", directory: "Heuristics", suffix: ".heuristic.json" },
  { key: "estimate-seed", directory: "EstimateSeeds", suffix: ".seed.json", kind: "EstimateSeed" },
  { key: "structural-transform", directory: "StructuralTransforms", suffix: ".structural.json", kind: "StructuralTransform" },
  { key: "target-planner", directory: "TargetPlanners", suffix: ".planner.json", kind: "TargetPlanner" },
  { key: "obligation-discharger", directory: "ObligationDischargers", suffix: ".discharger.json", kind: "ObligationDischarger" }
];

const allowedRuntimes = new Set([
  "GenericTemplate",
  "GenericStructural",
  "HolderLike",
  "Young",
  "IntegrationByParts",
  "WeightedHolder",
  "YoungAbsorption",
  "GenericTargetPlanner"
]);

const allowedTargetPlannerPrimitives = new Set([
  "ParseTargetRelation",
  "MatchTargetLHS",
  "ExtractProductFactors",
  "InferAbsorbedQuadraticFactor",
  "InferResidualFactor",
  "ComputeProductCoefficient",
  "BuildResidualCoefficientCondition",
  "ParseIntegralOrSumProduct",
  "ParseWeightParameter",
  "InferWeightFromNormPair",
  "BuildWeightedHolderBound",
  "BuildWeightPositiveCondition",
  "BuildFunctionSpaceObligations"
]);

const forbiddenJsonText = [
  "ToExpression",
  "Get[",
  "Import[",
  "Run[",
  "CreateFile[",
  "DeleteFile[",
  "Put[",
  "SetDelayed[",
  ":>",
  "CompoundExpression"
];

export function formulaRegistryRoot(rootDir: string): string {
  return path.join(rootDir, "wolfram", "FormulaTransformEngine", "Registry");
}

export function inferFormulaRegistryKind(file: string, payload?: Record<string, unknown>): FormulaRegistryKind | undefined {
  const bySuffix = formulaRegistryKinds.find(kind => file.endsWith(kind.suffix));
  if (bySuffix) return bySuffix;
  const kindName = typeof payload?.kind === "string" ? payload.kind : "";
  return formulaRegistryKinds.find(kind => kind.kind === kindName);
}

export function formulaRegistryTargetPath(rootDir: string, kind: FormulaRegistryKind, name: string): string {
  return path.join(formulaRegistryRoot(rootDir), kind.directory, `${name}${kind.suffix}`);
}

export function formulaRegistryJsonFiles(rootDir: string): string[] {
  const registryRoot = formulaRegistryRoot(rootDir);
  return formulaRegistryKinds.flatMap(kind => {
    const directory = path.join(registryRoot, kind.directory);
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory)
      .filter(file => file.endsWith(kind.suffix))
      .map(file => path.join(directory, file));
  });
}

export function lintFormulaRegistryCandidate(file: string, payload: unknown): FormulaRegistryIssue[] {
  const kind = inferFormulaRegistryKind(file, isRecord(payload) ? payload : undefined);
  if (!kind) return [{ file, message: "Cannot infer registry kind from file suffix or payload kind." }];
  const issues: FormulaRegistryIssue[] = [];
  lintRegistryEntry(file, kind, payload, issues);
  return issues;
}

export function lintFormulaRegistry(rootDir: string): FormulaRegistryIssue[] {
  const registryRoot = formulaRegistryRoot(rootDir);
  const issues: FormulaRegistryIssue[] = [];
  for (const kind of formulaRegistryKinds) {
    const directory = path.join(registryRoot, kind.directory);
    if (!fs.existsSync(directory)) {
      issues.push({ file: directory, message: `Missing registry directory ${kind.directory}.` });
      continue;
    }
    const files = fs.readdirSync(directory).filter(file => file.endsWith(kind.suffix));
    for (const file of files) {
      const fullPath = path.join(directory, file);
      const raw = readJson(fullPath, issues);
      if (!raw) continue;
      lintRegistryEntry(fullPath, kind, raw, issues);
    }
  }
  return issues;
}

function lintRegistryEntry(file: string, kind: FormulaRegistryKind, raw: unknown, issues: FormulaRegistryIssue[]): void {
  if (!isRecord(raw)) {
    issues.push({ file, message: "Registry entry must be a JSON object." });
    return;
  }
  const name = stringValue(raw.name);
  requireString(file, name, "name", raw.name, issues);
  requireNumber(file, name, "schemaVersion", raw.schemaVersion, issues);
  if (kind.kind && raw.kind !== kind.kind) {
    issues.push({ file, name, message: `kind must be ${kind.kind}.` });
  }
  if (name && !/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    issues.push({ file, name, message: "name must be PascalCase alphanumeric." });
  }
  lintForbiddenText(file, name, raw, issues);
  lintTemplateStringSyntax(file, name, raw, issues);
  lintOrientations(file, name, raw, issues);
  lintByKind(file, kind.key, raw, issues);
}

function lintByKind(file: string, kind: string, raw: Record<string, unknown>, issues: FormulaRegistryIssue[]): void {
  const name = stringValue(raw.name);
  switch (kind) {
    case "rule":
      lintRuntime(file, name, raw.runtime, issues);
      if (!stringValue(raw.extends)) {
        requireObjectArray(file, name, "matchers", raw.matchers, issues);
        requireObjectArray(file, name, "orientations", raw.orientations, issues);
      }
      optionalConditionArray(file, name, "conditions", raw.conditions, issues);
      optionalConditionArray(file, name, "overrideConditions", raw.overrideConditions, issues);
      optionalStringArray(file, name, "compatibleHeuristics", raw.compatibleHeuristics, issues);
      break;
    case "heuristic":
      requireObjectArray(file, name, "matchers", raw.matchers, issues);
      if (!isRecord(raw.rewrite) || !stringValue(raw.rewrite.template)) {
        issues.push({ file, name, message: "rewrite.template must be a non-empty string." });
      }
      optionalConditionArray(file, name, "conditions", raw.conditions, issues);
      optionalStringArray(file, name, "appliesTo", raw.appliesTo, issues);
      optionalNumber(file, name, "cost", raw.cost, issues);
      optionalNumber(file, name, "maxApplications", raw.maxApplications, issues);
      break;
    case "estimate-seed":
      if (!isRecord(raw.template) || !stringValue(raw.template.relation)) {
        issues.push({ file, name, message: "template.relation must be a non-empty string." });
      }
      requireConditionArray(file, name, "conditions", raw.conditions, issues);
      optionalStringArray(file, name, "parameterExpressions", raw.parameterExpressions, issues);
      optionalStringArray(file, name, "appliesTo", raw.appliesTo, issues);
      break;
    case "structural-transform":
      lintRuntime(file, name, raw.runtime, issues);
      if (raw.runtime === "GenericStructural") {
        requireObjectArray(file, name, "matchers", raw.matchers, issues);
        requireObjectArray(file, name, "orientations", raw.orientations, issues);
      }
      optionalStringArray(file, name, "parameterExpressions", raw.parameterExpressions, issues);
      optionalStringArray(file, name, "appliesTo", raw.appliesTo, issues);
      break;
    case "target-planner":
      lintRuntime(file, name, raw.runtime, issues);
      optionalStringArray(file, name, "rules", raw.rules, issues);
      optionalStringArray(file, name, "families", raw.families, issues);
      optionalStringArray(file, name, "primitives", raw.primitives, issues);
      for (const primitive of stringArray(raw.primitives)) {
        if (!allowedTargetPlannerPrimitives.has(primitive)) {
          issues.push({ file, name, message: `Unknown target planner primitive ${primitive}.` });
        }
      }
      if (raw.registryMutation !== false) {
        issues.push({ file, name, message: "target planners must declare registryMutation: false." });
      }
      break;
    case "obligation-discharger":
      if (!raw.matchesObligation) {
        issues.push({ file, name, message: "matchesObligation is required." });
      }
      requireObjectArray(file, name, "evidence", raw.evidence, issues);
      for (const [index, evidence] of objectArray(raw.evidence).entries()) {
        lintEvidence(file, name, index, evidence, issues);
      }
      optionalStringArray(file, name, "evidenceText", raw.evidenceText, issues);
      break;
  }
}

function lintEvidence(file: string, name: string | undefined, index: number, evidence: Record<string, unknown>, issues: FormulaRegistryIssue[]): void {
  const source = stringValue(evidence.source);
  if (!["assumptions", "context"].includes(source ?? "")) {
    issues.push({ file, name, message: `evidence[${index}].source must be assumptions or context.` });
  }
  const containsAny = stringArray(evidence.containsAny);
  const containsAll = stringArray(evidence.containsAll);
  if (!containsAny.length && !containsAll.length) {
    issues.push({ file, name, message: `evidence[${index}] must declare containsAny or containsAll.` });
  }
}

function lintRuntime(file: string, name: string | undefined, runtime: unknown, issues: FormulaRegistryIssue[]): void {
  const value = stringValue(runtime);
  if (!value) return;
  if (!allowedRuntimes.has(value)) {
    issues.push({ file, name, message: `Unknown runtime ${value}.` });
  }
}

function lintOrientations(file: string, name: string | undefined, raw: Record<string, unknown>, issues: FormulaRegistryIssue[]): void {
  const orientations = raw.orientations;
  if (!Array.isArray(orientations)) return;
  for (const orientation of orientations) {
    if (!isRecord(orientation)) continue;
    const orientationName = stringValue(orientation.name) ?? "unnamed";
    const direction = stringValue(orientation.direction) ?? "Auto";
    const relation = stringValue(orientation.relation) ?? "";
    if (!["Upper", "Lower", "TwoSided", "Equal", "Auto"].includes(direction)) {
      issues.push({ file, name, message: `orientation ${orientationName} has unsupported direction ${direction}.` });
    }
    if (relation && !["LessEqual", "LessEqualChain", "Equal"].includes(relation)) {
      issues.push({ file, name, message: `orientation ${orientationName} has unsupported relation ${relation}.` });
    }
    if (direction === "Equal" && relation && relation !== "Equal") {
      issues.push({ file, name, message: `orientation ${orientationName} uses direction=Equal with non-equality relation ${relation}.` });
    }
    if (relation === "Equal" && ["Upper", "Lower", "TwoSided"].includes(direction)) {
      issues.push({ file, name, message: `orientation ${orientationName} uses inequality direction with relation=Equal.` });
    }
    if (relation === "LessEqual" && (!("lhs" in orientation) || !("rhs" in orientation))) {
      issues.push({ file, name, message: `orientation ${orientationName} relation=LessEqual requires lhs and rhs.` });
    }
    if (relation === "LessEqualChain" && (!Array.isArray(orientation.terms) || orientation.terms.length < 3)) {
      issues.push({ file, name, message: `orientation ${orientationName} relation=LessEqualChain requires at least three terms.` });
    }
    if (raw.kind === "StructuralTransform" && relation && relation !== "Equal") {
      issues.push({ file, name, message: `structural orientation ${orientationName} must use relation=Equal.` });
    }
  }
}

function lintForbiddenText(file: string, name: string | undefined, raw: unknown, issues: FormulaRegistryIssue[]): void {
  const text = JSON.stringify(raw);
  for (const forbidden of forbiddenJsonText) {
    if (text.includes(forbidden)) {
      issues.push({ file, name, message: `Forbidden Wolfram code token ${forbidden} found in JSON.` });
    }
  }
}

function lintTemplateStringSyntax(file: string, name: string | undefined, raw: unknown, issues: FormulaRegistryIssue[]): void {
  for (const value of collectStrings(raw)) {
    if (!value.includes("[") && !value.includes("]")) continue;
    const issue = bracketIssue(value);
    if (issue) issues.push({ file, name, message: `Malformed template string '${value}': ${issue}.` });
  }
}

function bracketIssue(value: string): string | undefined {
  let depth = 0;
  for (const char of value) {
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth < 0) return "unexpected closing bracket";
    }
  }
  return depth === 0 ? undefined : "unclosed bracket";
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(collectStrings);
}

function readJson(file: string, issues: FormulaRegistryIssue[]): unknown {
  try {
    return JSON.parse(stripBom(fs.readFileSync(file, "utf8"))) as unknown;
  } catch (error) {
    issues.push({ file, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function requireString(file: string, name: string | undefined, key: string, value: unknown, issues: FormulaRegistryIssue[]): void {
  if (!stringValue(value)) {
    issues.push({ file, name, message: `${key} must be a non-empty string.` });
  }
}

function requireNumber(file: string, name: string | undefined, key: string, value: unknown, issues: FormulaRegistryIssue[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ file, name, message: `${key} must be a finite number.` });
  }
}

function optionalNumber(file: string, name: string | undefined, key: string, value: unknown, issues: FormulaRegistryIssue[]): void {
  if (value === undefined) return;
  requireNumber(file, name, key, value, issues);
}

function requireArray(file: string, name: string | undefined, key: string, value: unknown, issues: FormulaRegistryIssue[]): void {
  if (!Array.isArray(value) || !value.length) {
    issues.push({ file, name, message: `${key} must be a non-empty array.` });
  }
}

function requireObjectArray(file: string, name: string | undefined, key: string, value: unknown, issues: FormulaRegistryIssue[]): void {
  if (!objectArray(value).length) {
    issues.push({ file, name, message: `${key} must be a non-empty object array.` });
  }
}

function optionalStringArray(file: string, name: string | undefined, key: string, value: unknown, issues: FormulaRegistryIssue[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) {
    issues.push({ file, name, message: `${key} must be a string array when present.` });
  }
}

function optionalConditionArray(file: string, name: string | undefined, key: string, value: unknown, issues: FormulaRegistryIssue[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(item => {
    if (typeof item === "string" && item.trim()) return false;
    if (isRecord(item) && typeof item.predicate === "string" && Array.isArray(item.arguments)) return false;
    if (isRecord(item) && typeof item.kind === "string" && typeof item.expr === "string") return false;
    return true;
  })) {
    issues.push({ file, name, message: `${key} must be a condition array (string, predicate object, or kind/expr object) when present.` });
  }
}

function requireConditionArray(file: string, name: string | undefined, key: string, value: unknown, issues: FormulaRegistryIssue[]): void {
  if (!Array.isArray(value) || !value.length || value.some(item => {
    if (typeof item === "string" && item.trim()) return false;
    if (isRecord(item) && typeof item.predicate === "string" && Array.isArray(item.arguments)) return false;
    if (isRecord(item) && typeof item.kind === "string" && typeof item.expr === "string") return false;
    return true;
  })) {
    issues.push({ file, name, message: `${key} must be a non-empty condition array (string, predicate object, or kind/expr object).` });
  }
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item.trim()) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
