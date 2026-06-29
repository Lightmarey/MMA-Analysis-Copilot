import OpenAI from "openai";
import { config } from "../../config.js";
import { llmCallText, jsonifyWithWeakModel } from "../json-utils.js";
import { loadTheorems } from "./theorem-library.js";
import type { TheoremEntry, TheoremSuggestion } from "./types.js";

export async function matchTheorems(client: OpenAI, text: string): Promise<TheoremSuggestion[]> {
  const library = loadTheorems();
  const librarySummary = library.map(t => `- **${t.name}**. Keywords: ${t.keywords.join(", ")}\n  Reduces: ${t.reduces}`).join("\n");

  const systemPrompt = `You are a mathematical theorem recommender. 
Given the user's problem description, select the most relevant theorems from the following library that could help solve or simplify the problem.
If no theorems apply, say so.
Explain your reasoning for each selected theorem.

Library:
${librarySummary}
`;
  
  const reasoning = await llmCallText(client, config.proModel, systemPrompt, text);
  if (!reasoning) {
    return [];
  }

  const schema = `{
  "matches": [
    {
      "theoremName": "string (must match a theorem name from the library)",
      "score": "number (1 to 5, where 5 is highly relevant)",
      "confidence": "'high' | 'medium' | 'low'"
    }
  ]
}`;

  const extracted = await jsonifyWithWeakModel<{
    matches?: { theoremName: string; score: number; confidence: "high" | "medium" | "low" }[]
  }>(client, reasoning, schema);

  const matchedSuggestions: TheoremSuggestion[] = [];
  if (extracted && extracted.matches) {
    for (const match of extracted.matches) {
      const entry = library.find(t => t.name.toLowerCase() === match.theoremName.toLowerCase());
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
          confidence: match.confidence,
          score: match.score
        });
      }
    }
  }

  return matchedSuggestions.sort((a, b) => b.score - a.score);
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
