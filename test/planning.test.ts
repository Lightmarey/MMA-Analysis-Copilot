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

const pohozaevProfileProblem = "Yamabe Pohozaev local algebra: v(r)=A*r^(2-n)+B, D[r^alpha*v(r), r] at r=1, radial derivative v(1), and flat Pohozaev integrand.";
const pohozaevProfileAnalysis = analyzeProblem(pohozaevProfileProblem);
const pohozaevProfilePlan = createPreplan(pohozaevProfileProblem, pohozaevProfileAnalysis);
const pohozaevProfileContext = buildPreplanContext(pohozaevProfileAnalysis, pohozaevProfilePlan);
assert.ok(pohozaevProfileAnalysis.estimatePatterns.some(item => item.id === "flat_pohozaev_profile_algebra"));
assert.ok(pohozaevProfilePlan.recommendedTools.includes("wolfram_simplify"));
assert.match(pohozaevProfileContext, /combine the derivative, coefficient, and integrand equalities/);
assert.match(pohozaevProfileContext, /compact ledger may contain/);
assert.match(pohozaevProfileContext, /first_tool_hint: if the expressions are explicit/);
assert.match(pohozaevProfileContext, /FullSimplify\[Implies\[A\+B==1 && A==B/);
assert.match(pohozaevProfileContext, /\(D\[expr, r\] \/. r -> 1\)/);

const transitionRescaleProblem = "Transition barrier dyadic rescaling: rho^(n/2+1)*(tau_y*s_y^(-n/2-1)) with tau_y -> rho*tau_hat, s_y -> rho*s_hat and rho <= 2 c0 a.";
const transitionRescaleAnalysis = analyzeProblem(transitionRescaleProblem);
const transitionRescalePlan = createPreplan(transitionRescaleProblem, transitionRescaleAnalysis);
const transitionRescaleContext = buildPreplanContext(transitionRescaleAnalysis, transitionRescalePlan);
assert.ok(transitionRescaleAnalysis.estimatePatterns.some(item => item.id === "transition_rescaling_powers"));
assert.ok(transitionRescalePlan.recommendedTools.includes("wolfram_simplify"));
assert.match(transitionRescaleContext, /rename symbols with underscores to camelCase/);
assert.match(transitionRescaleContext, /rho power cancellation/);
assert.match(transitionRescaleContext, /full inequality list/);
assert.match(transitionRescaleContext, /rather than Implies\[\.\.\., \{\.\.\.\}\]/);
assert.match(transitionRescaleContext, /tauhat >= 0/);

const appendixLowerProblem = "Yamabe appendix lower bound: u>=Lambda, v=M^-1*u, outer radius M^(-2/(n-2))*Y with Y <= delta/2*M^(2/(n-2)), and coercivity cn - CR*CP*r^2 >= cn/2.";
const appendixLowerAnalysis = analyzeProblem(appendixLowerProblem);
const appendixLowerPlan = createPreplan(appendixLowerProblem, appendixLowerAnalysis);
const appendixLowerContext = buildPreplanContext(appendixLowerAnalysis, appendixLowerPlan);
assert.ok(appendixLowerAnalysis.estimatePatterns.some(item => item.id === "appendix_lower_bound_scaling"));
assert.ok(appendixLowerPlan.recommendedTools.includes("wolfram_simplify"));
assert.match(appendixLowerContext, /lower-bound scaling/);
assert.match(appendixLowerContext, /Sqrt\[cn\/\(2\*CR\*CP\)\]/);
assert.match(appendixLowerContext, /first_tool_hint: Run wolfram_simplify first with expr=\{u\/M >= Lambda\/M/);
assert.match(appendixLowerContext, /stable ledger is/);
assert.match(appendixLowerContext, /do not put the raw radius inequality/);
assert.match(appendixLowerContext, /isolated singularity positivity/);

const kelvinBaseProblem = "Yamabe Kelvin baseV=a^2/(r2+2*a*yn+a^2), baseK=a^2*lambda^2/(lambda^4+a^2*r2+2*a*lambda^2*yn), with r2>lambda^2. Compare baseV/baseK - 1 and cases lambda<a, lambda=a, lambda>a.";
const kelvinBaseAnalysis = analyzeProblem(kelvinBaseProblem);
const kelvinBasePlan = createPreplan(kelvinBaseProblem, kelvinBaseAnalysis);
const kelvinBaseContext = buildPreplanContext(kelvinBaseAnalysis, kelvinBasePlan);
assert.ok(kelvinBaseAnalysis.estimatePatterns.some(item => item.id === "kelvin_base_comparison"));
assert.ok(kelvinBasePlan.recommendedTools.includes("wolfram_simplify"));
assert.match(kelvinBaseContext, /Kelvin base comparisons/);
assert.match(kelvinBaseContext, /baseV\/baseK - 1/);
assert.match(kelvinBaseContext, /keep the implication statements in expr/);
assert.match(kelvinBaseContext, /mutually exclusive positive\/zero\/negative/);
assert.match(kelvinBaseContext, /do not call Reduce on baseV > baseK directly/);

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
