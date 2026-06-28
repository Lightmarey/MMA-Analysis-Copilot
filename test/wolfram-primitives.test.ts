import assert from "node:assert/strict";
import { WolframBackend } from "../src/wolfram/backend.js";

const backend = new WolframBackend();

try {
  // Test MatchAlgebraicStructure
  const matchResult = await backend.call("wolfram_debug_match", {
    expr: "5 * f[x]^2 + 7 * g[y]^3",
    template: "$c1 * $f^$p + $c2 * $g^$q"
  });
  
  assert.equal(matchResult.ok, true);
  assert.equal(typeof matchResult.output, "object");
  assert.equal(matchResult.output["$c1"], 5);
  assert.equal(matchResult.output["$c2"], 7);
  assert.equal(matchResult.output["$p"], 2);
  assert.equal(matchResult.output["$q"], 3);
  
  // Test AlgebraicUnification (FTSolveParameters)
  const unificationResult = await backend.call("wolfram_debug_unification", {
    bindings: {
      "$p": "2",
      "$q": "2",
      "$c1": "theta",
      "$coeff": "1"
    },
    unknowns: ["$epsilon", "$c2"],
    equations: [
      "$c1 == $epsilon * $p^(-1) * $coeff",
      "$c2 == $epsilon^(-$q/$p) * $q^(-1) * $coeff"
    ]
  });
  
  assert.equal(unificationResult.ok, true);
  assert.equal(typeof unificationResult.output, "object");
  assert.equal(unificationResult.output["$epsilon"], "2*theta");
  // $c2 == (2*theta)^(-1) * 1/2 == 1 / (4*theta)
  assert.equal(unificationResult.output["$c2"], "1/(4*theta)");

  console.log("Wolfram primitives test passed!");
} catch (e) {
  console.error("Test failed", e);
  process.exit(1);
} finally {
  backend.close();
}
