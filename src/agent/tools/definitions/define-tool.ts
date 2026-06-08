import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { AgentToolName, ToolDefinition, ToolProperty } from "../names.js";

export function defineTool(name: AgentToolName, description: string, properties: Record<string, ToolProperty>): ToolDefinition {
  const schema: ChatCompletionTool = {
    type: "function",
    function: {
      name,
      description,
      strict: true,
      parameters: {
        type: "object",
        properties,
        required: Object.keys(properties),
        additionalProperties: false
      }
    }
  };
  return { name, description, schema };
}
