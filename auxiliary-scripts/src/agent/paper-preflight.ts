import OpenAI from "openai";
import { config } from "../../../src/config.js";
import { llmCallJson } from "../../../src/agent/json-utils.js";

export type PaperPreflightClass = "symbolic-checkable" | "qualitative-only" | "needs-author-data";

export type PaperPreflight = {
  class: PaperPreflightClass;
  method: string;
  symbolicTools: string[];
  missing: string[];
  evidence: string[];
  maxToolCalls: number;
  recommendedResponse: string;
};

const METHODS_DESCRIPTION = `
Available Methods and their required targets:
1. blowup_analysis: Requires a rescaling formula/blow-up sequence and a limit equation/bubble target.
2. harnack_gradient: Requires a scale-invariant annulus/rescaled function and a target Harnack/gradient inequality.
3. pohozaev_identity: Requires a Pohozaev integral/invariant definition and an identity/flux/error estimate.
4. variational_functional: Requires a functional or one-parameter expression.
5. barrier_construction: Requires a candidate barrier/auxiliary function and an operator/residual.
6. moving_spheres: Requires a Kelvin/inversion formula and a comparison function.
7. ode_reduction: Requires an ODE or radial differential expression.
8. hessian_matrix: Requires an explicit matrix, Hessian, determinant, or principal minors.
9. manifold_integral: Requires an integrand, chart, Jacobian, or measure.
10. inequality_estimate: Requires an explicit inequality, product, sum, or integral expression.
`;

const SYMBOLIC_TOOLS_MAP: Record<string, string[]> = {
  blowup_analysis: ["theorem_advisor", "verification_template:candidate_solution_check", "wolfram_simplify", "formula_transform"],
  harnack_gradient: ["theorem_advisor", "wolfram_simplify", "formula_transform"],
  pohozaev_identity: ["theorem_advisor", "verification_template:first_variation_derivative", "wolfram_simplify", "wolfram_integrate", "formula_transform"],
  variational_functional: ["verification_template:first_variation_derivative", "wolfram_differentiate", "wolfram_simplify", "formula_transform"],
  barrier_construction: ["verification_template:barrier_operator_check", "wolfram_differentiate", "wolfram_simplify", "formula_transform"],
  moving_spheres: ["verification_template:kelvin_power_check", "wolfram_simplify", "wolfram_differentiate", "formula_transform"],
  ode_reduction: ["verification_template:ode_residual_check", "verification_template:radial_laplacian_check", "wolfram_dsolve", "formula_transform"],
  hessian_matrix: ["verification_template:hessian_matrix_invariants", "wolfram_matrix", "wolfram_simplify", "formula_transform"],
  manifold_integral: ["wolfram_integrate", "wolfram_simplify", "wolfram_transform", "formula_transform"],
  inequality_estimate: ["formula_transform", "wolfram_simplify", "verification_template:parameter_absorption_check"]
};

export async function analyzePaperPreflight(client: OpenAI, text: string): Promise<PaperPreflight> {
  const fallback = deterministicPaperPreflight(text);
  const systemPrompt = `You are a mathematical text analyzer.
Analyze the provided excerpt and determine:
1. Which of the following methods best describes the text, if any?
2. What evidence is present in the text, such as explicit formula, display math, cross-reference, or qualitative analytic step?
3. Based on the chosen method's requirements, which specific required targets are missing from the text?

${METHODS_DESCRIPTION}

Return only JSON:
{"method":"exact method name from the list or unknown","missing":["required targets not present"],"evidence":["explicit formula|display math|cross-reference|qualitative analytic step"]}`;

  const extracted = await llmCallJson<{
    method: string;
    missing: string[];
    evidence: string[];
  }>(client, config.plannerModel || config.flashModel, systemPrompt, text, 700);

  if (!extracted) return fallback;
  return buildPreflight(extracted.method, extracted.missing || [], extracted.evidence || [], fallback);
}

export function formatPaperPreflight(preflight: PaperPreflight): string {
  return [
    "Paper-assist preflight:",
    `- class: ${preflight.class}`,
    `- method: ${preflight.method}`,
    `- symbolic_tools: ${preflight.symbolicTools.length ? preflight.symbolicTools.join(", ") : "none"}`,
    `- missing: ${preflight.missing.length ? preflight.missing.join(", ") : "none"}`,
    `- evidence: ${preflight.evidence.length ? preflight.evidence.join(", ") : "none"}`,
    `- max_tool_calls: ${preflight.maxToolCalls}`,
    `- recommended_response: ${preflight.recommendedResponse}`
  ].join("\n");
}

