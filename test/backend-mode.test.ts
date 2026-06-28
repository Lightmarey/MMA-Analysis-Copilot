import assert from "node:assert/strict";
import path from "node:path";

const mockWorker = path.resolve("test", "fixtures", "mock-wolfram-worker.cjs");
process.env.WOLFRAM_COMMAND = process.execPath;
process.env.WOLFRAM_WORKER_ARGS = JSON.stringify(mockWorker);
process.env.WOLFRAM_BACKEND_MODE = "worker";
const { WolframBackend } = await import("../src/wolfram/backend.js");

const backend = new WolframBackend();
try {
  const first = await backend.call("wolfram_simplify", {
    expr: "Sin[x]^2 + Cos[x]^2",
    assumptions: "",
    operation: "FullSimplify"
  });
  const second = await backend.call("wolfram_integrate", {
    expr: "x",
    variable: "x",
    lower: "0",
    upper: "1",
    assumptions: ""
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.match(first.output ?? "", /count=1/);
  assert.match(second.output ?? "", /count=2/);
  assert.equal((first.output ?? "").match(/pid=\d+/)?.[0], (second.output ?? "").match(/pid=\d+/)?.[0]);
  console.log("backend mode tests passed");
} finally {
  backend.close();
  delete process.env.WOLFRAM_COMMAND;
  delete process.env.WOLFRAM_WORKER_ARGS;
  delete process.env.WOLFRAM_BACKEND_MODE;
}
