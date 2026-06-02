import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { applyRuntimeOptions } from "../src/cli/runtime.js";

const originalTemperature = config.temperature;
const originalMaxIterations = config.maxIterations;

try {
  applyRuntimeOptions({ temperature: 0.25, maxIterations: 7 });
  assert.equal(config.temperature, 0.25);
  assert.equal(config.maxIterations, 7);

  assert.throws(() => applyRuntimeOptions({ temperature: -0.1 }), /temperature/);
  assert.throws(() => applyRuntimeOptions({ temperature: 3 }), /temperature/);
  assert.throws(() => applyRuntimeOptions({ maxIterations: 0 }), /max-iterations/);
  assert.throws(() => applyRuntimeOptions({ maxIterations: 1.5 }), /max-iterations/);

  console.log("runtime tests passed");
} finally {
  config.temperature = originalTemperature;
  config.maxIterations = originalMaxIterations;
}
