import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { theoremAdvisorTool } from "./planning.js";
import { verificationTemplateNames } from "./verification-templates.js";
import type { WolframToolName, WolframResponse } from "../wolfram/types.js";

export type LocalToolName = "theorem_advisor" | "verification_template";
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

export const publicWolframToolNames = [
  "proof_pattern_engine",
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
  "wolfram_convergence",
  "wolfram_dsolve",
  "wolfram_transform",
  "wolfram_residue"
] as const satisfies readonly WolframToolName[];

export const compatWolframToolNames = [
  "inequality_engine"
] as const satisfies readonly WolframToolName[];

export const localToolNames = [
  "theorem_advisor",
  "verification_template"
] as const satisfies readonly LocalToolName[];

export const publicAgentToolNames = [
  ...publicWolframToolNames,
  ...localToolNames
] as const satisfies readonly AgentToolName[];

const wolframToolNames = new Set<string>([
  ...publicWolframToolNames,
  ...compatWolframToolNames
]);

export const toolDefinitions: ToolDefinition[] = [
  defineTool(
    "proof_pattern_engine",
    "Use the Wolfram proof rule/transform engine for proof-state moves such as Holder, Cauchy-Schwarz, Young, parameter choices, Poincare/Sobolev, and integration by parts. It suggests registered moves, records side-condition status, and can compile restricted inert LLM move schemas. It is not a whole-paper verifier.",
    {
      operation: { type: "string", enum: ["normalize", "suggest", "apply", "trace", "registry", "parameter", "compile", "register"], description: "Engine operation: normalize, suggest, apply, trace, registry, parameter, compile, or register." },
      goal: { type: "string", description: "Current proof goal or expression in Wolfram InputForm syntax; empty when state is provided." },
      known: { type: "string", description: "Known facts/expressions in Wolfram InputForm syntax, usually a list, or empty." },
      context: { type: "string", description: "Proof context in Wolfram InputForm syntax, preferably an Association with domain, function spaces, assumptions, and allowed inequalities." },
      state: { type: "string", description: "Existing IneqState association in Wolfram InputForm syntax, or empty to create one from goal/context/known." },
      moveId: { type: "string", description: "Move id returned by suggest, or empty to apply the first suggested move." },
      ruleName: { type: "string", description: "Optional rule name for focused operations, or empty." },
      payload: { type: "string", description: "Operation-specific payload as a Wolfram Association in InputForm. For compile, use only Rule, Transforms, inert string Bindings, and MissingConditions. For parameter, include Direction, Parameter, Condition, and Dependencies." }
    }
  ),
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
    "Run a stable proof-verification template by translating it into compact Wolfram checks. Use this for scalar product-rule identities, boundary substitution/cancellation, substitution-after-assumption checks, Fourier coefficients, candidate solutions, first variations, scaling power/exponent checks, parameter absorption, barrier residuals, ODE/radial checks, Kelvin power algebra, and Hessian matrix invariants. Use only formulas supplied by the problem or already derived in the conversation; if a structure is named but no expression is given, state the missing expression instead of inventing a representative one. For vector-gradient negative-part or trace integration-by-parts arguments, use direct Wolfram component checks for the algebraic part and mark trace/domain facts as analytic assumptions. Do not use it as an inequality theorem generator.",
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
    "wolfram_eval",
    "Evaluate Wolfram Language code. Use only as an advanced escape hatch when structured tools are not enough. Do not use this for simple Simplify/FullSimplify/Refine/Equivalent checks; use wolfram_simplify. Do not use this for Solve/Reduce checks; use wolfram_solve. Do not use this tool to read local files, import documents, or parse prose/LaTeX source; use only the mathematical expressions already supplied in the prompt.",
    {
      code: {
        type: "string",
        description: "Wolfram Language code in InputForm syntax. The final expression is returned."
      }
    }
  ),
  defineTool(
    "wolfram_simplify",
    "Simplify, refine, or power-expand an explicit Wolfram Language expression under stated assumptions. Use this for algebraic, analytic, asymptotic, trigonometric, exponential, sign, monotonicity, and conditional expression simplification when the expression and assumptions are already chosen. Use this, not wolfram_algebra, for plain Simplify/FullSimplify/Refine. For several small identities with the same assumptions, pass a Wolfram list such as {id1, id2, id3} in expr and simplify them together. If this list ledger returns True entries for the requested checks, stop and summarize instead of making confirmatory Reduce calls. Compact derivative identities such as radial Laplacians may put D[...] directly in expr and simplify the combined expression; when substituting after differentiation, write (D[expr, r] /. r -> 1), including each repeated derivative inside a list entry. For scale-ordered power inequalities such as 0 < d <= a, a dimensionless substitution like d -> a*q with 0 < q <= 1 can make the check stable; if q^p <= 1 does not close directly, verify p >= 0 and p*Log[q] <= 0 under 0 < q <= 1, then stop retrying the bare q^p inequality. To verify a conclusion under hypotheses, place the hypotheses in assumptions and simplify/refine the conclusion directly before proving a bare Implies. For inequality equivalence, implication, or logarithmic rearrangement under domain conditions, prefer wolfram_solve with method Reduce. For mathematical equation equivalence or swapped equation sides, simplify Equivalent[...] rather than SameQ/=== unless syntax identity is the actual target. Do not use it to choose a proof rule such as Holder/Young/Cauchy-Schwarz, Poincare/Sobolev, parameter absorption, or integration by parts; use proof_pattern_engine for rule/transform selection and side-condition tracking.",
    {
      expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax. A list such as {id1, id2, id3} is appropriate for a short verification ledger with shared assumptions. For several inequalities under the same hypotheses, put hypotheses in assumptions and pass expr={ineq1, ineq2}; do not wrap a list conclusion as Implies[..., {...}]. Use camelCase/plain symbols, not underscores, because underscore is Wolfram pattern syntax. Do not include Assumptions -> here; use the assumptions field." },
      assumptions: { type: "string", description: "Wolfram assumptions, e.g. x > 0 && Element[n, Integers], or empty string. Put hypotheses here when checking whether a conclusion follows." },
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
    "Solve or reduce equations and inequalities using Wolfram Language. Use == for equations. Prefer method Reduce for conditional inequality equivalence, implication checks, log/exponential rearrangements, and domains with parameters. For a simple proposition or implication already expressed with Implies[...] under assumptions, use wolfram_simplify instead. Provide concrete variables such as x or {x, y}; for a proposition with no variables to solve for, use wolfram_simplify instead of variables={}.",
    {
      equations: { type: "string", description: "Equation, inequality, or list of equations in Wolfram syntax." },
      variables: { type: "string", description: "Variable or list of variables in Wolfram syntax, e.g. x or {x, y}; do not use {}." },
      method: { type: "string", enum: ["Solve", "Reduce", "NSolve", "FindInstance"], description: "Solving method." },
      assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
    }
  ),
  defineTool(
    "wolfram_algebra",
    "Perform named algebraic expression transformations: Expand, Factor, Apart, Together, Cancel, and Collect. For Simplify, FullSimplify, Refine, or PowerExpand, use wolfram_simplify instead.",
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
  if (result.conditions) lines.push(`Conditions: ${result.conditions}`);
  if (result.conditionLatex) lines.push(`Conditions LaTeX: ${result.conditionLatex}`);
  if (result.rawOutput) lines.push(`Raw InputForm: ${result.rawOutput}`);
  if (result.messages?.length) lines.push(`Messages: ${result.messages.join(" | ")}`);
  lines.push(`Arguments: ${JSON.stringify(args)}`);
  return lines.join("\n");
}

export function formatToolResultMarkdown(toolName: string, result: WolframResponse): string {
  if (!result.ok) return `> ${result.title || toolName} failed: ${result.error ?? "unknown error"}`;
  if (toolName === "theorem_advisor") {
    const summary = summarizeTheoremAdvisor(result.output ?? "");
    return summary ? `> Theorem advisor: ${summary}` : "";
  }

  const title = result.title || toolName;
  if (result.latex) {
    return result.conditionLatex
      ? `> ${title}: $${result.latex}$ under $${result.conditionLatex}$`
      : `> ${title}: $${result.latex}$`;
  }
  if (result.output) {
    return result.conditions
      ? `> ${title}: \`${result.output}\` under \`${result.conditions}\``
      : `> ${title}: \`${result.output}\``;
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
