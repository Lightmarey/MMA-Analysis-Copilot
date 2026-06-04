import assert from "node:assert/strict";
import { buildAgentSystemPrompt, buildPlannerPrompt } from "../src/agent/prompts.js";
import { toolDefinitions } from "../src/agent/tools.js";

const system = buildAgentSystemPrompt({ systemAddendum: "Custom system prompt marker." });
assert.match(system, /Proof evidence policy/);
assert.match(system, /Custom system prompt marker/);
assert.match(system, /proof_pattern_engine/);

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
assert.match(simplifyTool.description, /Do not use it to choose a proof rule/);

console.log("prompt tests passed");
