import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";

export const calculusToolDefinitions: ToolDefinition[] = [
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
  "series_coefficient_check",
  "Verify local expansion coefficients, truncated normal form, and residual order for an already chosen expression. Use this when the expansion point, variable, order, and expected approximation or coefficient are explicit. It does not select the expansion target or justify analytic continuation assumptions.",
  {
    expr: { type: "string", description: "Expression to expand in Wolfram Language InputForm syntax." },
    variable: { type: "string", description: "Expansion variable." },
    point: { type: "string", description: "Expansion point, e.g. 0 or Infinity." },
    order: { type: "integer", description: "Expansion order to compute." },
    expected: { type: "string", description: "Expected truncated expression, coefficient rule, or empty string when only the expansion is requested." },
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
)
];
