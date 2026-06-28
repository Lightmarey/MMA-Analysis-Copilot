import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  compatWolframToolNames,
  publicAgentToolNames,
  publicWolframToolNames,
  toolDefinitions
} from "../src/agent/tools.js";
import { algebraicToolDefinitions } from "../src/agent/tools/definitions/algebraic-tools.js";
import { calculusToolDefinitions } from "../src/agent/tools/definitions/calculus-tools.js";
import { equationSolvingToolDefinitions } from "../src/agent/tools/definitions/equation-solving-tools.js";
import { localToolDefinitions } from "../src/agent/tools/definitions/local-tools.js";
import { proofToolDefinitions } from "../src/agent/tools/definitions/proof-tools.js";
import { transformConvergenceToolDefinitions } from "../src/agent/tools/definitions/transform-convergence-tools.js";

const toolDefinitionNames = toolDefinitions.map(tool => tool.name).sort();
assert.deepEqual(toolDefinitionNames, [...publicAgentToolNames].sort());

assert.deepEqual(toolDefinitions.map(tool => tool.name), [
  "formula_transform",
  "theorem_advisor",
  "verification_template",
  "wolfram_eval",
  "wolfram_simplify",
  "wolfram_equivalence_check",
  "wolfram_integrate",
  "wolfram_differentiate",
  "wolfram_limit",
  "wolfram_solve",
  "wolfram_algebra",
  "wolfram_matrix",
  "wolfram_series",
  "wolfram_sum",
  "series_coefficient_check",
  "wolfram_convergence",
  "wolfram_dsolve",
  "wolfram_transform",
  "wolfram_residue"
]);

const groupedDefinitions = [
  ...proofToolDefinitions,
  ...localToolDefinitions,
  ...algebraicToolDefinitions,
  ...calculusToolDefinitions,
  ...equationSolvingToolDefinitions,
  ...transformConvergenceToolDefinitions
];
const groupedNames = groupedDefinitions.map(tool => tool.name);
assert.equal(new Set(groupedNames).size, groupedNames.length);
assert.deepEqual([...groupedNames].sort(), toolDefinitionNames);

const protocol = fs.readFileSync(path.join(process.cwd(), "wolfram", "protocol.wl"), "utf8");
for (const toolName of publicWolframToolNames) {
  assert.match(protocol, new RegExp(`tool === "${toolName}"`), `${toolName} is missing from protocol dispatcher`);
}
assert.match(protocol, /FormulaTransformEngine`FormulaTransformHandleRequest/);
const formulaTransformRoot = path.join(process.cwd(), "wolfram", "FormulaTransformEngine");
const formulaTransformFiles = [
  "Registry/Rules/Holder.transform.json",
  "Registry/Rules/CauchySchwarz.transform.json",
  "Registry/Rules/Young.transform.json",
  "Registry/Rules/IntegrationByParts.transform.json",
  "Registry/Heuristics/SplitSqrt.heuristic.json",
  "Registry/Heuristics/MultiplyByOne.heuristic.json",
  "Registry/EstimateSeeds/Poincare.seed.json",
  "Registry/EstimateSeeds/Sobolev.seed.json",
  "Registry/StructuralTransforms/DerivativeProduct.structural.json",
  "Registry/StructuralTransforms/CommutatorDerivative.structural.json",
  "Registry/StructuralTransforms/NormalizeByFactor.structural.json",
  "Registry/StructuralTransforms/DropBoundaryTerm.structural.json",
  "Registry/TargetPlanners/YoungAbsorption.planner.json",
  "Registry/TargetPlanners/WeightedHolder.planner.json",
  "Registry/ObligationDischargers/BoundaryVanishes.discharger.json",
  "Registry/ObligationDischargers/FunctionSpaceRegularityDeclaration.discharger.json",
  "Registry/ObligationDischargers/NormalizationDeclaration.discharger.json",
  "Registry/ObligationDischargers/RealValuedDeclaration.discharger.json",
  "Registry/EstimateSeeds/.gitkeep"
];
for (const relativePath of formulaTransformFiles) {
  assert.ok(fs.existsSync(path.join(formulaTransformRoot, ...relativePath.split("/"))), `${relativePath} is missing`);
}

const formulaTransformCompiler = fs.readFileSync(path.join(process.cwd(), "wolfram", "FormulaTransformEngine.wl"), "utf8");
assert.match(formulaTransformCompiler, /CompileFormulaTransformRule/);
assert.match(formulaTransformCompiler, /CompileFormulaHeuristicRule/);
assert.match(formulaTransformCompiler, /CompileFormulaStructuralTransform/);
assert.doesNotMatch(formulaTransformCompiler, /ToExpression\[[^\n]+payload/i);

console.log("tool registry tests passed");