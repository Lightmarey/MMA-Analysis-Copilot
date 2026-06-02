import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "../config.js";
import { WolframBackend } from "../wolfram/backend.js";
import { formatToolResult, formatToolResultMarkdown, isWolframToolName, runLocalTool, toolDefinitions } from "./tools.js";
import { analyzeProblem, buildPreplanContext, classifyDifficulty, createPreplan } from "./planning.js";
import type { AgentToolName, LocalToolName } from "./tools.js";

const SYSTEM_PROMPT = `You are a careful mathematical assistant.

You may call Wolfram Engine tools for exact symbolic computation.

Rules:
- Use tools for exact computation instead of mental arithmetic.
- Prefer structured tools before wolfram_eval.
- wolfram_eval is an advanced escape hatch. Use it only when structured tools are not enough.
- Use Wolfram Language syntax in tool arguments.
- Follow injected preplanning context, especially theorem, invariant, and verification targets.
- For heavy or infeasible problems, do theorem-first reduction before brute-force computation.
- Explain the reasoning in concise Markdown.
- Use LaTeX for mathematical formulas.
- Reply in the user's language unless they ask otherwise.
- If Wolfram returns conditions, mention them explicitly.
- Do not invent tool results.`;

export type AgentCallbacks = {
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, markdown: string) => void;
  onRoute?: (difficulty: "simple" | "complex", model: string) => void;
  onPlan?: (context: string) => void;
};

export class MathAgent {
  private readonly client: OpenAI;
  private readonly messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT }
  ];

  constructor(private readonly wolfram = new WolframBackend()) {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required for agent mode.");
    }
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseUrl
    });
  }

  reset(): void {
    this.messages.splice(0, this.messages.length, { role: "system", content: SYSTEM_PROMPT });
  }

  async chat(userMessage: string, callbacks: AgentCallbacks = {}): Promise<string> {
    const analysis = analyzeProblem(userMessage);
    const preplan = createPreplan(userMessage, analysis);
    const difficulty = classifyDifficulty(userMessage, analysis);
    const effectiveModel = config.autoRoute
      ? difficulty === "simple"
        ? config.flashModel
        : config.proModel
      : config.model;
    callbacks.onRoute?.(difficulty, effectiveModel);

    this.messages.push({ role: "user", content: userMessage });
    if (config.preplanEnabled) {
      const preplanContext = buildPreplanContext(analysis, preplan);
      callbacks.onPlan?.(preplanContext);
      this.messages.push({ role: "system", content: preplanContext });
    }
    const collected: string[] = [];

    for (let iteration = 0; iteration < config.maxIterations; iteration += 1) {
      const response = await this.client.chat.completions.create({
        model: effectiveModel,
        messages: this.messages,
        tools: toolDefinitions.map(t => t.schema),
        tool_choice: "auto",
        max_tokens: config.maxTokens,
        temperature: config.temperature
      });

      const choice = response.choices[0];
      const message = choice.message;
      this.messages.push(message as ChatCompletionMessageParam);

      if (message.content) {
        collected.push(message.content);
      }

      if (!message.tool_calls?.length) {
        return collected.join("\n\n").trim();
      }

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") {
          continue;
        }
        const name = toolCall.function.name as AgentToolName;
        const args = safeParseObject(toolCall.function.arguments);
        callbacks.onToolCall?.(name, args);

        const result = await this.callTool(name, args);
        const toolText = formatToolResult(name, args, result);
        const toolMarkdown = formatToolResultMarkdown(name, result);
        if (toolMarkdown) {
          collected.push(toolMarkdown);
          callbacks.onToolResult?.(name, toolMarkdown);
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
