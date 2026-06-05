export type EstimatePatternEntry = {
  id: string;
  name: string;
  signals: RegExp[];
  why: string;
  mayUse: string[];
  verificationTargets: string[];
  tools: string[];
  minScore?: number;
};

export type EstimatePatternSuggestion = {
  id: string;
  name: string;
  why: string;
  mayUse: string[];
  verificationTargets: string[];
  tools: string[];
  score: number;
};

const ESTIMATE_PATTERNS: EstimatePatternEntry[] = [
  {
    id: "scale_power_substitution",
    name: "Scale power substitution",
    signals: [
      /\b0\s*<\s*d\s*(?:<=|<|\\leq?|less than or equal to)\s*a\b/i,
      /\bd\s*=\s*a\s*\*?\s*q\b|\bd\s*->\s*a\s*\*?\s*q\b/i,
      /\bd\/a\b|\ba\/d\b/i,
      /\bpower\s+inequal|\bexponent\s+compar|\bscale[-\s]?ordered/i
    ],
    why: "scale-ordered powers often become one-parameter checks after normalizing d by a",
    mayUse: [
      "set d = a*q with a > 0 and 0 < q <= 1 before comparing powers",
      "simplify normalized ratios under q-domain assumptions",
      "for q^p <= 1, check p >= 0 and the equivalent sign condition p*Log[q] <= 0",
      "after that sign check returns True, record q^p <= 1 as justified instead of retrying bare Reduce on q^p",
      "check each ratio and then the finite sum bound"
    ],
    verificationTargets: [
      "normalized power ratio after d = a*q",
      "q-exponent sign via p*Log[q] <= 0",
      "finite sum of normalized ratios"
    ],
    tools: ["verification_template", "wolfram_simplify"]
  },
  {
    id: "negative_part_absorption",
    name: "Negative-part absorption",
    signals: [
      /\bnegative[-\s]?part\b|\bpositive[-\s]?part\b/i,
      /\bE\s*(?:<=|\\leq?)\s*q\s*\*?\s*E\b/i,
      /\b0\s*(?:<=|<)\s*q\s*(?:<|<=|\\leq?)\s*1\b/i,
      /\babsorb(?:ed|s|ing|tion)?\b/i
    ],
    why: "an energy bounded by a strict fraction of itself should be reduced to a direct nonnegative-energy check",
    mayUse: [
      "put E >= 0, E <= q*E, and 0 <= q < 1 in assumptions",
      "simplify or reduce the target E == 0 directly",
      "avoid solving a proposition with variables={}"
    ],
    verificationTargets: [
      "nonnegative energy hypothesis",
      "strict contraction factor",
      "conclusion E == 0"
    ],
    tools: ["wolfram_simplify"],
    minScore: 2
  },
  {
    id: "radial_laplacian_identity",
    name: "Radial Laplacian identity",
    signals: [
      /\bradial\b.*\blaplacian\b|\blaplacian\b.*\bradial\b/i,
      /\bF'\b|\bF''\b|\bD\[/,
      /\br\^\{?\s*n\s*-\s*1\s*\}?|\(n\s*-\s*1\)\s*\/\s*r/i
    ],
    why: "radial identities are usually most stable as one explicit derivative expression",
    mayUse: [
      "write the radial operator as D[F[r], {r, 2}] + (n - 1)/r D[F[r], r]",
      "put dimension and radius restrictions in assumptions",
      "simplify the combined residual instead of expanding prose derivations"
    ],
    verificationTargets: [
      "radial derivative identity",
      "dimension and radius assumptions",
      "combined residual equals zero"
    ],
    tools: ["wolfram_simplify"],
    minScore: 2
  },
  {
    id: "boundary_residual_absorption",
    name: "Boundary residual absorption",
    signals: [
      /\bboundary\b.*\bresidual\b|\bresidual\b.*\bboundary\b/i,
      /\bsmall\s+enough\b|\blarge\s+enough\b|\bsufficiently\s+small\b|\bsufficiently\s+large\b/i,
      /\blimit\b|\blim\b|\basymptotic\b/i
    ],
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
    tools: ["wolfram_simplify", "wolfram_limit"],
    minScore: 2
  },
  {
    id: "flat_pohozaev_profile_algebra",
    name: "Flat Pohozaev profile algebra",
    signals: [
      /\bpohozaev\b/i,
      /A\s*\*?\s*r\^\(?2\s*-\s*n\)?\s*\+\s*B|A\s*r\^\{?2-n\}?\s*\+\s*B/i,
      /D\[\s*r\^|D\[\s*\w+\^\(?\(?n-2\)?\/2\)?/i,
      /flat\s+Pohozaev\s+integrand|Pohozaev\s+integrand/i,
      /v\(1\)|vr\(1\)|radial\s+derivative/i
    ],
    why: "the limit-profile Pohozaev algebra consists of several small identities under the same assumptions",
    mayUse: [
      "combine the derivative, coefficient, and integrand equalities as a Wolfram list in one FullSimplify call",
      "a compact ledger may contain {(D[r^((n-2)/2)*(A*r^(2-n)+B), r] /. r -> 1) == ((n-2)/2)*(B-A), FullSimplify[Implies[A+B==1 && A==B, A==1/2 && B==1/2], Assumptions -> Element[A, Reals] && Element[B, Reals]], ...}",
      "write every derivative substitution as (D[expr, r] /. r -> 1), including repeated derivatives inside list entries",
      "use Implies[...] or Reduce only for the A = B consequence, not for each scalar identity"
    ],
    verificationTargets: [
      "derivative condition reduces to ((n-2)/2)*(B-A)",
      "A+B==1 with A==B gives A==B==1/2",
      "v(1), radial derivative, and flat Pohozaev coefficient"
    ],
    tools: ["wolfram_simplify"],
    minScore: 2
  }
];

export function matchEstimatePatterns(text: string): EstimatePatternSuggestion[] {
  const scored = ESTIMATE_PATTERNS
    .map(pattern => ({
      pattern,
      score: pattern.signals.filter(signal => signal.test(text)).length
    }))
    .filter(item => item.score >= (item.pattern.minScore ?? 1))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 4).map(({ pattern, score }) => ({
    id: pattern.id,
    name: pattern.name,
    why: pattern.why,
    mayUse: pattern.mayUse,
    verificationTargets: pattern.verificationTargets,
    tools: pattern.tools,
    score
  }));
}