function deterministicPaperPreflight(text: string): PaperPreflight {
  const lowered = text.toLowerCase();
  const method = detectMethod(lowered);
  const evidence = detectEvidence(text);
  const missing = method ? inferMissingTargets(method, lowered, evidence) : ["method-specific local target"];
  return buildPreflight(method || "unknown", missing, evidence);
}

function buildPreflight(method: string, missing: string[], evidence: string[], fallback?: PaperPreflight): PaperPreflight {
  if (!method || method === "unknown" || !SYMBOLIC_TOOLS_MAP[method]) {
    return {
      class: evidence.length ? "qualitative-only" : "needs-author-data",
      method: "unknown",
      symbolicTools: [],
      missing: missing.length ? missing : fallback?.missing ?? ["method-specific local target"],
      evidence: evidence.length ? evidence : fallback?.evidence ?? [],
      maxToolCalls: evidence.length ? 1 : 0,
      recommendedResponse: evidence.length
        ? "Audit the logical structure and ask for the missing symbolic target."
        : "Ask for a concrete local excerpt or formula before using tools."
    };
  }

  const klass: PaperPreflightClass = missing.length === 0
    ? "symbolic-checkable"
    : evidence.length
      ? "needs-author-data"
      : "qualitative-only";

  return {
    class: klass,
    method,
    symbolicTools: SYMBOLIC_TOOLS_MAP[method],
    missing,
    evidence,
    maxToolCalls: klass === "symbolic-checkable" ? 3 : evidence.length ? 1 : 0,
    recommendedResponse: klass === "symbolic-checkable"
      ? "Run only the listed local checks, then separate Wolfram evidence from analytic assumptions."
      : "Do not invent formulas; report missing local data and audit author-side assumptions."
  };
}

function detectMethod(lowered: string): string {
  if (/blow-?up|rescal|bubble|singular/.test(lowered)) return "blowup_analysis";
  if (/harnack|gradient/.test(lowered)) return "harnack_gradient";
  if (/pohozaev|flux/.test(lowered)) return "pohozaev_identity";
  if (/functional|euler-lagrange|nehari|variation/.test(lowered)) return "variational_functional";
  if (/barrier|auxiliary function|subsolution|supersolution/.test(lowered)) return "barrier_construction";
  if (/moving spheres|kelvin|inversion/.test(lowered)) return "moving_spheres";
  if (/\bode\b|radial equation/.test(lowered)) return "ode_reduction";
  if (/hessian|determinant|principal minor|matrix/.test(lowered)) return "hessian_matrix";
  if (/manifold|jacobian|measure|chart/.test(lowered)) return "manifold_integral";
  if (/inequal|estimate|absorb|holder|young|poincare|sobolev/.test(lowered)) return "inequality_estimate";
  return "";
}

function detectEvidence(text: string): string[] {
  const evidence: string[] = [];
  if (/\\begin\{(?:equation|align|aligned|gather|multline)\}|\$\$|\\\[/.test(text)) evidence.push("display math");
  if (/[=<>]|\\le|\\ge|\\int|\\sum|\\Delta|\\nabla/.test(text)) evidence.push("explicit formula");
  if (/\\ref\{|\\eqref\{|Lemma|Theorem|Proposition/.test(text)) evidence.push("cross-reference");
  if (/\b(maximum principle|compactness|regularity|classification)\b/i.test(text)) evidence.push("qualitative analytic step");
  return [...new Set(evidence)];
}

function inferMissingTargets(method: string, lowered: string, evidence: string[]): string[] {
  const missing: string[] = [];
  if (!evidence.some(item => item.includes("formula"))) missing.push("explicit formula");
  if (method === "blowup_analysis" && !/limit|bubble|equation/.test(lowered)) missing.push("limit equation or bubble target");
  if (method === "barrier_construction" && !/operator|residual|delta|laplacian/.test(lowered)) missing.push("operator residual");
  if (method === "moving_spheres" && !/kelvin|inversion|comparison/.test(lowered)) missing.push("Kelvin comparison formula");
  if (method === "pohozaev_identity" && !/identity|integral|flux/.test(lowered)) missing.push("Pohozaev integral or identity");
  return [...new Set(missing)];
}
