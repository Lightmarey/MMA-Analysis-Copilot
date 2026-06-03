import assert from "node:assert/strict";
import { resolveModelRouteFromIds } from "../src/agent/model-routing.js";

const route = resolveModelRouteFromIds(
  ["deepseek-reasoner", "deepseek-chat"],
  {
    model: "deepseek-chat",
    flashModel: "missing-flash",
    proModel: "missing-pro"
  }
);

assert.equal(route.defaultModel, "deepseek-chat");
assert.equal(route.flashModel, "deepseek-chat");
assert.equal(route.proModel, "deepseek-reasoner");

const explicit = resolveModelRouteFromIds(
  ["provider-fast", "provider-pro"],
  {
    model: "provider-pro",
    flashModel: "provider-fast",
    proModel: "provider-pro"
  }
);

assert.equal(explicit.flashModel, "provider-fast");
assert.equal(explicit.proModel, "provider-pro");

console.log("model routing tests passed");
