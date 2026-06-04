import type { WolframBackend } from "../wolfram/backend.js";
import type { WolframResponse } from "../wolfram/types.js";

export const verificationTemplateNames = [
  "integration_by_parts_product_rule",
  "energy_boundary_cancellation",
  "fourier_coefficient",
  "candidate_solution_check",
  "first_variation_derivative",
  "parameter_absorption_check",
  "scaling_power_check",
  "barrier_operator_check",
  "ode_residual_check",
  "radial_laplacian_check",
  "kelvin_power_check",
  "hessian_matrix_invariants"
] as const;

export type VerificationTemplateName = typeof verificationTemplateNames[number];

export async function runVerificationTemplate(
  backend: WolframBackend,
  args: Record<string, unknown>
): Promise<WolframResponse> {
  const template = readTemplateName(args.template);
  if (!template) {
    return failed("verification_template", `Unknown verification template: ${readString(args.template) || "(empty)"}`);
  }

  switch (template) {
    case "integration_by_parts_product_rule":
      return await verifyProductRule(backend, args);
    case "energy_boundary_cancellation":
      return await simplifyExpression(backend, "Energy boundary cancellation", expressionWithRules(args), readString(args.assumptions));
    case "fourier_coefficient":
      return await verifyFourierCoefficient(backend, args);
    case "candidate_solution_check":
      return await simplifyExpression(backend, "Candidate solution check", readString(args.expr), readString(args.assumptions));
    case "first_variation_derivative":
      return await verifyFirstVariation(backend, args);
    case "parameter_absorption_check":
      return await simplifyExpression(backend, "Parameter absorption check", readString(args.expr), readString(args.assumptions));
    case "scaling_power_check":
      return await simplifyExpression(backend, "Scaling power check", expressionWithRules(args), readString(args.assumptions));
    case "barrier_operator_check":
      return await simplifyExpression(backend, "Barrier operator check", expressionWithRules(args), readString(args.assumptions));
    case "ode_residual_check":
      return await simplifyExpression(backend, "ODE residual check", expressionWithRules(args), readString(args.assumptions));
    case "radial_laplacian_check":
      return await verifyRadialLaplacian(backend, args);
    case "kelvin_power_check":
      return await simplifyExpression(backend, "Kelvin power check", expressionWithRules(args), readString(args.assumptions));
    case "hessian_matrix_invariants":
      return await matrixInvariants(backend, args);
  }
}

async function verifyProductRule(backend: WolframBackend, args: Record<string, unknown>): Promise<WolframResponse> {
  const expr = readString(args.expr) || "D[u[x,t], x] D[u[x,t], t]";
  const variable = readString(args.variable) || "x";
  const expected = readString(args.expected);
  if (!expected) {
    return await backend.call("wolfram_differentiate", {
      expr,
      variable,
      order: 1,
      assumptions: readString(args.assumptions)
    });
  }
  return await simplifyExpression(
    backend,
    "Integration by parts product rule",
    `D[${parenthesize(expr)}, ${variable}] == ${parenthesize(expected)}`,
    readString(args.assumptions)
  );
}

async function verifyFourierCoefficient(backend: WolframBackend, args: Record<string, unknown>): Promise<WolframResponse> {
  const expr = readString(args.expr);
  const variable = readString(args.variable) || "y";
  const lower = readString(args.lower) || "0";
  const upper = readString(args.upper) || "1";
  const assumptions = readString(args.assumptions) || "Element[n, Integers] && n > 0";
  if (!expr) return failed("Fourier coefficient", "Template requires expr for the coefficient integrand.");

  const computed = await backend.call("wolfram_integrate", { expr, variable, lower, upper, assumptions });
  const claimed = readString(args.claimed);
  if (!computed.ok || !claimed || !computed.output) return withTitle(computed, "Fourier coefficient");

  const comparison = await backend.call("wolfram_simplify", {
    expr: `${parenthesize(computed.output)} == ${parenthesize(claimed)}`,
    assumptions,
    operation: "FullSimplify"
  });
  return {
    ...comparison,
    title: "Fourier coefficient comparison",
    messages: [
      `computed=${computed.output}`,
      ...(comparison.messages ?? [])
    ]
  };
}

