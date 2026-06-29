import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { AgentCallbacks } from "./agent.js";

export type StreamedToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export async function collectStreamedMessage(
  stream: AsyncIterable<unknown>,
  callbacks: Pick<AgentCallbacks, "onThinkingDelta" | "onOutputDelta">,
  abortController?: AbortController
): Promise<{ message: ChatCompletionMessageParam & { tool_calls?: StreamedToolCall[] }; finishReason: string | null }> {
  let content = "";
  let finishReason: string | null = null;
  const toolCalls = new Map<number, StreamedToolCall>();

  let idleTimer: NodeJS.Timeout | null = null;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (abortController) {
      idleTimer = setTimeout(() => abortController.abort(new Error("LLM stream idle timeout (60s)")), 60000);
    }
  };
  resetIdleTimer();

  try {
    for await (const chunk of stream) {
      resetIdleTimer();
      const choice = readFirstChoice(chunk);
      if (!choice) continue;
      if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
      const delta = choice.delta;
      if (!delta || typeof delta !== "object") continue;

      const thinking = readStringProperty(delta, "reasoning_content") || readStringProperty(delta, "reasoning");
      if (thinking) callbacks.onThinkingDelta?.(thinking);

      const output = readStringProperty(delta, "content");
      if (output) {
        content += output;
        callbacks.onOutputDelta?.(output);
      }

      const rawToolCalls = (delta as { tool_calls?: unknown }).tool_calls;
      if (Array.isArray(rawToolCalls)) {
        for (const rawToolCall of rawToolCalls) {
          mergeToolCallDelta(toolCalls, rawToolCall);
        }
      }
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }

  const normalizedToolCalls = [...toolCalls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, toolCall]) => toolCall)
    .filter(toolCall => toolCall.id && toolCall.function.name);
  return {
    message: {
      role: "assistant",
      content: content || null,
      ...(normalizedToolCalls.length ? { tool_calls: normalizedToolCalls } : {})
    },
    finishReason
  };
}

function readFirstChoice(chunk: unknown): { delta?: unknown; finish_reason?: unknown } | null {
  if (!chunk || typeof chunk !== "object") return null;
  const choices = (chunk as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  return choices[0] as { delta?: unknown; finish_reason?: unknown };
}

function readStringProperty(value: unknown, key: string): string {
  if (!value || typeof value !== "object") return "";
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
}

function mergeToolCallDelta(toolCalls: Map<number, StreamedToolCall>, raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  const record = raw as Record<string, unknown>;
  const index = typeof record.index === "number" ? record.index : toolCalls.size;
  const existing = toolCalls.get(index) ?? {
    id: "",
    type: "function" as const,
    function: {
      name: "",
      arguments: ""
    }
  };
  if (typeof record.id === "string") existing.id += record.id;
  if (record.type === "function") existing.type = "function";
  const fn = record.function;
  if (fn && typeof fn === "object") {
    const fnRecord = fn as Record<string, unknown>;
    if (typeof fnRecord.name === "string") existing.function.name += fnRecord.name;
    if (typeof fnRecord.arguments === "string") existing.function.arguments += fnRecord.arguments;
  }
  toolCalls.set(index, existing);
}

