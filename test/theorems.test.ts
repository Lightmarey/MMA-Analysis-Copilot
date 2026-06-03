import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { analyzeProblem, createPreplan, loadTheorems } from "../src/agent/planning.js";
import { createTheoremDraft, lintTheoremFiles } from "../src/theorems/schema.js";

const theoremIds = new Set(loadTheorems().map(theorem => theorem.id));
assert.ok(theoremIds.has("elliptic_maximum_principle"));
assert.ok(theoremIds.has("sobolev_poincare_inequality"));
assert.ok(theoremIds.has("young_inequality_products"));

const pdeProblem = "Use the maximum principle for a uniformly elliptic equation to bound the solution by boundary values.";
const pdeAnalysis = analyzeProblem(pdeProblem);
assert.ok(pdeAnalysis.suggestedTheorems.some(item => item.theorem === "Elliptic maximum principle"));
assert.ok(pdeAnalysis.detectedDomains.includes("elliptic_pde"));
const pdePlan = createPreplan(pdeProblem, pdeAnalysis);
assert.equal(pdePlan.problemType, "elliptic_pde");
assert.ok(pdePlan.recommendedTools.includes("theorem_advisor"));
assert.ok(pdePlan.recommendedTools.includes("wolfram_differentiate"));
assert.ok(pdePlan.recommendedTools.includes("wolfram_simplify"));

const inequalityProblem = "Apply Young inequality with epsilon to absorb the product term in an energy estimate.";
const inequalityAnalysis = analyzeProblem(inequalityProblem);
assert.ok(inequalityAnalysis.suggestedTheorems.some(item => item.theorem === "Young inequality for products"));
assert.ok(inequalityAnalysis.suggestedInvariants.some(item => item.includes("epsilon")));

const draft = createTheoremDraft({
  name: "Test elliptic estimate",
  domains: ["elliptic_pde", "inequalities"],
  keywords: ["test elliptic estimate"],
  wolframHint: "Use wolfram_simplify to verify the algebraic side condition."
});
assert.equal(draft.id, "test_elliptic_estimate");
assert.ok(draft.signals?.length);

await fs.mkdir(path.join(process.cwd(), "output"), { recursive: true });
const tempDir = await fs.mkdtemp(path.join(process.cwd(), "output", "wma-theorem-lint-"));
try {
  const file = path.join(tempDir, "draft.json");
  await fs.writeFile(file, JSON.stringify({ theorems: [draft] }), "utf8");
  assert.deepEqual(lintTheoremFiles([file]), []);
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

console.log("theorem tests passed");
