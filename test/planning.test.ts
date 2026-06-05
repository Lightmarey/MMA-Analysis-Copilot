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
assert.match(buildPreplanContext(residueAnalysis, residuePlan), /workflow_hint: theorem -> invariants -> verification/);
assert.match(buildPreplanContext(residueAnalysis, residuePlan), /local_tool_hints: .*wolfram_residue/);

const convergenceProblem = "Determine whether Sum[1/k^p, {k, 1, Infinity}] converges and state the condition on p.";
const convergencePlan = createPreplan(convergenceProblem);
assert.ok(convergencePlan.recommendedTools.includes("wolfram_convergence"));
assert.ok(convergencePlan.recommendedTools.includes("wolfram_sum"));

const simpleProblem = "Simplify Sin[x]^2 + Cos[x]^2.";
const simpleAnalysis = analyzeProblem(simpleProblem);
assert.equal(classifyDifficulty(simpleProblem, simpleAnalysis), "simple");

const localEstimateProblem = "Apply finite-sum Cauchy-Schwarz and Young epsilon absorption to a local estimate.";
const localEstimateAnalysis = analyzeProblem(localEstimateProblem);
const localEstimatePlan = createPreplan(localEstimateProblem, localEstimateAnalysis);
assert.equal(classifyDifficulty(localEstimateProblem, localEstimateAnalysis), "complex");
assert.ok(localEstimatePlan.recommendedTools.includes("proof_pattern_engine"));

const parameterAbsorptionProblem = "Formalize a Yamabe moving-spheres parameter absorption and large-constant condition A2 >= C K0 A0.";
const parameterAbsorptionPlan = createPreplan(parameterAbsorptionProblem);
assert.equal(classifyDifficulty(parameterAbsorptionProblem), "complex");
assert.ok(parameterAbsorptionPlan.recommendedTools.includes("proof_pattern_engine"));

const scalePowerProblem = "Check the scale-ordered power inequality when 0 < d <= a by comparing H ratios and powers of d/a.";
const scalePowerAnalysis = analyzeProblem(scalePowerProblem);
const scalePowerPlan = createPreplan(scalePowerProblem, scalePowerAnalysis);
const scalePowerContext = buildPreplanContext(scalePowerAnalysis, scalePowerPlan);
assert.ok(scalePowerAnalysis.estimatePatterns.some(item => item.id === "scale_power_substitution"));
assert.equal(scalePowerAnalysis.estimatePatterns.some(item => item.id === "negative_part_absorption"), false);
assert.ok(scalePowerPlan.recommendedTools.includes("verification_template"));
assert.ok(scalePowerPlan.recommendedTools.includes("wolfram_simplify"));
assert.match(scalePowerContext, /Estimate pattern hints/);
assert.match(scalePowerContext, /set d = a\*q/);
assert.match(scalePowerContext, /p\*Log\[q\] <= 0/);
assert.match(scalePowerContext, /instead of retrying bare Reduce/);
assert.match(scalePowerContext, /estimate_pattern_note/);

const negativePartProblem = "Given E >= 0, E <= q E, and 0 <= q < 1, verify the negative-part absorption conclusion E == 0.";
const negativePartAnalysis = analyzeProblem(negativePartProblem);
const negativePartPlan = createPreplan(negativePartProblem, negativePartAnalysis);
const negativePartContext = buildPreplanContext(negativePartAnalysis, negativePartPlan);
assert.ok(negativePartAnalysis.estimatePatterns.some(item => item.id === "negative_part_absorption"));
assert.ok(negativePartPlan.recommendedTools.includes("wolfram_simplify"));
assert.match(negativePartContext, /put E >= 0, E <= q\*E/);

const integrationByPartsProblem = "Use integration by parts on Integrate[u'[x] v[x], {x, a, b}] and track boundary terms.";
const integrationByPartsPlan = createPreplan(integrationByPartsProblem);
assert.equal(classifyDifficulty(integrationByPartsProblem), "complex");
assert.ok(integrationByPartsPlan.recommendedTools.includes("proof_pattern_engine"));

const variationalProblem = "Check the first variation and Euler-Lagrange equation for a constrained nonlinear functional on a Nehari manifold.";
const variationalAnalysis = analyzeProblem(variationalProblem);
const variationalPlan = createPreplan(variationalProblem, variationalAnalysis);
assert.equal(classifyDifficulty(variationalProblem, variationalAnalysis), "complex");
assert.equal(variationalPlan.recommendedTools.includes("verification_template"), false);
assert.ok(variationalAnalysis.suggestedTheorems.some(item => item.theorem.includes("Direct method")));

const barrierProblem = "Construct a barrier auxiliary function and verify the maximum principle residual for upper and lower solutions.";
const barrierPlan = createPreplan(barrierProblem);
assert.equal(classifyDifficulty(barrierProblem), "complex");
assert.equal(barrierPlan.recommendedTools.includes("verification_template"), false);

const hessianProblem = "Compute Hessian quotient matrix principal minors and Maclaurin inequality side conditions.";
const hessianPlan = createPreplan(hessianProblem);
assert.equal(classifyDifficulty(hessianProblem), "complex");
assert.ok(hessianPlan.recommendedTools.includes("wolfram_matrix"));

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
