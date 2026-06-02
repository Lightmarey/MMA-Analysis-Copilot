import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { theoremAdvisorTool } from "./planning.js";
import type { WolframToolName, WolframResponse } from "../wolfram/types.js";

export type LocalToolName = "theorem_advisor";
export type AgentToolName = WolframToolName | LocalToolName;

export type ToolDefinition = {
  name: AgentToolName;
  description: string;
  schema: ChatCompletionTool;
};

type ToolProperty = {
  type: "string" | "integer";
  description: string;
  enum?: string[];
};

const wolframToolNames = new Set<string>([
  "wolfram_eval",
  "wolfram_simplify",
  "wolfram_integrate",
  "wolfram_differentiate",
  "wolfram_limit",
  "wolfram_solve",
  "wolfram_algebra",
  "wolfram_matrix",
  "wolfram_series",
  "wolfram_sum",
  "wolfram_dsolve",
  "wolfram_transform",
  "wolfram_residue"
]);

export const toolDefinitions: ToolDefinition[] = [
  defineTool(
    "theorem_advisor",
    "Analyze a math problem before heavy computation. Returns scale, theorem hints, invariants, verification targets, and Wolfram tactics.",
    {
      problem: { type: "string", description: "Full problem statement, including natural language and LaTeX when present." },
      detected_objects: { type: "string", description: "Optional comma-separated known objects, or an empty string." }
    }
  ),
  defineTool(
    "wolfram_eval",
    "Evaluate Wolfram Language code. Use only as an advanced escape hatch when structured tools are not enough.",
    {
      code: {
        type: "string",
        description: "Wolfram Language code in InputForm syntax. The final expression is returned."
      }
    }
  ),
  defineTool(
    "wolfram_simplify",
    "Simplify, refine, or power-expand a Wolfram Language expression with optional assumptions.",
    {
      expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
      assumptions: { type: "string", description: "Wolfram assumptions, e.g. x > 0 && Element[n, Integers], or empty string." },
      operation: { type: "string", enum: ["Simplify", "FullSimplify", "Refine", "PowerExpand"], description: "Simplification operation." }
    }
  ),
  defineTool(
    "wolfram_integrate",
    "Compute an indefinite or definite integral with optional assumptions.",
    {
      expr: { type: "string", description: "Integrand in Wolfram Language InputForm syntax." },
      variable: { type: "string", description: "Integration variable." },
      lower: { type: "string", description: "Lower bound, or empty string for indefinite integrals." },
      upper: { type: "string", description: "Upper bound, or empty string for indefinite integrals." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_differentiate",
    "Differentiate a Wolfram Language expression, optionally multiple times.",
    {
      expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
      variable: { type: "string", description: "Differentiation variable." },
      order: { type: "integer", description: "Derivative order, usually a positive integer." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_limit",
    "Compute a limit with optional assumptions.",
    {
      expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
      variable: { type: "string", description: "Limit variable." },
      point: { type: "string", description: "Limit point, e.g. 0, Infinity." },
      direction: { type: "string", enum: ["Automatic", "FromAbove", "FromBelow", ""], description: "Limit direction, or empty string." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_solve",
    "Solve or reduce equations and inequalities using Wolfram Language. Use == for equations.",
    {
      equations: { type: "string", description: "Equation, inequality, or list of equations in Wolfram syntax." },
      variables: { type: "string", description: "Variable or list of variables in Wolfram syntax." },
      method: { type: "string", enum: ["Solve", "Reduce", "NSolve", "FindInstance"], description: "Solving method." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_algebra",
    "Perform algebraic expression transformations such as Expand, Factor, Apart, Together, Cancel, and Collect.",
    {
      expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
      operation: { type: "string", enum: ["Expand", "Factor", "Apart", "Together", "Cancel", "Collect"], description: "Algebraic operation." },
      variable: { type: "string", description: "Optional variable for Collect, or empty string." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_matrix",
    "Compute matrix determinant, inverse, eigenvalues/eigensystem, characteristic polynomial, row reduction, rank, or trace.",
    {
      matrix: { type: "string", description: "Matrix in Wolfram list syntax, e.g. {{1,2},{3,4}}." },
      operation: { type: "string", enum: ["Det", "Inverse", "Eigenvalues", "Eigensystem", "CharacteristicPolynomial", "RowReduce", "MatrixRank", "Tr"], description: "Matrix operation." },
      variable: { type: "string", description: "Variable for CharacteristicPolynomial, or empty string." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_series",
    "Compute a Taylor/Laurent series expansion and return the normal polynomial/truncated expansion.",
    {
      expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
      variable: { type: "string", description: "Expansion variable." },
      point: { type: "string", description: "Expansion point, e.g. 0, Infinity." },
      order: { type: "integer", description: "Expansion order, usually a nonnegative integer." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_sum",
    "Compute a symbolic finite, infinite, or indefinite sum with optional assumptions.",
    {
      expr: { type: "string", description: "Summand in Wolfram Language InputForm syntax." },
      variable: { type: "string", description: "Summation variable." },
      lower: { type: "string", description: "Lower bound, or empty string for an indefinite sum." },
      upper: { type: "string", description: "Upper bound, e.g. n or Infinity, or empty string." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_dsolve",
    "Solve ordinary differential equations using DSolve, DSolveValue, or NDSolve.",
    {
      equations: { type: "string", description: "Equation or list of equations, e.g. {y'[x] == y[x], y[0] == 1}." },
      functions: { type: "string", description: "Dependent function or list, e.g. y or {x, y}." },
      variable: { type: "string", description: "Independent variable." },
      method: { type: "string", enum: ["DSolve", "DSolveValue", "NDSolve"], description: "Differential equation solver." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_transform",
    "Compute Laplace, Fourier, Mellin, Z, and inverse transforms.",
    {
      expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
      variable: { type: "string", description: "Original variable." },
      targetVariable: { type: "string", description: "Transform-domain variable." },
      transform: {
        type: "string",
        enum: [
          "LaplaceTransform",
          "InverseLaplaceTransform",
          "FourierTransform",
          "InverseFourierTransform",
          "MellinTransform",
          "InverseMellinTransform",
          "ZTransform",
          "InverseZTransform"
        ],
        description: "Transform operation."
      },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_residue",
    "Compute the complex residue of an expression at a point.",
    {
      expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
      variable: { type: "string", description: "Complex variable." },
      point: { type: "string", description: "Residue point, e.g. 0, a, I." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  )
];

export function isWolframToolName(name: string): name is WolframToolName {
  return wolframToolNames.has(name);
}

export function runLocalTool(name: LocalToolName, args: Record<string, unknown>): WolframResponse {
  if (name === "theorem_advisor") {
    return theoremAdvisorTool(args);
  }
  return {
    id: null,
    ok: false,
    title: name,
    error: `Unknown local tool: ${name}`
  };
}

export function formatToolResult(toolName: string, args: unknown, result: WolframResponse): string {
  if (!result.ok) {
    return `Tool ${toolName} failed: ${result.error ?? "unknown error"}`;
  }

  const lines = [`Tool ${toolName} result:`];
  if (result.output) lines.push(toolName === "theorem_advisor" ? `JSON: ${result.output}` : `InputForm: ${result.output}`);
  if (result.latex) lines.push(`LaTeX: ${result.latex}`);
  if (result.messages?.length) lines.push(`Messages: ${result.messages.join(" | ")}`);
  lines.push(`Arguments: ${JSON.stringify(args)}`);
  return lines.join("\n");
}

export function formatToolResultMarkdown(toolName: string, result: WolframResponse): string {
  if (!result.ok) return "";
  if (toolName === "theorem_advisor") {
    const summary = summarizeTheoremAdvisor(result.output ?? "");
    return summary ? `> Theorem advisor: ${summary}` : "";
  }

  const title = result.title || toolName;
  if (result.latex) {
    return `> ${title}: $${result.latex}$`;
  }
  if (result.output) {
    return `> ${title}: \`${result.output}\``;
  }
  return "";
}

function defineTool(name: AgentToolName, description: string, properties: Record<string, ToolProperty>): ToolDefinition {
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

function summarizeTheoremAdvisor(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      scale?: string;
      recommendedApproach?: string;
      suggestedTheorems?: Array<{ theorem?: string }>;
      verificationChecks?: string[];
    };
    const theorem = parsed.suggestedTheorems?.[0]?.theorem;
    const checks = parsed.verificationChecks?.slice(0, 2).join(", ");
    return [
      `scale=${parsed.scale ?? "unknown"}`,
      theorem ? `top=${theorem}` : "",
      parsed.recommendedApproach ? `strategy=${parsed.recommendedApproach}` : "",
      checks ? `verify=${checks}` : ""
    ].filter(Boolean).join("; ");
  } catch {
    return "";
  }
}
