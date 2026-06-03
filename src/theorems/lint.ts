#!/usr/bin/env node
import path from "node:path";
import { config } from "../config.js";
import { lintTheoremFiles, theoremJsonFiles } from "./schema.js";

const directory = path.join(config.rootDir, "theorems");
const issues = lintTheoremFiles(theoremJsonFiles(directory));

if (issues.length) {
  for (const issue of issues) {
    const id = issue.id ? ` [${issue.id}]` : "";
    console.error(`${issue.file}${id}: ${issue.message}`);
  }
  process.exit(1);
}

console.log("theorem lint passed");
