import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { analyzeProblem, buildPreplanContext, classifyDifficulty, createPreplan, decomposeProblem, loadTheorems } from "../src/agent/planning.js";

const dctProblem = "Show that the limit may pass under the integral because f_n converges pointwise and is dominated by Exp[-x] on [0, Infinity).";
const dctAnalysis = analyzeProblem(dctProblem);
assert.ok(dctAnalysis.suggestedTheorems.some(item => item.theorem === "Dominated convergence theorem"));
assert.equal(dctAnalysis.workflow.theoryFirst, true);
assert.equal(classifyDifficulty(dctProblem, dctAnalysis), "complex");
assert.ok(dctAnalysis.suggestedInvariants.some(item => item.includes("dominating function")));
assert.ok(dctAnalysis.verificationChecks.some(item => item.includes("integrability of the bound")));

const residueProblem = "Evaluate a contour integral by finding the residues of 1/(z^2 + 1) at its poles.";
const residueAnalysis = analyzeProblem(residueProblem);
const residuePlan = createPreplan(residueProblem, residueAnalysis);
assert.ok(residueAnalysis.suggestedTheorems.some(item => item.theorem === "Residue theorem"));
assert.ok(residuePlan.recommendedTools.includes("wolfram_residue"));
assert.match(buildPreplanContext(residueAnalysis, residuePlan), /workflow_order: theorem -> invariants -> verification/);

const simpleProblem = "Simplify Sin[x]^2 + Cos[x]^2.";
const simpleAnalysis = analyzeProblem(simpleProblem);
assert.equal(classifyDifficulty(simpleProblem, simpleAnalysis), "simple");

const longProblem = (
  "Let f_n(x) be a sequence of measurable functions on [0, Infinity). Suppose f_n converges pointwise almost everywhere to f. " +
  "Assume |f_n(x)| is dominated by g(x) and g is integrable, then compute the limit of the integrals. " +
  "Furthermore, define a related contour integral with poles at I and -I, and determine the residue contribution."
).repeat(3);
const longAnalysis = analyzeProblem(longProblem);
const decomposition = decomposeProblem(longProblem, longAnalysis);
assert.ok(decomposition);
assert.ok(decomposition.subproblems.length >= 3);
assert.deepEqual(decomposition.dependencyOrder.slice(0, 3), ["sp1", "sp2", "sp3"]);
const longContext = buildPreplanContext(longAnalysis, createPreplan(longProblem, longAnalysis), decomposition);
assert.match(longContext, /Problem decomposition/);
assert.match(longContext, /dependency_order: sp1 -> sp2/);

const theoremIds = new Set(loadTheorems().map(theorem => theorem.id));
assert.ok(theoremIds.has("dominated_convergence"));
assert.ok(theoremIds.has("cauchy_integral_formula"));
assert.equal(theoremIds.has("mock_theta_radial_limits"), false);
assert.equal(theoremIds.has("finite_field_curve_zeta"), false);

await fs.mkdir(path.join(process.cwd(), "output"), { recursive: true });
const tempDir = await fs.mkdtemp(path.join(process.cwd(), "output", "wma-theorems-"));
const externalPath = path.join(tempDir, "external.json");
try {
  await fs.writeFile(externalPath, JSON.stringify({
    theorems: [{
      id: "external_marker",
      name: "External marker theorem",
      domains: ["analysis"],
      keywords: ["special marker"],
      signals: ["special marker"],
      invariant_hints: ["external invariant"],
      verification_hints: ["external verification"],
      wolfram_hint: "Use wolfram_eval only after checking the marker."
    }]
  }), "utf8");

  process.env.WOLFRAM_THEOREM_EXTERNAL_PATH = externalPath;
  process.env.WOLFRAM_THEOREM_SOURCE = "merge";
  const merged = analyzeProblem("please use the special marker");
  assert.ok(merged.suggestedTheorems.some(item => item.theorem === "External marker theorem"));
  assert.ok(merged.suggestedInvariants.includes("external invariant"));
  assert.ok(merged.verificationChecks.includes("external verification"));

  process.env.WOLFRAM_THEOREM_SOURCE = "external";
  const externalOnly = loadTheorems();
  assert.deepEqual(externalOnly.map(theorem => theorem.id), ["external_marker"]);
} finally {
  delete process.env.WOLFRAM_THEOREM_SOURCE;
  delete process.env.WOLFRAM_THEOREM_EXTERNAL_PATH;
  await fs.rm(tempDir, { recursive: true, force: true });
}

console.log("planning tests passed");
