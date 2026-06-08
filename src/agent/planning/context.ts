import type { Preplan, ProblemAnalysis, ProblemDecomposition } from "./types.js";

export function buildPreplanContext(analysis: ProblemAnalysis, plan: Preplan, decomposition?: ProblemDecomposition | null): string {
  const theoremNames = analysis.suggestedTheorems.map(item => item.theorem);
  const highConfidence = analysis.softConstraints
    .filter(item => item.confidence === "high" || item.score >= 4)
    .sort((a, b) => b.score - a.score)[0];
  const constraint = plan.shouldUseTheoryFirst
    ? "Theory-first structure is likely useful; reduce to explicit verification targets before concluding."
    : "Direct computation may be enough; use structured tools when they clarify explicit checks.";
  const lines: string[] = [];

  if (highConfidence) {
    lines.push(`High-confidence theorem guidance (${highConfidence.theorem}, score=${highConfidence.score.toFixed(1)}):`);
    if (highConfidence.preferredRecipe.length) lines.push(`- preferred_recipe: ${highConfidence.preferredRecipe.join(" -> ")}`);
    if (highConfidence.avoidPatterns.length) lines.push(`- avoid_patterns: ${highConfidence.avoidPatterns.join(" | ")}`);
    if (highConfidence.wolframHint) lines.push(`- wolfram_hint: ${highConfidence.wolframHint}`);
    if (highConfidence.casHint) lines.push(`- cas_hint: ${highConfidence.casHint}`);
    lines.push("");
  }

  if (decomposition?.subproblems.length) {
    lines.push("Problem decomposition:");
    for (const subproblem of decomposition.subproblems) {
      const deps = subproblem.dependsOn.length ? subproblem.dependsOn.join(", ") : "none";
      lines.push(`- [${subproblem.id}] ${subproblem.statement} (depends: ${deps}; domain: ${subproblem.domain})`);
    }
    lines.push(`- final_target: ${decomposition.finalTarget}`);
    lines.push(`- dependency_order: ${decomposition.dependencyOrder.join(" -> ")}`);
    if (decomposition.objects.length) lines.push(`- objects: ${decomposition.objects.join(", ")}`);
    lines.push("- decomposition_note: subproblems are ordered hints; preserve dependency order when it is relevant.");
    lines.push("");
  }

  if (analysis.estimatePatterns.length) {
    lines.push("Estimate pattern hints:");
    for (const pattern of analysis.estimatePatterns) {
      lines.push(`- ${pattern.name} (score=${pattern.score}): ${pattern.why}`);
      if (pattern.firstToolHint) {
        lines.push(`  first_tool_hint: ${pattern.firstToolHint}`);
      } else if (pattern.score >= 4 && pattern.tools.includes("wolfram_simplify")) {
        lines.push("  first_tool_hint: if the expressions are explicit, try one compact wolfram_simplify ledger before sequential checks.");
      }
      lines.push(`  may_use: ${pattern.mayUse.join(" -> ")}`);
      lines.push(`  check: ${pattern.verificationTargets.join(" | ")}`);
      lines.push(`  tools: ${pattern.tools.join(", ")}`);
    }
    lines.push("- estimate_pattern_note: these are local hints for matching structures, not mandatory proof steps.");
    lines.push("");
  }

  lines.push("Preplanning context:");
  lines.push(`- scale: ${analysis.scale}`);
  lines.push(`- problem_type: ${plan.problemType}`);
  lines.push(`- detected_domains: ${formatList(analysis.detectedDomains)}`);
  lines.push(`- suggested_theorems: ${formatList(theoremNames)}`);
  lines.push(`- theorem_focus: ${formatList(plan.theoremFocus)}`);
  lines.push(`- local_tool_hints: ${formatList(plan.recommendedTools)}`);
  lines.push(`- key_invariants: ${formatList(plan.keyInvariants)}`);
  lines.push(`- invariant_targets: ${formatList(plan.invariantTargets)}`);
  lines.push(`- verification_targets: ${formatList(plan.verificationTargets)}`);
  lines.push("- workflow_hint: theorem -> invariants -> verification when the problem is theorem-first");
  lines.push(`- strategy: ${plan.strategy || analysis.recommendedApproach || "Use exact Wolfram-backed computation with explicit verification."}`);
  lines.push(`- local_guidance: ${constraint}`);
  lines.push("- verification_note: check listed targets when they are relevant, or state why they remain analytic assumptions.");
  return lines.join("\n");
}

function formatList(values: string[]): string {
  return values.length ? values.join(", ") : "none";
}
