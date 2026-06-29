import OpenAI from "openai";
import { config } from "../../config.js";
import { llmCallJson } from "../json-utils.js";
import { matchEstimatePatterns } from "../planning-hints/estimate-patterns.js";
import { ANALYSIS_DOMAINS } from "./theorem-library.js";
import { matchTheorems, suggestInvariants } from "./theorem-matching.js";
import type { PlanningLlmOptions, ProblemAnalysis, TheoremSuggestion } from "./types.js";

const CONSTRAINT_RE = /\b(such that|given that|subject to|let|define|denote|suppose|assume|where)\b|\u6ee1\u8db3|\u4f7f\u5f97|\u6761\u4ef6/gim;
const MULTISTEP_RE = /\b(then|subsequently|furthermore|compute|find|determine)\b|\u8fdb\u4e00\u6b65|\u7136\u540e|\u518d[\u6c42\u7b97\u8ba1]/gim;
const POLY_DEGREE_RE = /[a-zA-Z]\s*\^\s*\{?(\d+)\}?/g;
const SENTENCE_SPLIT_RE = /[.;\n\u3002\uff1b]+/g;

export async function analyzeProblem(client: OpenAI | null, problem: string, detectedObjects = "", options: PlanningLlmOptions = {}): Promise<ProblemAnalysis> {
  const combined = `${problem} ${detectedObjects}`.trim();
  const llmOptions = {
    model: options.model || config.plannerModel || config.flashModel,
    useLlm: options.useLlm
  };

  const [scaleInfoAndComplexity, matched, estimatePatterns] = await Promise.all([
    analyzeScaleAndComplexity(client, combined, llmOptions),
    matchTheorems(client, combined, llmOptions),
    matchEstimatePatterns(client, combined, llmOptions)
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
  structuralComplexity.domainCount = Math.max(structuralComplexity.domainCount, detectedDomains.length);
  if (requiresTheoryFirstConstruction(combined, matched) && !structuralComplexity.reasons.includes("analysis theorem-first task")) {
    structuralComplexity.reasons.push("analysis theorem-first task");
    structuralComplexity.isComplex = true;
  }

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

async function analyzeScaleAndComplexity(client: OpenAI | null, text: string, options: PlanningLlmOptions) {
  const fallback = {
    scaleInfo: estimateScale(text),
    structuralComplexity: assessStructuralComplexity(text, 0, [])
  };
  if (!client || options.useLlm === false) return fallback;

  const systemPrompt = `You are a mathematical problem analyzer.
Given a problem description, evaluate its structural complexity and computational scale.
Return only JSON:
{"scale":"trivial|moderate|heavy|infeasible_brute_force","max_polynomial_degree":number|null,"scaleReason":"string","structuralComplexity":{"isComplex":boolean,"reasons":["string"],"domainCount":number,"constraintCount":number,"length":number}}`;

  const extracted = await llmCallJson<{
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
  }>(client, options.model || config.plannerModel || config.flashModel, systemPrompt, text, 600);

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

  return fallback;
}

function estimateScale(text: string): Record<string, string | number> & { scale: ProblemAnalysis["scale"] } {
  const degrees = [...text.matchAll(POLY_DEGREE_RE)].map(match => Number.parseInt(match[1], 10));
  if (degrees.length) {
    const maxDegree = Math.max(...degrees);
    if (maxDegree > 20) {
      return {
        max_polynomial_degree: maxDegree,
        reason: `polynomial degree ${maxDegree} may make symbolic computation expensive`,
        scale: "heavy"
      };
    }
  }
  return { scale: "moderate" };
}

function assessStructuralComplexity(text: string, domainCount: number, matched: TheoremSuggestion[]) {
  const reasons: string[] = [];
  const length = text.length;
  const sentenceCount = text.split(SENTENCE_SPLIT_RE).filter(part => part.trim()).length;
  const constraintCount = countMatches(text, CONSTRAINT_RE);
  const multistepCount = countMatches(text, MULTISTEP_RE);

  if (length > 500 || sentenceCount > 6) reasons.push(`long problem (length=${length}, sentences=${sentenceCount})`);
  if (domainCount >= 3) reasons.push(`multi-domain (${domainCount} domains)`);
  if (constraintCount >= 3) reasons.push(`many constraints (${constraintCount})`);
  if (multistepCount >= 2) reasons.push(`multi-step (${multistepCount} steps)`);
  if (requiresTheoryFirstConstruction(text, matched)) reasons.push("analysis theorem-first task");

  return {
    isComplex: reasons.length >= 2,
    reasons,
    domainCount,
    constraintCount,
    length
  };
}

function requiresTheoryFirstConstruction(text: string, matched: TheoremSuggestion[]): boolean {
  const patterns = [/uniform/i, /compact/i, /dominat/i, /holomorphic/i, /contour/i, /asymptotic/i, /weak/i, /maximum principle/i, /barrier/i, /hessian/i, /variational/i];
  const signalCount = patterns.filter(pattern => pattern.test(text)).length;
  const hasAnalysisTheorem = matched.some(item => item.domains.some(domain => ANALYSIS_DOMAINS.has(domain)));
  return signalCount >= 3 || (signalCount >= 2 && hasAnalysisTheorem);
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

function countMatches(text: string, regex: RegExp): number {
  regex.lastIndex = 0;
  let count = 0;
  while (regex.exec(text)) count += 1;
  regex.lastIndex = 0;
  return count;
}
