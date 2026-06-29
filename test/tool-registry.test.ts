import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  type AgentToolName,
  compatWolframToolNames,
  publicAgentToolNames,
  publicWolframToolNames,
  toolDefinitions
} from "../src/agent/tools.js";
import { runLocalTool } from "../src/agent/tools/local.js";
import { algebraicToolDefinitions } from "../src/agent/tools/definitions/algebraic-tools.js";
import { calculusToolDefinitions } from "../src/agent/tools/definitions/calculus-tools.js";
import { equationSolvingToolDefinitions } from "../src/agent/tools/definitions/equation-solving-tools.js";
import { localToolDefinitions } from "../src/agent/tools/definitions/local-tools.js";
import { proofToolDefinitions } from "../src/agent/tools/definitions/proof-tools.js";
import { transformConvergenceToolDefinitions } from "../src/agent/tools/definitions/transform-convergence-tools.js";
import { discoveryToolDefinitions } from "../src/agent/tools/definitions/discovery-tools.js";

const toolDefinitionNames = toolDefinitions.map(tool => tool.name).sort();
assert.deepEqual(toolDefinitionNames, [...publicAgentToolNames].sort());

assert.deepEqual(toolDefinitions.map(tool => tool.name), [
  "formula_transform",
  "load_tool",
  "theorem_advisor",
  "verification_template",
  "delegate_to_subagent",
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
  ...transformConvergenceToolDefinitions,
  ...discoveryToolDefinitions
];
const groupedNames = groupedDefinitions.map(tool => tool.name);
assert.equal(new Set(groupedNames).size, groupedNames.length);
assert.deepEqual([...groupedNames].sort(), toolDefinitionNames);
assert.equal(toolDefinitions.filter(tool => tool.name === "load_tool").length, 1);
assert.equal(toolDefinitions.filter(tool => tool.name === "delegate_to_subagent").length, 1);

const activeToolNames = new Set<AgentToolName>(["load_tool"]);
const loadResult = await runLocalTool({} as never, "load_tool", {
  tool_names: "wolfram_integrate, missing_tool, delegate_to_subagent"
}, {
  activeToolNames,
  blockedToolNames: new Set<AgentToolName>(["delegate_to_subagent"])
});
assert.equal(loadResult.ok, false);
assert.ok(activeToolNames.has("wolfram_integrate"));
assert.equal(activeToolNames.has("delegate_to_subagent"), false);
assert.match(loadResult.output ?? "", /missing_tool \(unknown\)/);
assert.match(loadResult.output ?? "", /delegate_to_subagent \(disabled\)/);

const delegateResult = await runLocalTool({} as never, "delegate_to_subagent", {
  role: "checker",
  task: "check one identity"
}, {
  activeToolNames,
  delegateToSubagent: async args => ({
    id: null,
    ok: true,
    title: "delegate_to_subagent",
    output: `delegated:${String(args.role)}`
  })
});
assert.equal(delegateResult.ok, true);
assert.equal(delegateResult.output, "delegated:checker");

const disabledDelegate = await runLocalTool({} as never, "delegate_to_subagent", {}, { activeToolNames });
assert.equal(disabledDelegate.ok, false);
assert.match(disabledDelegate.error ?? "", /disabled/);

const protocol = fs.readFileSync(path.join(process.cwd(), "wolfram", "protocol.wl"), "utf8");
for (const toolName of publicWolframToolNames) {
  assert.match(protocol, new RegExp(`tool === "${toolName}"`), `${toolName} is missing from protocol dispatcher`);
}
assert.match(protocol, /FormulaTransformEngine`FormulaTransformHandleRequest/);
const formulaTransformRoot = path.resolve(process.cwd(), "..", "FormulaTransformEngine");
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

const formulaTransformCompiler = fs.readFileSync(path.join(formulaTransformRoot, "FormulaTransformEngine", "FormulaTransformEngine.wl"), "utf8");
assert.match(formulaTransformCompiler, /CompileFormulaTransformRule/);
assert.match(formulaTransformCompiler, /CompileFormulaHeuristicRule/);
assert.match(formulaTransformCompiler, /CompileFormulaStructuralTransform/);
assert.doesNotMatch(formulaTransformCompiler, /ToExpression\[[^\n]+payload/i);

console.log("tool registry tests passed");
