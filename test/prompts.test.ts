import assert from "node:assert/strict";
import { buildAgentSystemPrompt, buildPlannerPrompt } from "../src/agent/prompts.js";

const system = buildAgentSystemPrompt({ systemAddendum: "Custom system prompt marker." });
assert.match(system, /Inequality proof policy/);
assert.match(system, /Custom system prompt marker/);
assert.match(system, /inequality_engine/);

const planner = buildPlannerPrompt("Base planner prompt.", { plannerAddendum: "Custom planner prompt marker." });
assert.match(planner, /Base planner prompt/);
assert.match(planner, /Planner-specific policy/);
assert.match(planner, /Custom planner prompt marker/);

console.log("prompt tests passed");
