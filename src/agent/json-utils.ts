import OpenAI from "openai";
import { config } from "../config.js";

export function extractJson<T = any>(text: string): T | null {
  try {
    // 1. Try to parse directly first
    return JSON.parse(text) as T;
  } catch {
    // 2. Try to find a JSON code block
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonBlockRegex);
    let jsonStr = match ? match[1] : text;

    // 3. Fallback: try to find the first '{' or '[' and the last '}' or ']'
    if (!match) {
      const startObj = text.indexOf('{');
      const startArr = text.indexOf('[');
      const endObj = text.lastIndexOf('}');
      const endArr = text.lastIndexOf(']');

      let start = -1;
      let end = -1;

      if (startObj !== -1 && startArr !== -1) {
        start = Math.min(startObj, startArr);
      } else {
        start = Math.max(startObj, startArr);
      }

      end = Math.max(endObj, endArr);

      if (start !== -1 && end !== -1 && end > start) {
        jsonStr = text.substring(start, end + 1);
      }
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      // 4. Basic repairs
      // Remove trailing commas
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
      // Escape unescaped newlines in strings (rudimentary)
      // Note: this might break actual newlines outside strings, but is a basic repair
      try {
        return JSON.parse(jsonStr) as T;
      } catch {
        return null;
      }
    }
  }
}

export async function llmCallText(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string | null> {
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0,
      max_tokens: maxTokens
    });
    return response.choices[0]?.message?.content || null;
  } catch (e) {
    console.error("LLM Text call failed:", e);
    return null;
  }
}

export async function llmCallJson<T>(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1200
): Promise<T | null> {
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return extractJson<T>(content);
  } catch (e) {
    console.error("LLM JSON call failed:", e);
    return null;
  }
}

export async function jsonifyWithWeakModel<T>(
  client: OpenAI,
  text: string,
  jsonSchemaDescription: string,
  model = config.plannerModel || config.flashModel
): Promise<T | null> {
  const systemPrompt = `You are a data extraction utility. Your only job is to extract the relevant information from the user's text and output it STRICTLY as a valid JSON object. Do not output any markdown formatting, explanations, or text outside the JSON object.\n\nThe JSON must follow this structure:\n${jsonSchemaDescription}`;
  return await llmCallJson<T>(client, model, systemPrompt, text);
}
