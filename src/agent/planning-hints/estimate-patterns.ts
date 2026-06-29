import OpenAI from "openai";
import { config } from "../../config.js";
import { llmCallText, jsonifyWithWeakModel } from "../json-utils.js";
import type { EstimatePatternSuggestion } from "../planning/types.js";

type EstimatePatternEntry = {
  id: string;
  name: string;
  why: string;
  mayUse: string[];
  verificationTargets: string[];
  tools: string[];
  firstToolHint?: string;
};

const ESTIMATE_PATTERNS: EstimatePatternEntry[] = [
  {
    id: "scale_power_substitution",
    name: "Scale power substitution",
    why: "scale power substitutions are used to track powers through PDE terms and normalizations without evaluating limits yet",
    mayUse: [
      "substitute scale powers directly using ReplaceAll (/. rule)",
      "avoid Limit or Reduce for pure power tracking",
      "compare the exponents algebraically using PowerExpand or FullSimplify after substitution"
    ],
    verificationTargets: [
      "substituted algebraic exponents",
      "residual powers of the scaling parameter",
      "homogeneity or balance condition equations"
    ],
    tools: ["wolfram_simplify"]
  },
  {
    id: "parameter_absorption",
    name: "Parameter absorption",
    why: "parameter absorption is used to absorb a small term C * epsilon * norm(u) into the left-hand side (1 - C * epsilon) * norm(u)",
    mayUse: [
      "verify that (1 - C * epsilon) > 0 algebraically under the stated assumptions on epsilon",
      "put C > 0 and epsilon > 0 into the Assumptions list",
      "do not use Reduce on the entire inequality; just verify the coefficient is positive"
    ],
    verificationTargets: [
      "positivity of the absorption coefficient (1 - C * epsilon) > 0"
    ],
    tools: ["verification_template:parameter_absorption_check", "wolfram_simplify"]
  },
  {
    id: "small_parameter_residual",
    name: "Small parameter residual limit",
    why: "small-parameter residual claims should be checked by normalized ratios or limiting signs",
    mayUse: [
      "normalize the residual by the claimed dominant scale",
      "check the limiting ratio or sign under explicit parameter assumptions",
      "separate computable residual algebra from analytic maximum-principle input"
    ],
    verificationTargets: [
      "normalized residual ratio",
      "limit or sign of the normalized residual",
      "analytic assumptions left outside Wolfram"
    ],
    tools: ["wolfram_simplify", "wolfram_limit"]
  },
  {
    id: "flat_pohozaev_profile_algebra",
    name: "Flat Pohozaev profile algebra",
    why: "the limit-profile Pohozaev algebra consists of several small identities under the same assumptions",
    mayUse: [
      "combine the derivative, coefficient, and integrand equalities as a Wolfram list in one FullSimplify call",
      "use Implies[...] or Reduce only for the A = B consequence, not for each scalar identity"
    ],
    verificationTargets: [
      "derivative condition reduces to ((n-2)/2)*(B-A)",
      "A+B==1 with A==B gives A==B==1/2",
      "v(1), radial derivative, and flat Pohozaev coefficient"
    ],
    tools: ["wolfram_simplify"]
  },
  {
    id: "transition_rescaling_powers",
    name: "Transition rescaling powers",
    why: "transition-barrier rescaling needs simultaneous tau and s substitutions, and Wolfram variable names cannot use underscores",
    mayUse: [
      "rename symbols with underscores to camelCase before calling Wolfram, e.g. tau_y -> tauy",
      "combine rescaled source and boundary terms in one Wolfram list",
      "check rho-control as the full inequality list, not by proving a stricter rho < 2*c0 side goal"
    ],
    verificationTargets: [
      "rho power cancellation after tau and s are both rescaled",
      "remaining rho factor bounded by 2*c0"
    ],
    tools: ["wolfram_simplify"]
  },
  {
    id: "appendix_lower_bound_scaling",
    name: "Appendix lower-bound scaling",
    why: "appendix lower-bound checks are a short ledger: lower-bound scaling, radius scaling, and a coercivity radius threshold",
    firstToolHint: "Run wolfram_simplify first with expr={u/M >= Lambda/M, M^(-2/(n-2))*Y <= delta/2 /. Y -> (delta/2)*M^(2/(n-2)), Reduce[cn - CR*CP*r^2 >= cn/2 && cn > 0 && CR > 0 && CP > 0 && r > 0, r, Reals] == (0 < r <= Sqrt[cn/(2*CR*CP)])}.",
    mayUse: [
      "use one wolfram_simplify list for the explicit algebraic ledger",
      "check radius scaling by substituting Y -> (delta/2)*M^(2/(n-2)) in M^(-2/(n-2))*Y <= delta/2",
      "leave isolated singularity positivity, Lax-Milgram, Harnack, maximum principle, and Hopf lemma as analytic assumptions"
    ],
    verificationTargets: [
      "lower bound propagation through v = M^-1 u",
      "outer radius scaling cancellation",
      "coercivity threshold r <= Sqrt[cn/(2*CR*CP)]"
    ],
    tools: ["wolfram_simplify"]
  },
  {
    id: "kelvin_base_comparison",
    name: "Kelvin base comparison",
    why: "Kelvin base comparisons reduce to one denominator factorization and a sign ledger; direct Reduce on baseV > baseK branches over irrelevant sign cases",
    firstToolHint: "Run wolfram_simplify first with expr={(lambda^4+a^2*r2+2*a*lambda^2*yn)-lambda^2*(r2+2*a*yn+a^2)==(a^2-lambda^2)*(r2-lambda^2), ...}",
    mayUse: [
      "verify the denominator difference factorization before comparing bases",
      "verify baseV/baseK - 1 equals the factored numerator over the positive denominator",
      "check denominator positivity and r2-lambda^2 positivity separately",
      "verify the three sign cases as lambda<a, lambda==a, and lambda>a implications before summarizing"
    ],
    verificationTargets: [
      "Kelvin denominator factorization",
      "baseV/baseK minus one sign numerator",
      "lambda < a, lambda == a, lambda > a sign cases"
    ],
    tools: ["wolfram_simplify"]
  }
];

