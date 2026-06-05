import assert from "node:assert/strict";
import { buildAgentSystemPrompt, buildPlannerPrompt } from "../src/agent/prompts.js";
import { toolDefinitions } from "../src/agent/tools.js";

const system = buildAgentSystemPrompt({ systemAddendum: "Custom system prompt marker." });
assert.match(system, /Proof evidence policy/);
assert.match(system, /Custom system prompt marker/);
assert.match(system, /proof_pattern_engine/);
assert.match(system, /Do not use Wolfram tools to read local files/);
assert.match(system, /verification ledger/);
assert.match(system, /Avoid underscores in Wolfram symbol names/);
assert.match(system, /one to five explicit expressions/);
assert.match(system, /original and rescaled variables/);
assert.match(system, /do not use SameQ\/===/);
assert.match(system, /hypotheses in the tool assumptions field/);
assert.match(system, /Do not call wolfram_solve with variables=\{\}/);
assert.match(system, /dimensionless substitution d = a\*q/);

const planner = buildPlannerPrompt("Base planner prompt.", { plannerAddendum: "Custom planner prompt marker." });
assert.match(planner, /Base planner prompt/);
assert.match(planner, /Planner-specific policy/);
assert.match(planner, /Custom planner prompt marker/);

const inequalityTool = toolDefinitions.find(tool => tool.name === "proof_pattern_engine");
assert.ok(inequalityTool);
assert.match(inequalityTool.description, /proof rule\/transform engine/);
assert.match(inequalityTool.description, /integration by parts/);
assert.match(inequalityTool.description, /compile restricted inert LLM move schemas/);
const operationProperty = inequalityTool.schema.function.parameters.properties.operation;
assert.ok((operationProperty.enum as string[]).includes("compile"));
assert.equal(toolDefinitions.some(tool => tool.name === "inequality_engine"), false);

const simplifyTool = toolDefinitions.find(tool => tool.name === "wolfram_simplify");
assert.ok(simplifyTool);
assert.match(simplifyTool.description, /analytic/);
assert.match(simplifyTool.description, /prefer wolfram_solve with method Reduce/);
assert.match(simplifyTool.description, /simplify Equivalent/);
assert.match(simplifyTool.description, /place the hypotheses in assumptions/);
assert.match(simplifyTool.description, /radial Laplacians may put D\[\.\.\.\] directly in expr/);
assert.match(simplifyTool.description, /not wolfram_algebra, for plain Simplify/);
assert.match(simplifyTool.description, /dimensionless substitution like d -> a\*q/);
assert.match(simplifyTool.description, /Do not use it to choose a proof rule/);
assert.match(simplifyTool.schema.function.parameters.properties.expr.description, /Do not include Assumptions ->/);
assert.match(simplifyTool.schema.function.parameters.properties.assumptions.description, /Put hypotheses here/);

const solveTool = toolDefinitions.find(tool => tool.name === "wolfram_solve");
assert.ok(solveTool);
assert.match(solveTool.description, /conditional inequality equivalence/);
assert.match(solveTool.description, /log\/exponential rearrangements/);
assert.match(solveTool.description, /instead of variables=\{\}/);
assert.match(solveTool.schema.function.parameters.properties.variables.description, /do not use \{\}/);

const algebraTool = toolDefinitions.find(tool => tool.name === "wolfram_algebra");
assert.ok(algebraTool);
assert.match(algebraTool.description, /named algebraic expression transformations/);
assert.match(algebraTool.description, /use wolfram_simplify instead/);

const verificationTool = toolDefinitions.find(tool => tool.name === "verification_template");
assert.ok(verificationTool);
assert.match(verificationTool.description, /scaling power\/exponent checks/);
assert.ok((verificationTool.schema.function.parameters.properties.template.enum as string[]).includes("scaling_power_check"));
assert.ok((verificationTool.schema.function.parameters.properties.template.enum as string[]).includes("substitution_check"));
assert.match(verificationTool.schema.function.parameters.properties.template.description, /exponent cancellation/);
assert.match(verificationTool.schema.function.parameters.properties.template.description, /applying explicit rules/);

const evalTool = toolDefinitions.find(tool => tool.name === "wolfram_eval");
assert.ok(evalTool);
assert.match(evalTool.description, /Do not use this for simple Simplify/);
assert.match(evalTool.description, /use wolfram_solve/);
assert.match(evalTool.description, /Do not use this tool to read local files/);

console.log("prompt tests passed");
