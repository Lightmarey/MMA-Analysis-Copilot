import type { TheoremSuggestion } from "./planning.js";

export function inferRecommendedTools(problem: string, suggestedTheorems: TheoremSuggestion[], theoryFirst: boolean): string[] {
  const tools: string[] = ["load_tool", "wolfram_simplify", "wolfram_eval", "formula_transform", "wolfram_solve", "wolfram_equivalence_check", "verification_template"];
  if (theoryFirst || suggestedTheorems.length) tools.push("theorem_advisor");
  for (const theorem of suggestedTheorems) {
    appendUnique(tools, [...theorem.wolframHint.matchAll(/\bwolfram_[a-z_]+\b/g)].map(match => match[0]));
    appendUnique(tools, [...theorem.casHint.matchAll(/\bwolfram_[a-z_]+\b/g)].map(match => match[0]));
  }
  return [...new Set(tools)];
}

function appendUnique(target: string[], values: string[]): void {
  const seen = new Set(target);
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned || seen.has(cleaned)) continue;
    target.push(cleaned);
    seen.add(cleaned);
  }
}

