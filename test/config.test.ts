import assert from "node:assert/strict";
import { validateConfigPayload } from "../src/config.js";

assert.deepEqual(validateConfigPayload({
  openai: {
    apiKey: "key",
    model: "model",
    maxIterations: 10,
    temperature: 0
  },
  wolfram: {
    backendMode: "oneshot",
    bootstrapStdin: null
  },
  hooks: {
    mode: "hint",
    promptMaxChars: 1200,
    beforeFinal: "warning"
  }
}), []);

const diagnostics = validateConfigPayload({
  unknown: {},
  openai: {
    model: 123,
    typo: true
  },
  hooks: {
    mode: "loud",
    beforeFinal: "always"
  },
  wolfram: []
});

assert.ok(diagnostics.some(item => item.message.includes("Unknown config section: unknown")));
assert.ok(diagnostics.some(item => item.message.includes("openai.model must be string")));
assert.ok(diagnostics.some(item => item.message.includes("Unknown config key: openai.typo")));
assert.ok(diagnostics.some(item => item.message.includes("hooks.mode must be one of")));
assert.ok(diagnostics.some(item => item.message.includes("hooks.beforeFinal must be one of")));
assert.ok(diagnostics.some(item => item.message.includes("wolfram") && item.level === "error"));

console.log("config tests passed");
