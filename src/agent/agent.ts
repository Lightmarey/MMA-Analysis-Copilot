import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "../config.js";
import { WolframBackend } from "../wolfram/backend.js";
import { formatToolResult, formatToolResultMarkdown, isWolframToolName, runLocalTool, toolDefinitions } from "./tools.js";
import { analyzeProblem, buildPreplanContext, classifyDifficulty, createPreplan, decomposeProblem } from "./planning.js";
import { getModelRoute } from "./model-routing.js";
import { buildLlmPlanContext, createLlmExecutionPlan } from "./llm-planning.js";
import type { LlmExecutionPlan } from "./llm-planning.js";
import { runVerificationTemplate } from "./verification-templates.js";
import { buildAgentSystemPrompt } from "./prompts.js";
import type { AgentToolName, LocalToolName } from "./tools.js";
import type { WolframResponse } from "../wolfram/types.js";

export type AgentCallbacks = {
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, markdown: string, result: WolframResponse) => void;
  onRoute?: (difficulty: "simple" | "complex", model: string) => void;
  onPlan?: (context: string) => void;
  onThinkingDelta?: (text: string) => void;
  onOutputDelta?: (text: string) => void;
};

export class MathAgent {
  private readonly client: OpenAI;
  private readonly systemPrompt = buildAgentSystemPrompt();
  private readonly messages: ChatCompletionMessageParam[] = [
    { role: "system", content: this.systemPrompt }
  ];
  private forcedModel: string | null = null;

  constructor(private readonly wolfram = new WolframBackend()) {
    if (!config.openaiApiKey) {
      throw new Error("openai.apiKey is required for agent mode. Set it in ignored wma.config.json or as a temporary OPENAI_API_KEY override.");
    }
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseUrl
    });
  }

  reset(): void {
    this.messages.splice(0, this.messages.length, { role: "system", content: this.systemPrompt });
  }

  setForcedModel(model: string | null): void {
    this.forcedModel = model?.trim() || null;
  }

  getForcedModel(): string | null {
    return this.forcedModel;
  }

  async chat(userMessage: string, callbacks: AgentCallbacks = {}): Promise<string> {
    const modelRoute = await getModelRoute(this.client);
    const llmPlan = await createLlmExecutionPlan(this.client, userMessage, modelRoute.flashModel);
    const analysis = analyzeProblem(userMessage);
    const preplan = createPreplan(userMessage, analysis);
    const decomposition = decomposeProblem(userMessage, analysis);
    const localDifficulty = classifyDifficulty(userMessage, analysis);
    const difficulty = llmPlan?.difficulty === "complex" || localDifficulty === "complex" ? "complex" : "simple";
    const mergedLlmPlan: LlmExecutionPlan | null = llmPlan
      ? {
          ...llmPlan,
          difficulty,
          recommendedTools: [...new Set([...llmPlan.recommendedTools, ...preplan.recommendedTools])]
        }
      : null;
    const routedModel = config.autoRoute
      ? difficulty === "simple"
        ? modelRoute.flashModel
        : modelRoute.proModel
      : modelRoute.defaultModel;
    const effectiveModel = this.forcedModel ?? routedModel;
    callbacks.onRoute?.(difficulty, effectiveModel);

    this.messages.push({ role: "user", content: userMessage });
    if (config.preplanEnabled) {
      const localPreplanContext = buildPreplanContext(analysis, preplan, decomposition);
      const preplanContext = mergedLlmPlan
        ? `${buildLlmPlanContext(mergedLlmPlan)}\n\n${localPreplanContext}`
        : localPreplanContext;
      callbacks.onPlan?.(preplanContext);
      this.messages.push({ role: "system", content: preplanContext });
    }
    const collected: string[] = [];
    let sawToolCall = false;

    for (let iteration = 0; iteration < config.maxIterations; iteration += 1) {
      const stream = await this.client.chat.completions.create({
        model: effectiveModel,
        messages: this.messages,
        tools: toolDefinitions.map(t => t.schema),
        tool_choice: "auto",
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true
      });

      const streamed = await collectStreamedMessage(stream, callbacks);
      const message = streamed.message;
      const hasAssistantPayload = Boolean(message.content || message.tool_calls?.length);
      if (hasAssistantPayload) {
        this.messages.push(message as ChatCompletionMessageParam);
      }

      if (message.content) {
        collected.push(String(message.content));
      }

      if (streamed.finishReason === "length") {
        this.messages.push({
          role: "user",
          content: "Continue from the previous truncated answer. Do not repeat content already written."
        });
        continue;
      }

      if (!message.tool_calls?.length) {
        if (!message.content && sawToolCall) {
          this.messages.push({
            role: "user",
            content: "Continue and complete the final answer using the tool results already obtained. Do not call more tools unless strictly necessary."
          });
          continue;
        }
        return collected.join("\n\n").trim();
      }

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") {
          continue;
        }
        sawToolCall = true;
        const name = toolCall.function.name as AgentToolName;
        const args = safeParseObject(toolCall.function.arguments);
        callbacks.onToolCall?.(name, args);

        const result = await this.callTool(name, args);
        const toolText = formatToolResult(name, args, result);
        const toolMarkdown = formatToolResultMarkdown(name, result);
        if (toolMarkdown) {
          callbacks.onToolResult?.(name, toolMarkdown, result);
        }

        this.messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolText
        });
      }
    }

    return `${collected.join("\n\n").trim()}\n\n> Reached max tool iterations (${config.maxIterations}).`;
  }

  close(): void {
    this.wolfram.close();
  }

  private async callTool(name: AgentToolName, args: Record<string, unknown>) {
    if (isWolframToolName(name)) {
      return await this.wolfram.call(name, args);
    }
    if (name === "verification_template") {
      return await runVerificationTemplate(this.wolfram, args);
    }
    return runLocalTool(name as LocalToolName, args);
  }
}

function safeParseObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

type StreamedToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

async function collectStreamedMessage(
  stream: AsyncIterable<unknown>,
  callbacks: AgentCallbacks
): Promise<{ message: ChatCompletionMessageParam & { tool_calls?: StreamedToolCall[] }; finishReason: string | null }> {
  let content = "";
  let finishReason: string | null = null;
  const toolCalls = new Map<number, StreamedToolCall>();

  for await (const chunk of stream) {
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
