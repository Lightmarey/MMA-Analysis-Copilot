import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  compatWolframToolNames,
  publicAgentToolNames,
  publicWolframToolNames,
  toolDefinitions
} from "../src/agent/tools.js";

const toolDefinitionNames = toolDefinitions.map(tool => tool.name).sort();
assert.deepEqual(toolDefinitionNames, [...publicAgentToolNames].sort());
assert.equal(toolDefinitionNames.includes("inequality_engine"), false);
assert.ok(compatWolframToolNames.includes("inequality_engine"));

const protocol = fs.readFileSync(path.join(process.cwd(), "wolfram", "protocol.wl"), "utf8");
for (const toolName of publicWolframToolNames) {
  assert.match(protocol, new RegExp(`tool === "${toolName}"`), `${toolName} is missing from protocol dispatcher`);
}
assert.match(protocol, /tool === "inequality_engine"/);

console.log("tool registry tests passed");

