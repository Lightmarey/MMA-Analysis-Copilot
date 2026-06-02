import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { WolframToolName, WolframResponse } from "../wolfram/types.js";

export type ToolDefinition = {
  name: WolframToolName;
  description: string;
  schema: ChatCompletionTool;
};

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "wolfram_eval",
    description: "Evaluate Wolfram Language code.",
    schema: {
      type: "function",
      function: {
        name: "wolfram_eval",
        description: "Evaluate Wolfram Language code. Use this for computations not covered by the structured tools.",
        strict: true,
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Wolfram Language code in InputForm syntax. The final expression is returned."
            }
          },
          required: ["code"],
          additionalProperties: false
        }
      }
    }
  },
  {
    name: "wolfram_simplify",
    description: "Simplify a Wolfram Language expression with optional assumptions.",
    schema: {
      type: "function",
      function: {
        name: "wolfram_simplify",
        description: "Simplify a Wolfram Language expression with optional assumptions.",
        strict: true,
        parameters: {
          type: "object",
          properties: {
            expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
            assumptions: { type: "string", description: "Optional Wolfram assumptions, e.g. x > 0 && Element[n, Integers]." },
            operation: { type: "string", description: "One of Simplify, FullSimplify, Refine, PowerExpand." }
          },
          required: ["expr", "assumptions", "operation"],
          additionalProperties: false
        }
      }
    }
  },
  {
    name: "wolfram_integrate",
    description: "Compute an indefinite or definite integral with optional assumptions.",
    schema: {
      type: "function",
      function: {
        name: "wolfram_integrate",
        description: "Compute an indefinite or definite integral with optional assumptions.",
        strict: true,
        parameters: {
          type: "object",
          properties: {
            expr: { type: "string", description: "Integrand in Wolfram Language InputForm syntax." },
            variable: { type: "string", description: "Integration variable." },
            lower: { type: "string", description: "Lower bound, or empty string for indefinite integrals." },
            upper: { type: "string", description: "Upper bound, or empty string for indefinite integrals." },
            assumptions: { type: "string", description: "Optional assumptions." }
          },
          required: ["expr", "variable", "lower", "upper", "assumptions"],
          additionalProperties: false
        }
      }
    }
  },
  {
    name: "wolfram_limit",
    description: "Compute a limit with optional assumptions.",
    schema: {
      type: "function",
      function: {
        name: "wolfram_limit",
        description: "Compute a limit with optional assumptions.",
        strict: true,
        parameters: {
          type: "object",
          properties: {
            expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
            variable: { type: "string", description: "Limit variable." },
            point: { type: "string", description: "Limit point, e.g. 0, Infinity." },
            direction: { type: "string", description: "Optional: Automatic, FromAbove, FromBelow, or empty string." },
            assumptions: { type: "string", description: "Optional assumptions." }
          },
          required: ["expr", "variable", "point", "direction", "assumptions"],
          additionalProperties: false
        }
      }
    }
  },
  {
    name: "wolfram_solve",
    description: "Solve or reduce equations using Wolfram Language.",
    schema: {
      type: "function",
      function: {
        name: "wolfram_solve",
        description: "Solve or reduce equations using Wolfram Language. Use == for equations.",
        strict: true,
        parameters: {
          type: "object",
          properties: {
            equations: { type: "string", description: "Equation, inequality, or list of equations in Wolfram syntax." },
            variables: { type: "string", description: "Variable or list of variables in Wolfram syntax." },
            method: { type: "string", description: "One of Solve, Reduce, NSolve, FindInstance." },
            assumptions: { type: "string", description: "Optional assumptions." }
          },
          required: ["equations", "variables", "method", "assumptions"],
          additionalProperties: false
        }
      }
    }
  }
];

export function formatToolResult(toolName: string, args: unknown, result: WolframResponse): string {
  if (!result.ok) {
    return `Tool ${toolName} failed: ${result.error ?? "unknown error"}`;
  }

  const lines = [`Tool ${toolName} result:`];
  if (result.output) lines.push(`InputForm: ${result.output}`);
  if (result.latex) lines.push(`LaTeX: ${result.latex}`);
  if (result.messages?.length) lines.push(`Messages: ${result.messages.join(" | ")}`);
  lines.push(`Arguments: ${JSON.stringify(args)}`);
  return lines.join("\n");
}

export function formatToolResultMarkdown(toolName: string, result: WolframResponse): string {
  if (!result.ok) return "";
  const title = result.title || toolName;
  if (result.latex) {
    return `> ${title}: $${result.latex}$`;
  }
  if (result.output) {
    return `> ${title}: \`${result.output}\``;
  }
  return "";
}