async function verifyFirstVariation(backend: WolframBackend, args: Record<string, unknown>): Promise<WolframResponse> {
  const expr = readString(args.expr);
  const variable = readString(args.variable) || "t";
  const assumptions = readString(args.assumptions);
  if (!expr) return failed("First variation derivative", "Template requires expr.");
  const derivative = `D[${parenthesize(expr)}, ${variable}] /. ${variable} -> 0`;
  const claimed = readString(args.claimed);
  if (!claimed) {
    return withTitle(await backend.call("wolfram_simplify", {
      expr: derivative,
      assumptions,
      operation: "FullSimplify"
    }), "First variation derivative");
  }
  return withTitle(await backend.call("wolfram_simplify", {
    expr: `${parenthesize(derivative)} == ${parenthesize(claimed)}`,
    assumptions,
    operation: "FullSimplify"
  }), "First variation comparison");
}

async function verifyRadialLaplacian(backend: WolframBackend, args: Record<string, unknown>): Promise<WolframResponse> {
  const expr = readString(args.expr) || "u[r]";
  const variable = readString(args.variable) || "r";
  const assumptions = readString(args.assumptions);
  const dimension = readDimension(args) || "n";
  const radial = `D[${parenthesize(expr)}, {${variable}, 2}] + (${dimension} - 1)/${variable} D[${parenthesize(expr)}, ${variable}]`;
  const claimed = readString(args.claimed);
  if (!claimed) {
    return withTitle(await backend.call("wolfram_simplify", {
      expr: radial,
      assumptions,
      operation: "FullSimplify"
    }), "Radial Laplacian");
  }
  return withTitle(await backend.call("wolfram_simplify", {
    expr: `${parenthesize(radial)} == ${parenthesize(claimed)}`,
    assumptions,
    operation: "FullSimplify"
  }), "Radial Laplacian comparison");
}

async function matrixInvariants(backend: WolframBackend, args: Record<string, unknown>): Promise<WolframResponse> {
  const matrix = readString(args.expr);
  const variable = readString(args.variable) || "lambda";
  const assumptions = readString(args.assumptions);
  if (!matrix) return failed("Hessian matrix invariants", "Template requires expr as a Wolfram matrix.");
  const code = [
    `mat = ${matrix};`,
    `<|"Trace" -> FullSimplify[Tr[mat], ${assumptionOrTrue(assumptions)}],`,
    `"Det" -> FullSimplify[Det[mat], ${assumptionOrTrue(assumptions)}],`,
    `"PrincipalMinors" -> Table[Minors[mat, k], {k, 1, Length[mat]}],`,
    `"CharacteristicPolynomial" -> FullSimplify[CharacteristicPolynomial[mat, ${variable}], ${assumptionOrTrue(assumptions)}]|>`
  ].join("\n");
  return withTitle(await backend.call("wolfram_eval", { code }), "Hessian matrix invariants");
}

async function simplifyExpression(
  backend: WolframBackend,
  title: string,
  expr: string,
  assumptions: string
): Promise<WolframResponse> {
  if (!expr) return failed(title, "Template requires expr.");
  const result = await backend.call("wolfram_simplify", {
    expr,
    assumptions,
    operation: "FullSimplify"
  });
  return withTitle(result, title);
}

function expressionWithRules(args: Record<string, unknown>): string {
  const expr = readString(args.expr);
  const rules = readString(args.rules);
  return expr && rules ? `${parenthesize(expr)} /. ${rules}` : expr;
}

function withTitle(result: WolframResponse, title: string): WolframResponse {
  return { ...result, title };
}

function failed(title: string, error: string): WolframResponse {
  return {
    id: null,
    ok: false,
    title,
    error,
    elapsedMs: 0
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readTemplateName(value: unknown): VerificationTemplateName | null {
  const raw = readString(value);
  return verificationTemplateNames.includes(raw as VerificationTemplateName)
    ? raw as VerificationTemplateName
    : null;
}

function parenthesize(expr: string): string {
  const trimmed = expr.trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed : `(${trimmed})`;
}

function readDimension(args: Record<string, unknown>): string {
  const fromExpected = readString(args.expected);
  const match = fromExpected.match(/(?:dimension|dim|n)\s*=\s*([A-Za-z0-9]+)/i);
  return match?.[1] ?? "";
}

function assumptionOrTrue(assumptions: string): string {
  return assumptions || "True";
}
