import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { selectBatchQuestions } from "../src/cli/batch.js";
import { formatBatchTotals } from "../src/cli/batch-runner.js";
import { expandAtPaths } from "../src/cli/input.js";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wma-input-"));

try {
  await fs.writeFile(path.join(tempDir, "q.md"), "Compute Integrate[x^2, x]", "utf8");
  const inlined = await expandAtPaths("Please solve @q.md.", tempDir);
  assert.equal(inlined.inlinedPaths.length, 1);
  assert.match(inlined.text, /Compute Integrate/);
  assert.ok(inlined.text.trimEnd().endsWith("."));

  const unresolved = await expandAtPaths("Keep @reference untouched", tempDir);
  assert.equal(unresolved.text, "Keep @reference untouched");
  assert.deepEqual(unresolved.inlinedPaths, []);

  await fs.writeFile(path.join(tempDir, "big.md"), Buffer.alloc(256 * 1024 + 1, "x"));
  const oversized = await expandAtPaths("@big.md", tempDir);
  assert.equal(oversized.text, "@big.md");
  assert.deepEqual(oversized.inlinedPaths, []);

  const batch = selectBatchQuestions("first\n\n---\n\nsecond\n\n---\n\nthird", { start: 2, count: 1 });
  assert.equal(batch.total, 3);
  assert.equal(batch.start, 2);
  assert.equal(batch.end, 2);
  assert.deepEqual(batch.questions, [{ sourceNumber: 2, text: "second" }]);

  const batchTail = selectBatchQuestions("first\n---\nsecond\n---\nthird", { start: 2 });
  assert.deepEqual(batchTail.questions.map(item => item.sourceNumber), [2, 3]);
  assert.throws(
    () => selectBatchQuestions("first\n---\nsecond", { start: 3 }),
    /outside the batch range/
  );

  const totals = formatBatchTotals([
    { status: "ok", failed: "", iterationCapHit: false, toolCount: 2 },
    { status: "iteration-cap", failed: "", iterationCapHit: true, toolCount: 20 },
    { status: "error", failed: "boom", iterationCapHit: false, toolCount: 0 }
  ]).join("\n");
  assert.match(totals, /Success: 1/);
  assert.match(totals, /Errors: 1/);
  assert.match(totals, /Iteration cap hits: 1/);
  assert.match(totals, /Total tool calls: 22/);

  console.log("input tests passed");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
