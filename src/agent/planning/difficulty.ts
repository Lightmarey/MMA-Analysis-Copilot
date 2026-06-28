import { analyzeProblem } from "./analysis.js";
import type { RouteDifficulty } from "./types.js";

const COMPLEX_ROUTING_PATTERNS = [
  /proof|prove|show\s+that|\u8bc1\u660e|\u6c42\u8bc1/i,
  /normal\s+family|hahn[-\s]?banach|open\s+mapping|spectral\s+theorem/i,
  /contour\s+integral|rouche|residue\s+theorem/i,
  /variational|functional|minimi[sz]|mountain\s+pass|nehari|pohozaev|barrier|moving[-\s]?spheres|kelvin|sub[-\s]?solution|super[-\s]?solution|hessian\s+quotient|manifold|representation/i,
  /\u53d8\u5206|\u6cdb\u51fd|\u6781\u5c0f|\u95f8\u51fd\u6570|\u4e0a\u4e0b\u89e3|\u79fb\u52a8\u7403|\u7403\u9762\u6cd5|\u8868\u793a\u8bba|\u6d41\u5f62|\u5927hessian/i
];

export function classifyDifficulty(problem: string, analysis = analyzeProblem(problem)): RouteDifficulty {
  if (analysis.structuralComplexity.isComplex) return "complex";
  if (analysis.scale === "heavy" || analysis.scale === "infeasible_brute_force") return "complex";
  if (analysis.workflow.theoryFirst) return "complex";
  if (COMPLEX_ROUTING_PATTERNS.some(pattern => pattern.test(problem))) return "complex";
  const matchedTheorems = analysis.suggestedTheorems.length;
  if (matchedTheorems >= 2 && analysis.detectedDomains.length >= 2) return "complex";
  return "simple";
}
