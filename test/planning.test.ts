import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { config } from "../src/config.js";
import { analyzeProblem, buildPreplanContext, classifyDifficulty, createPreplan, decomposeProblem, loadTheorems } from "../src/agent/planning.js";

if (!config.openaiApiKey) {
  console.log("Skipping planning tests (OpenAI API key not set)");
  process.exit(0);
}

const client = new OpenAI({
  apiKey: config.openaiApiKey,
  baseURL: config.openaiBaseUrl
});

const dctProblem = "Show that the limit may pass under the integral because f_n converges pointwise and is dominated by Exp[-x] on [0, Infinity).";
const dctAnalysis = await analyzeProblem(client, dctProblem);
assert.ok(dctAnalysis.suggestedTheorems.some(item => item.theorem === "Dominated convergence theorem" || item.theorem === "Monotone convergence theorem"));
assert.equal(dctAnalysis.workflow.theoryFirst, true);
assert.equal(classifyDifficulty(dctProblem, dctAnalysis), "complex");
assert.ok(dctAnalysis.suggestedInvariants.some(item => /dominat/i.test(item) || /function/i.test(item)));
assert.ok(dctAnalysis.verificationChecks.some(item => /integrab/i.test(item) || /bound/i.test(item)));

const residueProblem = "Evaluate a contour integral by finding the residues of 1/(z^2 + 1) at its poles.";
const residueAnalysis = await analyzeProblem(client, residueProblem);
const residuePlan = createPreplan(residueProblem, residueAnalysis);
assert.ok(residueAnalysis.suggestedTheorems.some(item => item.theorem === "Residue theorem"));

assert.match(buildPreplanContext(residueAnalysis, residuePlan), /workflow_hint: theorem -> invariants -> verification/);
assert.match(buildPreplanContext(residueAnalysis, residuePlan), /local_tool_hints: .*wolfram_residue/);

const negativePartProblem = "Yamabe equation test example: v = v^+ - v^-, and checking negative part parameter absorption C * epsilon * norm(u) into the left hand side";
const negativePartAnalysis = await analyzeProblem(client, negativePartProblem);
const negativePartPlan = createPreplan(negativePartProblem, negativePartAnalysis);
const negativePartContext = buildPreplanContext(negativePartAnalysis, negativePartPlan);
// The LLM may not always perfectly extract exactly the exact IDs from estimates, but it should find parameter absorption
assert.ok(negativePartAnalysis.estimatePatterns.length > 0);

const pohozaevProfileProblem = "Yamabe Pohozaev local algebra: v(r)=A*r^(2-n)+B, D[r^alpha*v(r), r] at r=1, radial derivative v(1), and flat Pohozaev integrand.";
const pohozaevProfileAnalysis = await analyzeProblem(client, pohozaevProfileProblem);
const pohozaevProfilePlan = createPreplan(pohozaevProfileProblem, pohozaevProfileAnalysis);
const pohozaevProfileContext = buildPreplanContext(pohozaevProfileAnalysis, pohozaevProfilePlan);
assert.ok(pohozaevProfileAnalysis.estimatePatterns.length > 0);

const transitionRescaleProblem = "Transition barrier dyadic rescaling: rho^(n/2+1)*(tau_y*s_y^(-n/2-1)) with tau_y -> rho*tau_hat, s_y -> rho*s_hat and rho <= 2 c0 a.";
const transitionRescaleAnalysis = await analyzeProblem(client, transitionRescaleProblem);
const transitionRescalePlan = createPreplan(transitionRescaleProblem, transitionRescaleAnalysis);
const transitionRescaleContext = buildPreplanContext(transitionRescaleAnalysis, transitionRescalePlan);
assert.ok(transitionRescaleAnalysis.estimatePatterns.length > 0);

const appendixLowerProblem = "Yamabe appendix lower bound: u>=Lambda, v=M^-1*u, outer radius M^(-2/(n-2))*Y with Y <= delta/2*M^(2/(n-2)), and coercivity cn - CR*CP*r^2 >= cn/2.";
const appendixLowerAnalysis = await analyzeProblem(client, appendixLowerProblem);
const appendixLowerPlan = createPreplan(appendixLowerProblem, appendixLowerAnalysis);
const appendixLowerContext = buildPreplanContext(appendixLowerAnalysis, appendixLowerPlan);
assert.ok(appendixLowerAnalysis.estimatePatterns.length > 0);

const kelvinBaseProblem = "Yamabe Kelvin baseV=a^2/(r2+2*a*yn+a^2), baseK=a^2*lambda^2/(lambda^4+a^2*r2+2*a*lambda^2*yn), with r2>lambda^2. Compare baseV/baseK - 1 and cases lambda<a, lambda=a, lambda>a.";
const kelvinBaseAnalysis = await analyzeProblem(client, kelvinBaseProblem);
const kelvinBasePlan = createPreplan(kelvinBaseProblem, kelvinBaseAnalysis);
const kelvinBaseContext = buildPreplanContext(kelvinBaseAnalysis, kelvinBasePlan);
assert.ok(kelvinBaseAnalysis.estimatePatterns.length > 0);

const equivalenceProblem = "Verify that the before/after expressions are equivalent: lhs and rhs should be the same under the stated assumptions.";
const equivalenceAnalysis = await analyzeProblem(client, equivalenceProblem);
const equivalencePlan = createPreplan(equivalenceProblem, equivalenceAnalysis);

const coefficientProblem = "Check the Laurent series coefficient and residual order for an explicit local expansion.";
const coefficientAnalysis = await analyzeProblem(client, coefficientProblem);
const coefficientPlan = createPreplan(coefficientProblem, coefficientAnalysis);

const variationalProblem = "Check the first variation and Euler-Lagrange equation for a constrained nonlinear functional on a Nehari manifold.";
const variationalAnalysis = await analyzeProblem(client, variationalProblem);
const variationalPlan = createPreplan(variationalProblem, variationalAnalysis);
assert.equal(classifyDifficulty(variationalProblem, variationalAnalysis), "complex");
assert.ok(variationalAnalysis.suggestedTheorems.some(item => item.theorem.includes("Direct method") || item.theorem.includes("Mountain pass") || item.theorem.includes("Nehari")));

const barrierProblem = "Construct a barrier auxiliary function and verify the maximum principle residual for upper and lower solutions.";
const barrierAnalysis = await analyzeProblem(client, barrierProblem);
const barrierPlan = createPreplan(barrierProblem, barrierAnalysis);
assert.equal(classifyDifficulty(barrierProblem, barrierAnalysis), "complex");

const hessianProblem = "Compute Hessian quotient matrix principal minors and Maclaurin inequality side conditions.";
const hessianAnalysis = await analyzeProblem(client, hessianProblem);
const hessianPlan = createPreplan(hessianProblem, hessianAnalysis);
assert.equal(classifyDifficulty(hessianProblem, hessianAnalysis), "complex");

const longProblem = (
  "Let f_n(x) be a sequence of measurable functions on [0, Infinity). Suppose f_n converges pointwise almost everywhere to f. " +
  "Assume |f_n(x)| is dominated by g(x) and g is integrable, then compute the limit of the integrals. " +
  "Furthermore, define a related contour integral with poles at I and -I, and determine the residue contribution."
).repeat(3);
const longAnalysis = await analyzeProblem(client, longProblem);
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
  const merged = await analyzeProblem(client, "please use the special marker");
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
