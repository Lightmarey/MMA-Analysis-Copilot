import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { persistFormulaRegistryCandidate } from "../src/cli/formula-registry.js";
import { lintFormulaRegistryCandidate } from "../src/formula-transform/registry-schema.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wma-formula-registry-"));
const candidate = path.join(tempRoot, "TemporaryRule.transform.json");

const rule = {
  schemaVersion: 1,
  name: "TemporaryRule",
  family: "temporary-test-rule",
  runtime: "GenericTemplate",
  matchers: [
    {
      name: "WholeExpression",
      body: { kind: "Whole", slots: [] }
    }
  ],
  orientations: [
    {
      name: "Identity",
      direction: "Equal",
      relation: "Equal",
      lhs: "$selected",
      rhs: "$selected"
    }
  ],
  conditions: []
};

fs.writeFileSync(candidate, `${JSON.stringify(rule, null, 2)}\n`);

assert.deepEqual(lintFormulaRegistryCandidate(candidate, rule), []);

const badOrientationRule = {
  ...rule,
  orientations: [
    {
      name: "BadChain",
      direction: "TwoSided",
      relation: "LessEqualChain",
      terms: ["$selected", "$selected"]
    }
  ]
};
assert.match(
  lintFormulaRegistryCandidate(candidate, badOrientationRule).map(issue => issue.message).join("\n"),
  /LessEqualChain requires at least three terms/
);

const persisted = persistFormulaRegistryCandidate(candidate, tempRoot);
assert.equal(persisted.kind, "rule");
assert.equal(persisted.name, "TemporaryRule");
assert.equal(
  persisted.targetPath,
  path.join(tempRoot, "wolfram", "FormulaTransformEngine", "Registry", "Rules", "TemporaryRule.transform.json")
);
assert.equal(JSON.parse(fs.readFileSync(persisted.targetPath, "utf8")).name, "TemporaryRule");

const changedRule = { ...rule, description: "changed" };
fs.writeFileSync(candidate, `${JSON.stringify(changedRule, null, 2)}\n`);
assert.throws(() => persistFormulaRegistryCandidate(candidate, tempRoot), /already exists with different content/);

const overwritten = persistFormulaRegistryCandidate(candidate, tempRoot, { force: true });
assert.equal(overwritten.targetPath, persisted.targetPath);
assert.equal(JSON.parse(fs.readFileSync(overwritten.targetPath, "utf8")).description, "changed");

console.log("formula registry tests passed");
