import assert from "node:assert/strict";
import { analyzeProblem, buildPreplanContext, classifyDifficulty, createPreplan } from "../src/agent/planning.js";

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

console.log("planning tests passed");
