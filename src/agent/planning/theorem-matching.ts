import OpenAI from "openai";
import { config } from "../../config.js";
import { llmCallJson } from "../json-utils.js";
import { loadTheorems } from "./theorem-library.js";
import type { PlanningLlmOptions, TheoremEntry, TheoremSuggestion } from "./types.js";

export async function matchTheorems(client: OpenAI | null, text: string, options: PlanningLlmOptions = {}): Promise<TheoremSuggestion[]> {
  const library = loadTheorems();
  const fallback = matchTheoremsDeterministic(text, library);
  if (!client || options.useLlm === false) return fallback;

  const librarySummary = library
    .map(t => `- ${t.name}. Keywords: ${t.keywords.join(", ")}. Reduces: ${t.reduces ?? ""}`)
    .join("\n");

  const systemPrompt = `You are a mathematical theorem recommender.
Given the user's problem description, select the most relevant theorems from the following library that could help solve or simplify the problem.
Return only JSON with a "matches" array. If no theorems apply, return {"matches":[]}.

Library:
${librarySummary}
`;

  const extracted = await llmCallJson<{
    matches?: { theoremName: string; score: number; confidence: "high" | "medium" | "low" }[]
  }>(client, options.model || config.plannerModel || config.flashModel, systemPrompt, text, 900);

  const matchedSuggestions: TheoremSuggestion[] = [];
  if (extracted && Array.isArray(extracted.matches)) {
    for (const match of extracted.matches) {
      const theoremName = readMatchName(match);
      if (!theoremName) continue;
      const entry = library.find(t => t.name.toLowerCase() === theoremName.toLowerCase());
      if (entry) {
        matchedSuggestions.push({
          theorem: entry.name,
          why: entry.reduces ?? "",
          domains: entry.domains,
          prerequisites: entry.prerequisites ?? [],
          invariantHints: entry.invariantHints ?? [],
          verificationHints: entry.verificationHints ?? [],
          preferredRecipe: entry.preferredRecipe ?? [],
          avoidPatterns: entry.avoidPatterns ?? [],
          wolframHint: entry.wolframHint ?? "",
          casHint: entry.casHint || entry.wolframHint || "",
          confidence: readConfidence(match.confidence),
          score: readScore(match.score)
        });
      }
    }
  }

  return matchedSuggestions.length
    ? matchedSuggestions.sort((a, b) => b.score - a.score).slice(0, 6)
    : fallback;
}

function readMatchName(match: { theoremName?: unknown; theorem_name?: unknown; name?: unknown }): string {
  const value = match.theoremName ?? match.theorem_name ?? match.name;
  return typeof value === "string" ? value.trim() : "";
}

function readScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

function readConfidence(value: unknown): TheoremSuggestion["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function matchTheoremsDeterministic(text: string, library: TheoremEntry[]): TheoremSuggestion[] {
  const lowered = text.toLowerCase();
  const scored: Array<{ score: number; theorem: TheoremEntry }> = [];

  for (const theorem of library) {
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
  return scored.slice(0, 6).map(({ score, theorem }) => toSuggestion(theorem, normalizeConfidence(theorem.confidence, score), score));
}

function toSuggestion(theorem: TheoremEntry, confidence: TheoremSuggestion["confidence"], score: number): TheoremSuggestion {
  return {
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
    confidence,
    score
  };
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