export async function matchEstimatePatterns(client: OpenAI, text: string): Promise<EstimatePatternSuggestion[]> {
  const librarySummary = ESTIMATE_PATTERNS.map(p => `- **${p.name}** (ID: ${p.id}): ${p.why}`).join("\n");

  const systemPrompt = `You are an expert at identifying estimation and bounding patterns in mathematical proofs.
Given the user's problem description or text snippet, identify up to 4 estimation patterns from the following list that are likely to be useful for the analysis.
Explain why you selected them.

Patterns:
${librarySummary}`;

  const reasoning = await llmCallText(client, config.proModel, systemPrompt, text);
  if (!reasoning) {
    return [];
  }

  const schema = `{
  "matches": [
    {
      "patternId": "string (must exactly match the id from the list)",
      "score": "number (1 to 5, where 5 is highly confident)"
    }
  ]
}`;

  const extracted = await jsonifyWithWeakModel<{
    matches?: { patternId: string; score: number }[]
  }>(client, reasoning, schema);

  const suggestions: EstimatePatternSuggestion[] = [];
  if (extracted && extracted.matches) {
    for (const match of extracted.matches) {
      const entry = ESTIMATE_PATTERNS.find(p => p.id === match.patternId);
      if (entry) {
        suggestions.push({
          id: entry.id,
          name: entry.name,
          why: entry.why,
          mayUse: entry.mayUse,
          verificationTargets: entry.verificationTargets,
          tools: entry.tools,
          firstToolHint: entry.firstToolHint ?? "",
          score: match.score
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.score - a.score);
}
