import assert from "node:assert/strict";

process.env.WOLFRAM_BACKEND_MODE = "worker";
const { WolframBackend } = await import("../src/wolfram/backend.js");

const backend = new WolframBackend();
try {
  await assert.rejects(
    () => backend.call("wolfram_simplify", {
      expr: "Sin[x]^2 + Cos[x]^2",
      assumptions: "",
      operation: "FullSimplify"
    }),
    /worker is not supported/
  );
  console.log("backend mode tests passed");
} finally {
  backend.close();
  delete process.env.WOLFRAM_BACKEND_MODE;
}
