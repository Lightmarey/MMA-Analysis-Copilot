import { inferRecommendedTools } from "../tool-hints.js";
import { analyzeProblem } from "./analysis.js";
import type { Preplan, ProblemAnalysis } from "./types.js";

export function createPreplan(problem: string, analysis = analyzeProblem(problem)): Preplan {
  const theoremFocus = analysis.suggestedTheorems.map(item => item.theorem);
  const recommendedTools = [
    ...inferRecommendedTools(problem, analysis.suggestedTheorems, analysis.workflow.theoryFirst),
    ...uniqueFlatMap(analysis.estimatePatterns, item => item.tools)
  ].filter((tool, index, tools) => tools.indexOf(tool) === index);
  const shouldUseTheoryFirst = analysis.workflow.theoryFirst || analysis.scale === "heavy" || analysis.scale === "infeasible_brute_force";

  return {
    problemType: inferProblemType(problem, analysis),
    shouldUseTheoryFirst,
    recommendedTools,
    keyInvariants: analysis.suggestedInvariants,
    theoremFocus,
    invariantTargets: analysis.suggestedInvariants,
    verificationTargets: analysis.verificationChecks,
    strategy: analysis.recommendedApproach || defaultStrategy(analysis)
  };
}

function inferProblemType(problem: string, analysis: ProblemAnalysis): string {
  const preferredDomain = [
    "elliptic_pde",
    "partial_differential_equations",
    "inequalities",
    "sobolev_spaces",
    "weak_solutions",
    "complex_analysis",
    "functional_analysis",
    "analysis"
  ].find(domain => analysis.detectedDomains.includes(domain));
  if (preferredDomain) return preferredDomain;
  const lowered = problem.toLowerCase();
  if (/integral|limit|series|sum|\u79ef\u5206|\u6781\u9650|\u7ea7\u6570|\u6c42\u548c/.test(lowered)) return "analysis";
  if (/matrix|eigen|linear/.test(lowered)) return "linear_algebra";
  return "general";
}

function defaultStrategy(analysis: ProblemAnalysis): string {
  if (analysis.workflow.theoryFirst) return "Use theorem-first reasoning, compute invariants, then verify final conditions.";
  return "Use structured Wolfram tools, keep assumptions explicit, and verify the final expression.";
}

function uniqueFlatMap<T>(items: T[], selector: (item: T) => string[]): string[] {
  const values: string[] = [];
  for (const item of items) appendUnique(values, selector(item));
  return values;
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
