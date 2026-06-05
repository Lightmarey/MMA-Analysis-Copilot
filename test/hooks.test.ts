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
  userMessage: "Create a proof-level ledger for this supplied formula transformation and its side conditions.",
  planContext: "local_tool_hints: proof_pattern_engine"
});
assert.equal(proofHints.length, 1);
assert.equal(proofHints[0].id, "proof-pattern-opportunity");
assert.equal(proofHints[0].severity, "hint");
assert.match(proofHints[0].promptHint ?? "", /operation=compile/);
assert.doesNotMatch(proofHints[0].promptHint ?? "", /Hessian|Pohozaev|Yamabe|quotient/i);

const prompt = hookResultsToPrompt(proofHints);
assert.match(prompt, /Agent workflow hook guidance/);
assert.match(prompt, /proof_pattern_engine/);

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
      name: "wolfram_simplify",
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
    name: "wolfram_simplify",
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

console.log("hook tests passed");
