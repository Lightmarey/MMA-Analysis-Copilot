import assert from "node:assert/strict";
import { buildLlmPlanContext, normalizeLlmExecutionPlan, parseLlmExecutionPlan } from "../src/agent/llm-planning.js";

const plan = normalizeLlmExecutionPlan({
  difficulty: "complex",
  routeReason: "PDE estimate with several symbolic checks.",
  problemType: "elliptic_pde",
  shouldUseTheoryFirst: true,
  recommendedTools: ["wolfram_differentiate", "wolfram_integrate", "missing_tool"],
  keyInvariants: ["sign convention", "energy identity"],
  theoremFocus: ["Maximum principle", "Holder inequality", "Young inequality"],
  invariantTargets: ["u'", "u''", "energy terms"],
  verificationTargets: ["verify PDE", "check boundary values", "compare Holder sides"],
  strategy: "Decompose, compute exact quantities, then explain sign convention.",
  subproblems: [
    { id: "sp1", statement: "Verify the candidate solution.", dependsOn: [], domain: "elliptic_pde" },
    { id: "sp2", statement: "Check Holder and Young estimates.", dependsOn: ["sp1"], domain: "inequalities" }
  ],
  finalTarget: "traceable verified answer"
});

assert.ok(plan);
assert.equal(plan.difficulty, "complex");
assert.deepEqual(plan.recommendedTools, ["wolfram_differentiate", "wolfram_integrate"]);
assert.equal(plan.subproblems.length, 2);

const context = buildLlmPlanContext(plan);
assert.match(context, /LLM planning context/);
assert.match(context, /Problem decomposition from LLM planner/);
assert.match(context, /wolfram_differentiate, wolfram_integrate/);

const parsed = parseLlmExecutionPlan(`prefix ${JSON.stringify(plan)} suffix`);
assert.ok(parsed);
assert.equal(parsed.difficulty, "complex");

console.log("llm planning tests passed");
