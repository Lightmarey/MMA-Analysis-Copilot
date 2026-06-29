import OpenAI from "openai";
import { config } from "../../config.js";
import { llmCallText, jsonifyWithWeakModel } from "../json-utils.js";
import { matchEstimatePatterns } from "../planning-hints/estimate-patterns.js";
import { ANALYSIS_DOMAINS } from "./theorem-library.js";
import { matchTheorems, suggestInvariants } from "./theorem-matching.js";
import type { ProblemAnalysis, TheoremSuggestion } from "./types.js";

export async function analyzeProblem(client: OpenAI, problem: string, detectedObjects = ""): Promise<ProblemAnalysis> {
  const combined = `${problem} ${detectedObjects}`.trim();

  // 1. Concurrent LLM calls for properties, patterns, theorems
  const [scaleInfoAndComplexity, matched, estimatePatterns] = await Promise.all([
    analyzeScaleAndComplexity(client, combined),
    matchTheorems(client, combined),
    matchEstimatePatterns(client, combined)
  ]);

  const detectedDomains = [...new Set(matched.flatMap(item => item.domains))].sort();
  const suggestedInvariants = suggestInvariants(scaleInfoAndComplexity.scaleInfo, matched);
  
  const verificationChecks = [
    ...uniqueFlatMap(matched, item => item.verificationHints),
    ...uniqueFlatMap(estimatePatterns, item => item.verificationTargets)
  ];
  
  const scale = scaleInfoAndComplexity.scaleInfo.scale;
  
  const theoryFirst = scale === "heavy" || scale === "infeasible_brute_force" || shouldPrioritizeAnalysisTheory(combined, matched);
  const structuralComplexity = scaleInfoAndComplexity.structuralComplexity;
  // Fallback domain counting since LLM extracted it or we computed it
  structuralComplexity.domainCount = Math.max(structuralComplexity.domainCount, detectedDomains.length);

  const shouldUseTheoryFirst = theoryFirst || structuralComplexity.reasons.includes("analysis theorem-first task");
  const allowBruteforce = (scale === "trivial" || scale === "moderate") && !shouldUseTheoryFirst;
  
  const softConstraints = matched.filter(item => item.preferredRecipe.length > 0 || item.avoidPatterns.length > 0 || item.wolframHint);
  const recommendedApproach = buildRecommendedApproach(scale, matched, suggestedInvariants, verificationChecks, shouldUseTheoryFirst);

  return {
    title: "Theorem advisor",
    scale,
    scaleDetail: Object.fromEntries(
      Object.entries(scaleInfoAndComplexity.scaleInfo)
        .filter(([key]) => key !== "scale")
        .map(([key, value]) => [key, String(value)])
    ),
    suggestedTheorems: matched,
    suggestedInvariants,
    verificationChecks,
    estimatePatterns,
    workflow: {
      phases: ["theorem", "invariants", "verification"],
      theoryFirst: shouldUseTheoryFirst
    },
    structuralComplexity,
    softConstraints,
    recommendedApproach,
    detectedDomains,
    allowBruteforce
  };
}

async function analyzeScaleAndComplexity(client: OpenAI, text: string) {
  const systemPrompt = `You are a mathematical problem analyzer.
Given a problem description, evaluate its structural complexity and computational scale.
Answer these specific questions:
1. What is the maximum polynomial degree mentioned in the problem? (If none, say null)
2. Is the computational scale trivial, moderate, heavy, or infeasible_brute_force? (Usually moderate unless very high degree polynomials are present, or it's clearly intractable to compute directly).
3. Count the number of constraints in the problem (e.g. "such that", "given", "assume").
4. Count the number of steps if it's a multi-step problem (e.g. "then", "furthermore", "compute X then Y").
5. Is this problem structurally complex? (long, multi-domain, many constraints, multi-step, analysis theorem-first task) Give reasons.

Provide your reasoning clearly.`;

  const reasoning = await llmCallText(client, config.proModel, systemPrompt, text);
  
  const schema = `{
  "scale": "trivial" | "moderate" | "heavy" | "infeasible_brute_force",
  "max_polynomial_degree": number | null,
  "scaleReason": "string",
  "structuralComplexity": {
    "isComplex": boolean,
    "reasons": ["string (e.g., 'multi-step (2 steps)', 'many constraints (3)', 'long problem')"],
    "domainCount": number,
    "constraintCount": number,
    "length": number
  }
}`;

  let extracted = null;
  if (reasoning) {
    extracted = await jsonifyWithWeakModel<{
      scale: "trivial" | "moderate" | "heavy" | "infeasible_brute_force";
      max_polynomial_degree: number | null;
      scaleReason: string;
      structuralComplexity: {
        isComplex: boolean;
        reasons: string[];
        domainCount: number;
        constraintCount: number;
        length: number;
      };
    }>(client, reasoning, schema);
  }

  if (extracted) {
    return {
      scaleInfo: {
        scale: extracted.scale,
        ...(extracted.max_polynomial_degree ? { max_polynomial_degree: extracted.max_polynomial_degree } : {}),
        ...(extracted.scaleReason ? { reason: extracted.scaleReason } : {})
      },
      structuralComplexity: extracted.structuralComplexity
    };
  }

  // Fallback to defaults if LLM extraction fails
  return {
    scaleInfo: { scale: "moderate" as const },
    structuralComplexity: {
      isComplex: false,
      reasons: [],
      domainCount: 1,
      constraintCount: 1,
      length: text.length
    }
  };
}

function shouldPrioritizeAnalysisTheory(text: string, matched: TheoremSuggestion[]): boolean {
  if (!matched.length) return false;
  const asksForJustification = /\b(prove|show|justify|establish)\b|\u8bc1\u660e|\u6c42\u8bc1|\u8bf4\u660e/.test(text);
  return matched.some(item => (
    item.score >= 2 &&
    item.domains.some(domain => ANALYSIS_DOMAINS.has(domain)) &&
    (asksForJustification || item.preferredRecipe.length > 0 || item.verificationHints.length >= 2)
  ));
}

function buildRecommendedApproach(
  scale: ProblemAnalysis["scale"],
  matched: TheoremSuggestion[],
  invariants: string[],
  checks: string[],
  theoryFirst: boolean
): string {
  const parts: string[] = [];
  if (theoryFirst) {
    parts.push(scale === "heavy" || scale === "infeasible_brute_force"
      ? "Direct brute-force computation is not appropriate; reduce the problem using theory first"
      : "Use a theory-first route before computation");
  } else if (scale === "moderate") {
    parts.push("Direct computation is possible, but check for structural simplification first");
  } else {
    parts.push("A direct structured Wolfram computation is likely sufficient");
  }
  const top = matched[0];
  if (top) {
    parts.push(`anchor on ${top.theorem}${top.why ? `: ${top.why}` : ""}`);
  }
  if (invariants.length) parts.push(`compute invariants: ${invariants.slice(0, 5).join(", ")}`);
  if (checks.length) parts.push(`verify: ${checks.slice(0, 4).join(", ")}`);
  return parts.join(" -> ");
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
