import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "../config.js";
import { WolframBackend } from "../wolfram/backend.js";
import { formatToolResult, formatToolResultMarkdown, toolDefinitions } from "./tools.js";
import type { WolframToolName } from "../wolfram/types.js";

const SYSTEM_PROMPT = `You are a careful mathematical assistant.

You may call Wolfram Engine tools for exact symbolic computation.

Rules:
- Use tools for exact computation instead of mental arithmetic.
- Prefer structured tools before wolfram_eval.
- Use Wolfram Language syntax in tool arguments.
- Explain the reasoning in concise Markdown.
- Use LaTeX for mathematical formulas.
- If Wolfram returns conditions, mention them explicitly.
- Do not invent tool results.`;

export type AgentCallbacks = {
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, markdown: string) => void;
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
    this.messages.push({ role: "user", content: userMessage });
    const collected: string[] = [];

    for (let iteration = 0; iteration < config.maxIterations; iteration += 1) {
      const response = await this.client.chat.completions.create({
        model: config.model,
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
        const name = toolCall.function.name as WolframToolName;
        const args = safeParseObject(toolCall.function.arguments);
        callbacks.onToolCall?.(name, args);

        const result = await this.wolfram.call(name, args);
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
