import assert from "node:assert/strict";
import { analyzePaperPreflight, formatPaperPreflight } from "../src/agent/paper-preflight.js";

const barrier = analyzePaperPreflight(`
barrier_construction
Let H(y) = Exp[-mu y_n]. Verify -L H >= 0 on the boundary using Delta and normal derivative terms.
`);
assert.equal(barrier.class, "symbolic-checkable");
assert.equal(barrier.method, "barrier_construction");
assert.ok(barrier.symbolicTools.includes("verification_template:barrier_operator_check"));
assert.equal(barrier.maxToolCalls, 3);

const movingSpheres = analyzePaperPreflight(`
moving_spheres
The narrow domain principle forces w_lambda >= 0 after the maximum principle and Hopf lemma.
`);
assert.equal(movingSpheres.class, "needs-author-data");
assert.equal(movingSpheres.method, "moving_spheres");
assert.ok(movingSpheres.missing.includes("Kelvin/inversion formula"));
assert.equal(movingSpheres.symbolicTools.length, 0);

const unknown = analyzePaperPreflight("This paragraph only describes the organization of the paper.");
assert.equal(unknown.class, "needs-author-data");
assert.equal(unknown.maxToolCalls, 0);

const formatted = formatPaperPreflight(barrier);
assert.match(formatted, /class: symbolic-checkable/);
assert.match(formatted, /max_tool_calls: 3/);

console.log("paper preflight tests passed");
