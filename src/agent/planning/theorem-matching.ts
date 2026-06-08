import { loadTheorems } from "./theorem-library.js";
import type { TheoremEntry, TheoremSuggestion } from "./types.js";

export function matchTheorems(text: string): TheoremSuggestion[] {
  const lowered = text.toLowerCase();
  const scored: Array<{ score: number; theorem: TheoremEntry }> = [];

  for (const theorem of loadTheorems()) {
    let score = 0;
    for (const keyword of theorem.keywords) {
      if (lowered.includes(keyword.toLowerCase())) score += 1;
    }
    for (const signal of theorem.signals ?? []) {
      try {
        if (new RegExp(signal, "i").test(text)) score += 2;
      } catch {
        // Ignore invalid theorem-library patterns.
      }
    }
    if (score > 0) scored.push({ score, theorem });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map(({ score, theorem }) => ({
    theorem: theorem.name,
    why: theorem.reduces ?? "",
    domains: theorem.domains,
    prerequisites: theorem.prerequisites ?? [],
    invariantHints: theorem.invariantHints ?? [],
    verificationHints: theorem.verificationHints ?? [],
    preferredRecipe: theorem.preferredRecipe ?? [],
    avoidPatterns: theorem.avoidPatterns ?? [],
    wolframHint: theorem.wolframHint ?? "",
    casHint: theorem.casHint || theorem.wolframHint || "",
    confidence: normalizeConfidence(theorem.confidence, score),
    score
  }));
}

function normalizeConfidence(prior: TheoremEntry["confidence"], score: number): TheoremSuggestion["confidence"] {
  if (prior) return prior;
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

export function suggestInvariants(scaleInfo: Record<string, string | number>, matched: TheoremSuggestion[]): string[] {
  const invariants: string[] = [];
  if (scaleInfo.max_polynomial_degree) invariants.push(`max polynomial degree = ${scaleInfo.max_polynomial_degree}`);
  appendUnique(invariants, uniqueFlatMap(matched, item => [...item.invariantHints, ...item.prerequisites]));
  return invariants;
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
