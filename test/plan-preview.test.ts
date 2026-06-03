import assert from "node:assert/strict";
import { createPlanPreview, formatPlanPreview } from "../src/cli/plan-preview.js";

const problem = (
  "Show that f_n converges pointwise and is dominated by Exp[-x] on [0, Infinity). " +
  "Then justify passing the limit under the integral and verify the dominating integral is finite."
);

const preview = createPlanPreview(problem);
assert.equal(preview.difficulty, "complex");
assert.ok(preview.analysis.suggestedTheorems.some(item => item.theorem === "Dominated convergence theorem"));
assert.ok(preview.preplan.shouldUseTheoryFirst);
assert.match(preview.context, /workflow_order: theorem -> invariants -> verification/);
assert.match(preview.context, /execution_rule/);

const markdown = formatPlanPreview(problem, preview);
assert.match(markdown, /# Wolfram Math Agent Plan Preview/);
assert.match(markdown, /## Route/);
assert.match(markdown, /## Analysis/);
assert.match(markdown, /## Preplan/);
assert.match(markdown, /## Injected Context/);
assert.match(markdown, /Dominated convergence theorem/);

console.log("plan preview tests passed");
