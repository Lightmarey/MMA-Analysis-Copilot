import { analyzeProblem } from "./analysis.js";
import type { ProblemAnalysis, ProblemDecomposition, Subproblem } from "./types.js";

const SENTENCE_SPLIT_RE = /[.;\n\u3002\uff1b]+/g;

export function decomposeProblem(problem: string, analysis = analyzeProblem(problem)): ProblemDecomposition | null {
  if (!analysis.structuralComplexity.isComplex && problem.length < 500) return null;
  const statements = problem
    .split(SENTENCE_SPLIT_RE)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 8);
  const objects = extractObjects(problem, analysis);
  const subproblems = statements.map((statement, index) => ({
    id: `sp${index + 1}`,
    statement,
    dependsOn: index === 0 ? [] : [`sp${index}`],
    domain: inferStatementDomain(statement, analysis)
  }));
  if (!subproblems.length && objects.length) {
    subproblems.push({
      id: "sp1",
      statement: `Identify and normalize the mathematical objects: ${objects.join(", ")}`,
      dependsOn: [],
      domain: analysis.detectedDomains[0] ?? "general"
    });
  }
  if (!subproblems.length) return null;
  return {
    objects,
    subproblems,
    finalTarget: inferFinalTarget(problem, subproblems),
    dependencyOrder: subproblems.map(item => item.id)
  };
}

function extractObjects(problem: string, analysis: ProblemAnalysis): string[] {
  const objects: string[] = [];
  const namedAssignments = [...problem.matchAll(/\b([A-Z][A-Za-z0-9_]*|[a-z]_\{?\d+\}?|[a-z]_\d+)\s*(?:=|:=|is|be)\s*([^.;\n]+)/g)]
    .slice(0, 10)
    .map(match => `${match[1]} = ${match[2].trim()}`);
  appendUnique(objects, namedAssignments);

  const functions = [...problem.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*\(([^)]{1,40})\)/g)]
    .slice(0, 10)
    .map(match => `${match[1]}(${match[2]})`);
  appendUnique(objects, functions);
  appendUnique(objects, analysis.suggestedInvariants.slice(0, 8));
  return objects.slice(0, 16);
}

function inferStatementDomain(statement: string, analysis: ProblemAnalysis): string {
  const lowered = statement.toLowerCase();
  if (/residue|contour|pole|rouche|holomorphic|meromorphic/i.test(statement)) return "complex_analysis";
  if (/integral|limit|series|sum|convergen/i.test(lowered)) return "analysis";
  if (/matrix|eigen|operator|linear/i.test(statement)) return "linear_algebra";
  return analysis.detectedDomains[0] ?? "general";
}

function inferFinalTarget(problem: string, subproblems: Subproblem[]): string {
  const targetPatterns = [
    /\b(?:compute|find|determine|prove|show)\b([^.;\n]+)/gi,
    /(?:\u6c42|\u8ba1\u7b97|\u8bc1\u660e|\u5224\u65ad)([^\u3002\uff1b;\n]+)/g
  ];
  for (const pattern of targetPatterns) {
    const matches = [...problem.matchAll(pattern)];
    const last = matches.at(-1);
    if (last?.[0]) return last[0].trim();
  }
  return subproblems.at(-1)?.statement ?? "solve the original problem";
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
