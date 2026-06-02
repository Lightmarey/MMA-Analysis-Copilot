import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

  console.log("input tests passed");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
