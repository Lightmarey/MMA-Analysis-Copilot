import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { analyzeProblem, buildPreplanContext, classifyDifficulty, createPreplan, decomposeProblem, loadTheorems } from "../src/agent/planning.js";

const finiteFieldProblem = String.raw`Count projective points on x^3 y + y^3 z + z^3 x = 0 over F_{5^18}.`;
const finiteFieldAnalysis = analyzeProblem(finiteFieldProblem);
assert.equal(finiteFieldAnalysis.scale, "infeasible_brute_force");
assert.equal(finiteFieldAnalysis.workflow.theoryFirst, true);
assert.equal(classifyDifficulty(finiteFieldProblem, finiteFieldAnalysis), "complex");
assert.ok(finiteFieldAnalysis.suggestedInvariants.some(item => item.includes("field characteristic p = 5")));
assert.ok(finiteFieldAnalysis.verificationChecks.some(item => item.includes("Hasse-Weil")));

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
  "Define F(z) as a mock theta q-series. Let ell_1 be the smallest prime satisfying several constraints. " +
  "Given that ell_2 is defined from a class number condition, define alpha by a radial limit at ell_1/(4 ell_2). " +
  "Then compute the minimal polynomial of alpha and determine the final Omega."
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
assert.ok(theoremIds.has("mock_theta_radial_limits"));
assert.ok(theoremIds.has("harmonic_weak_maass_construction"));

await fs.mkdir(path.join(process.cwd(), "output"), { recursive: true });
const tempDir = await fs.mkdtemp(path.join(process.cwd(), "output", "wma-theorems-"));
const externalPath = path.join(tempDir, "external.json");
try {
  await fs.writeFile(externalPath, JSON.stringify({
    theorems: [{
      id: "external_marker",
      name: "External marker theorem",
      domains: ["external_domain"],
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
