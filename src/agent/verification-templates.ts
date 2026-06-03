import type { WolframBackend } from "../wolfram/backend.js";
import type { WolframResponse } from "../wolfram/types.js";

export const verificationTemplateNames = [
  "integration_by_parts_product_rule",
  "energy_boundary_cancellation",
  "fourier_coefficient",
  "candidate_solution_check"
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
