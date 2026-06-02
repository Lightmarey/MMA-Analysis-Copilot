import assert from "node:assert/strict";
import { formatMarkdownReport, formatVerificationSummary } from "../src/cli/report.js";
import type { ChatRun, TraceEvent } from "../src/cli/report.js";

const trace: TraceEvent[] = [
  { type: "route", difficulty: "complex", model: "analysis-model" },
  {
    type: "plan",
    context: [
      "Preplanning context:",
      "- key_invariants: dominating function, exceptional null set",
      "- verification_targets: check integrability of the bound, check pointwise convergence",
      "- recommended_tools: wolfram_integrate"
    ].join("\n")
  },
  {
    type: "tool_call",
    name: "wolfram_integrate",
    args: { expr: "x^a", variable: "x", lower: "0", upper: "1", assumptions: "" }
  },
  {
    type: "tool_result",
    name: "wolfram_integrate",
    markdown: "> Integrate: $\\frac{1}{a+1}$ under $\\Re(a)>-1$",
    result: {
      id: "test",
      ok: true,
      title: "Integrate",
      output: "(1 + a)^(-1)",
      latex: "\\frac{1}{a+1}",
      conditions: "Re[a] > -1",
      conditionLatex: "\\Re(a)>-1"
    }
  }
];

const summary = formatVerificationSummary(trace);
assert.match(summary, /Structured tools used: wolfram_integrate/);
assert.match(summary, /Conditions returned by Wolfram: Re\[a\] > -1 \(\$\\Re\(a\)>-1\$\)/);
assert.match(summary, /Preplanned invariants: dominating function, exceptional null set/);
assert.match(summary, /check integrability of the bound/);
assert.match(summary, /both visible/);

const run: ChatRun = {
  answer: "The integral is valid when $\\Re(a)>-1$.",
  trace
};
const report = formatMarkdownReport("Compute the integral and conditions.", run, 1234);
assert.match(report, /## Verification Summary/);
assert.match(report, /Elapsed: 1\.2s/);
assert.match(report, /## Tool Trace/);
assert.match(report, /## Answer/);

console.log("report tests passed");
