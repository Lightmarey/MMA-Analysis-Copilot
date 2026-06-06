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
import { collectStreamedMessage } from "./streaming.js";
import type { AgentToolName, LocalToolName } from "./tools.js";
import type { WolframResponse } from "../wolfram/types.js";
import { hookResultsToPrompt, runAgentHooks, type AgentHookResult, type ToolHistoryEntry } from "./hooks.js";

export type AgentCallbacks = {
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, markdown: string, result: WolframResponse) => void;
  onHook?: (result: AgentHookResult) => void;
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
    const difficulty = resolveDifficulty(llmPlan, localDifficulty, analysis);
    const mergedLlmPlan: LlmExecutionPlan | null = llmPlan
      ? {
          ...llmPlan,
          difficulty
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
      const preplanContext = (mergedLlmPlan
        ? `${buildLlmPlanContext(mergedLlmPlan)}\n\n${localPreplanContext}`
        : localPreplanContext);
      callbacks.onPlan?.(preplanContext);
      this.messages.push({ role: "system", content: preplanContext });
    }
    const collected: string[] = [];
    let sawToolCall = false;
    const toolHistory: ToolHistoryEntry[] = [];
    const firedHookIds = new Set<string>();

    if (config.preplanEnabled && config.hookMode !== "off") {
      const afterPlanHooks = runAgentHooks({
        phase: "after_plan",
        userMessage,
        planContext: this.messages.at(-1)?.role === "system" ? String(this.messages.at(-1)?.content ?? "") : "",
        messages: this.messages,
        toolHistory,
        firedHookIds
      });
      emitHooks(afterPlanHooks, callbacks, firedHookIds);
      pushHookPrompt(this.messages, afterPlanHooks);
    }

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
        const finalText = collected.join("\n\n").trim();
        const beforeFinalHooks = config.hookMode === "off" ? [] : runAgentHooks({
          phase: "before_final",
          userMessage,
          messages: this.messages,
          toolHistory,
          finalText,
          firedHookIds
        });
        emitHooks(beforeFinalHooks, callbacks, firedHookIds);
        const beforeFinalPrompt = shouldInjectBeforeFinalPrompt(beforeFinalHooks)
          ? hookResultsToPrompt(beforeFinalHooks, { maxChars: config.hookPromptMaxChars })
          : "";
        if (beforeFinalPrompt) {
          this.messages.push({ role: "system", content: beforeFinalPrompt });
          this.messages.push({
            role: "user",
            content: "Use the workflow hook guidance to decide whether a short structured verification is needed before the final answer. If no explicit check is possible, state the missing formula or analytic assumption."
          });
          continue;
        }
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
        const proposedTool: ToolHistoryEntry = { name, args };
        const beforeToolHooks = config.hookMode === "off" ? [] : runAgentHooks({
          phase: "before_tool_call",
          userMessage,
          messages: this.messages,
          toolHistory,
          proposedTool,
          firedHookIds
        });
        emitHooks(beforeToolHooks, callbacks, firedHookIds);
        callbacks.onToolCall?.(name, args);

        const result = await this.callTool(name, args);
        const latestTool: ToolHistoryEntry = { name, args, result };
        toolHistory.push(latestTool);
        const toolText = formatToolResult(name, args, result);
        const toolMarkdown = formatToolResultMarkdown(name, result);
        callbacks.onToolResult?.(name, toolMarkdown, result);

        this.messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolText
        });
        const afterToolHooks = config.hookMode === "off" ? [] : runAgentHooks({
          phase: "after_tool_call",
          userMessage,
          messages: this.messages,
          toolHistory,
          latestTool,
          firedHookIds
        });
        emitHooks(afterToolHooks, callbacks, firedHookIds);
        pushHookPrompt(this.messages, [...beforeToolHooks, ...afterToolHooks]);
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

function emitHooks(results: AgentHookResult[], callbacks: AgentCallbacks, firedHookIds: Set<string>): void {
  for (const result of results) {
    callbacks.onHook?.(result);
    if (result.promptHint) firedHookIds.add(result.id);
  }
}

function pushHookPrompt(messages: ChatCompletionMessageParam[], results: AgentHookResult[]): void {
  if (config.hookMode !== "hint") return;
  const prompt = hookResultsToPrompt(results, { maxChars: config.hookPromptMaxChars });
  if (prompt) messages.push({ role: "system", content: prompt });
}

function shouldInjectBeforeFinalPrompt(results: AgentHookResult[]): boolean {
  if (config.hookMode !== "hint") return false;
  if (config.hookBeforeFinal === "off") return false;
  return results.some(result => result.severity === "warning" || result.severity === "block");
}

function resolveDifficulty(
  llmPlan: LlmExecutionPlan | null,
  localDifficulty: "simple" | "complex",
  analysis: ReturnType<typeof analyzeProblem>
): "simple" | "complex" {
  if (!llmPlan) return localDifficulty;
  if (llmPlan.difficulty === "complex") return "complex";
  const strongLocalEvidence = analysis.scale === "heavy" ||
    analysis.scale === "infeasible_brute_force" ||
    analysis.structuralComplexity.reasons.includes("analysis theorem-first task");
  return strongLocalEvidence && localDifficulty === "complex" ? "complex" : "simple";
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
