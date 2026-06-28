import assert from "node:assert/strict";
import path from "node:path";

const mockWorker = path.resolve("test", "fixtures", "mock-wolfram-worker.cjs");
process.env.WOLFRAM_COMMAND = process.execPath;
process.env.WOLFRAM_WORKER_ARGS = JSON.stringify(mockWorker);
process.env.WOLFRAM_BACKEND_MODE = "daemon";
process.env.WOLFRAM_DAEMON_PORT = String(41000 + Math.floor(Math.random() * 1000));

const { WolframBackend } = await import("../src/wolfram/backend.js");
const { daemonStatus, startDaemonServer } = await import("../src/wolfram/daemon.js");

const server = await startDaemonServer();
const backend = new WolframBackend(undefined, "daemon");
try {
  const status = await daemonStatus();
  assert.equal(status.ok, true);
  assert.equal(status.output, "running");

  const first = await backend.call("wolfram_simplify", {
    expr: "1 + 1",
    assumptions: "",
    operation: "FullSimplify"
  });
  const second = await backend.call("wolfram_limit", {
    expr: "Sin[x]/x",
    variable: "x",
    point: "0",
    assumptions: "",
    direction: ""
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.match(first.output ?? "", /count=1/);
  assert.match(second.output ?? "", /count=2/);
  console.log("daemon tests passed");
} finally {
  backend.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
  delete process.env.WOLFRAM_COMMAND;
  delete process.env.WOLFRAM_WORKER_ARGS;
  delete process.env.WOLFRAM_BACKEND_MODE;
  delete process.env.WOLFRAM_DAEMON_PORT;
}
