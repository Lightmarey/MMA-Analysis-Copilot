import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";

export const transformConvergenceToolDefinitions: ToolDefinition[] = [
  defineTool(
  "wolfram_convergence",
  "Check analysis convergence conditions for infinite sums or parameter-dependent definite integrals.",
  {
    expr: { type: "string", description: "Summand or integrand in Wolfram Language InputForm syntax." },
    variable: { type: "string", description: "Summation or integration variable." },
    lower: { type: "string", description: "Lower bound, or empty string for an indefinite sum convergence check." },
    upper: { type: "string", description: "Upper bound, e.g. Infinity, or empty string." },
    operation: { type: "string", enum: ["SumConvergence", "IntegralConditions"], description: "Use SumConvergence for series; use IntegralConditions to return GenerateConditions from a definite integral." },
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
