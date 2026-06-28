#!/usr/bin/env node
import { config } from "../config.js";
import { formulaRegistryJsonFiles, lintFormulaRegistry } from "./registry-schema.js";

const issues = lintFormulaRegistry(config.rootDir);

if (issues.length) {
  for (const issue of issues) {
    const name = issue.name ? ` [${issue.name}]` : "";
    console.error(`${issue.file}${name}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`formula registry lint passed (${formulaRegistryJsonFiles(config.rootDir).length} files)`);
