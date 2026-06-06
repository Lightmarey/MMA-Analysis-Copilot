import assert from "node:assert/strict";
import { hookResultsToPrompt, runAgentHooks, type ToolHistoryEntry } from "../src/agent/hooks.js";

const baseContext = {
  messages: [],
  toolHistory: [],
  firedHookIds: new Set<string>()
};

const proofHints = runAgentHooks({
  ...baseContext,
  phase: "after_plan",
  userMessage: "Create a proof-level ledger for this supplied formula transformation $A==B$ and its side conditions.",
  planContext: "local_tool_hints: proof_pattern_engine"
});
assert.ok(proofHints.some(result => result.id === "transform-ledger-hook"));
const transformHint = proofHints.find(result => result.id === "transform-ledger-hook");
assert.ok(transformHint);
assert.equal(transformHint.severity, "hint");
assert.match(transformHint.promptHint ?? "", /operation=compile/);
assert.doesNotMatch(transformHint.promptHint ?? "", /Hessian|Pohozaev|Yamabe|quotient/i);

const prompt = hookResultsToPrompt(proofHints);
assert.match(prompt, /Agent workflow hook guidance/);
assert.match(prompt, /proof_pattern_engine/);
assert.match(prompt, /assumption ledger/);

const cappedPrompt = hookResultsToPrompt(proofHints, { maxChars: 180 });
assert.ok(cappedPrompt.length <= 260);
assert.match(cappedPrompt, /truncated by hookPromptMaxChars/);

const expressionHint = proofHints.find(result => result.id === "expression-candidate-hook");
assert.ok(expressionHint);
assert.deepEqual(expressionHint.evidence?.candidates, ["A==B"]);

const assumptionHint = proofHints.find(result => result.id === "assumption-ledger-hook");
assert.ok(assumptionHint);
assert.match(assumptionHint.promptHint ?? "", /Supplied/);

const caseHints = runAgentHooks({
  ...baseContext,
  phase: "after_plan",
  userMessage: "Split into cases lambda<a, lambda==a, and lambda>a, then verify each target.",
  planContext: ""
});
assert.ok(caseHints.some(result => result.id === "case-split-hook"));

const noCaseHints = runAgentHooks({
  ...baseContext,
  phase: "after_plan",
  userMessage: "Track side conditions rho>0 and gamma>0 for a candidate substitution.",
  planContext: ""
});
assert.equal(noCaseHints.some(result => result.id === "case-split-hook"), false);
assert.ok(noCaseHints.some(result => result.id === "equivalence-check-hook"));
assert.match(hookResultsToPrompt(noCaseHints), /wolfram_equivalence_check/);
assert.match(hookResultsToPrompt(noCaseHints), /Do not solve or reduce/);

const repeatedTool: ToolHistoryEntry = {
  name: "wolfram_simplify",
  args: { expr: "x + x == 2*x", assumptions: "", operation: "Simplify" }
};
const loopWarnings = runAgentHooks({
  ...baseContext,
  phase: "before_tool_call",
  userMessage: "Verify the identity.",
  toolHistory: [repeatedTool, repeatedTool],
  proposedTool: repeatedTool
});
assert.equal(loopWarnings.length, 1);
assert.equal(loopWarnings[0].id, "tool-loop-guard");
assert.equal(loopWarnings[0].severity, "warning");
assert.match(loopWarnings[0].promptHint ?? "", /stop retrying/);

const proofCompileWarnings = runAgentHooks({
  ...baseContext,
  phase: "before_tool_call",
  userMessage: "Update the proof ledger.",
  toolHistory: [{
    name: "proof_pattern_engine",
    args: { operation: "compile", payload: "<|\"moveName\" -> \"move\"|>" },
    result: {
      id: "test",
      ok: true,
      title: "Proof pattern engine",
      output: "<|\"Status\" -> \"Compiled\", \"RuleSource\" -> \"AdHocRuleIntent\"|>"
    }
  }],
  proposedTool: {
    name: "proof_pattern_engine",
    args: { operation: "compile", payload: "<|\"moveName\" -> \"move verified\"|>" }
  }
});
assert.equal(proofCompileWarnings.length, 1);
assert.equal(proofCompileWarnings[0].traceTag, "repeated-proof-ledger");
assert.match(proofCompileWarnings[0].promptHint ?? "", /Do not recompile/);

const convergenceHints = runAgentHooks({
  ...baseContext,
  phase: "after_tool_call",
  userMessage: "Verify both identities.",
  toolHistory: [
    { name: "proof_pattern_engine", args: { operation: "compile" } },
    {
      name: "wolfram_equivalence_check",
      args: { expr: "{id1,id2}" },
      result: {
        id: "test",
        ok: true,
        title: "Simplify",
        output: "{True, 0}"
      }
    }
  ],
  latestTool: {
    name: "wolfram_equivalence_check",
    args: { expr: "{id1,id2}" },
    result: {
      id: "test",
      ok: true,
      title: "Simplify",
      output: "{True, 0}"
    }
  }
});
assert.equal(convergenceHints.length, 1);
assert.equal(convergenceHints[0].traceTag, "verified-check-convergence");
assert.match(convergenceHints[0].promptHint ?? "", /summarize now/);

const symbolicWarnings = runAgentHooks({
  ...baseContext,
  phase: "before_final",
  userMessage: "Show the identity.",
  finalText: "Therefore A[0] + B[0] == C[0]."
});
assert.equal(symbolicWarnings.length, 1);
assert.equal(symbolicWarnings[0].id, "symbolic-target-before-final");
assert.match(symbolicWarnings[0].promptHint ?? "", /structured Wolfram evidence/);

const verifiedFinal = runAgentHooks({
  ...baseContext,
  phase: "before_final",
  userMessage: "Show the identity.",
  toolHistory: [{ name: "wolfram_simplify", args: { expr: "A[0]+B[0]==C[0]" } }],
  finalText: "Therefore A[0] + B[0] == C[0]."
});
assert.equal(verifiedFinal.length, 0);

const seriesVerifiedFinal = runAgentHooks({
  ...baseContext,
  phase: "before_final",
  userMessage: "Check the expansion.",
  toolHistory: [{ name: "series_coefficient_check", args: { expr: "1+x", variable: "x" } }],
  finalText: "Therefore H[s] = c0 + c1*s + O[s]^2."
});
assert.equal(seriesVerifiedFinal.some(result => result.id === "symbolic-target-before-final"), false);

const conditionFinalWarnings = runAgentHooks({
  ...baseContext,
  phase: "before_final",
  userMessage: "Compute the integral.",
  toolHistory: [{
    name: "wolfram_integrate",
    args: { expr: "x^a" },
    result: {
      id: "test",
      ok: true,
      title: "Integrate",
      output: "(1+a)^(-1)",
      conditions: "Re[a] > -1"
    }
  }],
  finalText: "The integral equals 1/(a+1)."
});
assert.equal(conditionFinalWarnings.length, 1);
assert.equal(conditionFinalWarnings[0].id, "assumption-ledger-before-final");
assert.match(conditionFinalWarnings[0].promptHint ?? "", /conditions explicitly/);

console.log("hook tests passed");
