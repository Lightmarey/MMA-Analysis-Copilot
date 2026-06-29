import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";
import { verificationTemplateNames } from "../verification-template.js";

export const localToolDefinitions: ToolDefinition[] = [
  defineTool(
  "theorem_advisor",
  "Analyze a math problem before heavy computation. Returns scale, theorem hints, invariants, verification targets, and Wolfram tactics.",
  {
    problem: { type: "string", description: "Full problem statement, including natural language and LaTeX when present." },
    detected_objects: { type: "string", description: "Optional comma-separated known objects, or an empty string." }
  }
),
  defineTool(
  "verification_template",
  "Run a stable proof-verification template by translating supplied formulas into compact Wolfram checks. Use this when the verification shape is already chosen, such as checking a formula identity, applying explicit substitutions, comparing an expected residual, validating a candidate expression, or confirming scale/exponent bookkeeping. Use only formulas supplied by the problem or already derived in the conversation; if a structure is named but no expression is given, state the missing expression instead of inventing a representative one. Do not use it to choose a proof rule or generate an inequality theorem.",
  {
    template: {
      type: "string",
      enum: [...verificationTemplateNames],
      description: "Template name. Use substitution_check for applying explicit rules such as PDE or boundary conditions, and scaling_power_check for exponent cancellation, critical scaling relations, and parameter-balance algebra."
    },
    expr: {
      type: "string",
      description: "Main Wolfram expression, integrand, equality, or inequality to verify. Use an empty string only when the template has a documented default."
    },
    assumptions: {
      type: "string",
      description: "Wolfram assumptions for FullSimplify/Integrate, or empty string."
    },
    variable: {
      type: "string",
      description: "Primary variable such as x or y, or empty string for the template default."
    },
    lower: {
      type: "string",
      description: "Lower integration bound for coefficient templates, or empty string."
    },
    upper: {
      type: "string",
      description: "Upper integration bound for coefficient templates, or empty string."
    },
    expected: {
      type: "string",
      description: "Expected derivative/product-rule right side for equality checks, or empty string."
    },
    claimed: {
      type: "string",
      description: "Claimed coefficient or expression to compare against, or empty string."
    },
    rules: {
      type: "string",
      description: "Wolfram replacement rules for boundary substitutions, e.g. {ux0 -> u0}, or empty string. Use camelCase/plain symbols, not underscores, because underscore is Wolfram pattern syntax."
    }
  }
),
  defineTool(
    "delegate_to_subagent",
    "Delegate a narrow, self-contained mathematical subtask to a bounded subagent. Use only when the subtask can be answered compactly and its result will reduce the main context or tool loop.",
    {
      role: {
        type: "string",
        description: "Short role label for the subagent, e.g. lemma checker, local algebra verifier, or proof outline reviewer."
      },
      task: {
        type: "string",
        description: "The exact subtask to solve. Keep it narrow and include the expected output shape."
      },
      context: {
        type: "string",
        description: "Only the formulas, assumptions, and current proof state needed for this subtask. Do not pass full documents or traces."
      }
    }
  )
];
