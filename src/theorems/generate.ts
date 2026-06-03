#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createTheoremDraft } from "./schema.js";

const args = parseArgs(process.argv.slice(2));
const name = args.name;
if (!name) {
  fail("Missing --name. Example: npm run theorem:generate -- --name \"Maximum principle\" --domain elliptic_pde --keyword \"maximum principle\"");
}

const draft = createTheoremDraft({
  id: args.id,
  name,
  domains: args.domain.length ? args.domain : ["analysis"],
  keywords: args.keyword,
  wolframHint: args.wolframHint
});
const payload = `${JSON.stringify({ theorems: [draft] }, null, 2)}\n`;

if (args.output) {
  const outputPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, payload, "utf8");
  console.error(`Wrote ${outputPath}`);
} else {
  process.stdout.write(payload);
}

function parseArgs(argv: string[]) {
  const parsed = {
    id: "",
    name: "",
    domain: [] as string[],
    keyword: [] as string[],
    wolframHint: "",
    output: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1] ?? "";
    if (!key.startsWith("--")) continue;
    index += 1;
    if (key === "--id") parsed.id = value;
    else if (key === "--name") parsed.name = value;
    else if (key === "--domain") parsed.domain.push(value);
    else if (key === "--keyword") parsed.keyword.push(value);
    else if (key === "--wolfram-hint") parsed.wolframHint = value;
    else if (key === "--output") parsed.output = value;
    else fail(`Unknown option ${key}`);
  }
  return parsed;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
