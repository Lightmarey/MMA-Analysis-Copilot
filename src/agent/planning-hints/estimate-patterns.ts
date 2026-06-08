export type EstimatePatternEntry = {
  id: string;
  name: string;
  signals: RegExp[];
  why: string;
  mayUse: string[];
  verificationTargets: string[];
  tools: string[];
  minScore?: number;
  firstToolHint?: string;
};

export type EstimatePatternSuggestion = {
  id: string;
  name: string;
  why: string;
  mayUse: string[];
  verificationTargets: string[];
  tools: string[];
  score: number;
  firstToolHint: string;
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
  },
  {
    id: "transition_rescaling_powers",
    name: "Transition rescaling powers",
    signals: [
      /\btransition\s+barrier\b|\bdyadic\s+scale\b|\brescal(?:e|ing)\b/i,
      /\brho\^\(?(?:n\/2|n\s*\/\s*2)/i,
      /\btau[_a-zA-Z]*\s*->\s*rho\*|\btau[_a-zA-Z]*\s*=\s*rho/i,
      /\bs[_a-zA-Z]*\s*->\s*rho\*|\bs[_a-zA-Z]*\s*=\s*rho/i,
      /\brho\s*(?:<=|\\leq?)\s*2\s*c0\s*a/i
    ],
    why: "transition-barrier rescaling needs simultaneous tau and s substitutions, and Wolfram variable names cannot use underscores",
    mayUse: [
      "rename symbols with underscores to camelCase before calling Wolfram, e.g. tau_y -> tauy and tau_hat -> tauhat",
      "combine rescaled source and boundary terms in one Wolfram list after substituting tauy -> rho*tauhat and sy -> rho*shat",
      "check rho-control as the full inequality list, not by proving a stricter rho < 2*c0 side goal",
      "put the hypotheses in the assumptions field and use expr={rho*tauhat*shat^(-n/2-1) <= 2*c0*tauhat*shat^(-n/2-1), rho*tauhat*shat^(-n/2) <= 2*c0*tauhat*shat^(-n/2)} rather than Implies[..., {...}]",
      "use assumptions 0 < rho <= 2*c0*a, 0 < a < 1, c0 > 0, tauhat >= 0, and shat > 0"
    ],
    verificationTargets: [
      "rho power cancellation after tau and s are both rescaled",
      "remaining rho factor bounded by 2*c0",
      "analytic Lipschitz or elliptic estimates kept separate"
    ],
    tools: ["wolfram_simplify"],
    minScore: 2
  },
  {
    id: "appendix_lower_bound_scaling",
    name: "Appendix lower-bound scaling",
    signals: [
      /\blower\s+bound\b|\bv\s*>=\s*Lambda\/M|\bLambda\s*M\^-?1/i,
      /\bu\s*>=\s*Lambda|\bv\s*=\s*M\^-?1\s*\*?\s*u/i,
      /\bM\^\(?-2\/\(n-2\)\)?|\bM\^\(-2\/\(n-2\)\)/i,
      /\bdelta\/2\b|\bphysical\s+(?:point\s+)?distance\b|\bouter\s+radius\b/i,
      /\bcn\s*-\s*CR\s*\*?\s*CP\s*\*?\s*r\^2|\bcoerciv/i
    ],
    why: "appendix lower-bound checks are a short ledger: lower-bound scaling, radius scaling, and a coercivity radius threshold",
    firstToolHint: "Run wolfram_simplify first with expr={u/M >= Lambda/M, M^(-2/(n-2))*Y <= delta/2 /. Y -> (delta/2)*M^(2/(n-2)), Reduce[cn - CR*CP*r^2 >= cn/2 && cn > 0 && CR > 0 && CP > 0 && r > 0, r, Reals] == (0 < r <= Sqrt[cn/(2*CR*CP)])}.",
    mayUse: [
      "use one wolfram_simplify list for the explicit algebraic ledger",
      "check u/M >= Lambda/M under u >= Lambda and M > 0 directly in assumptions",
      "check radius scaling by substituting Y -> (delta/2)*M^(2/(n-2)) in M^(-2/(n-2))*Y <= delta/2",
      "for cn - CR*CP*r^2 >= cn/2, compare Reduce[...] with 0 < r <= Sqrt[cn/(2*CR*CP)] instead of repeatedly simplifying the raw inequality",
      "a stable ledger is {u/M >= Lambda/M, M^(-2/(n-2))*Y <= delta/2 /. Y -> (delta/2)*M^(2/(n-2)), Reduce[cn - CR*CP*r^2 >= cn/2 && cn > 0 && CR > 0 && CP > 0 && r > 0, r, Reals] == (0 < r <= Sqrt[cn/(2*CR*CP)])}",
      "do not put the raw radius inequality or raw coercivity inequality into the first ledger when the goal is the endpoint threshold",
      "leave isolated singularity positivity, Lax-Milgram, Harnack, maximum principle, and Hopf lemma as analytic assumptions"
    ],
    verificationTargets: [
      "lower bound propagation through v = M^-1 u",
      "outer radius scaling cancellation",
      "coercivity threshold r <= Sqrt[cn/(2*CR*CP)]"
    ],
    tools: ["wolfram_simplify"],
    minScore: 2
  },
  {
    id: "kelvin_base_comparison",
    name: "Kelvin base comparison",
    signals: [
      /\bKelvin\b|\bbaseV\b|\bbaseK\b/i,
      /\blambda\^4\s*\+\s*a\^2\s*\*?\s*r2/i,
      /\ba\^2\s*\/\s*\(r2\s*\+\s*2\s*\*?\s*a\s*\*?\s*yn\s*\+\s*a\^2\)/i,
      /\ba\^2\s*\*?\s*lambda\^2\s*\/\s*\(lambda\^4/i,
      /\br2\s*>\s*lambda\^2/i
    ],
    why: "Kelvin base comparisons reduce to one denominator factorization and a sign ledger; direct Reduce on baseV > baseK branches over irrelevant sign cases",
    firstToolHint: "Run wolfram_simplify first with expr={(lambda^4+a^2*r2+2*a*lambda^2*yn)-lambda^2*(r2+2*a*yn+a^2)==(a^2-lambda^2)*(r2-lambda^2), ((a^2/(r2+2*a*yn+a^2))/(a^2*lambda^2/(lambda^4+a^2*r2+2*a*lambda^2*yn))-1)==((a^2-lambda^2)*(r2-lambda^2))/(lambda^2*(a^2+r2+2*a*yn)), lambda^2*(a^2+r2+2*a*yn)>0, r2-lambda^2>0, lambda<a \\[Implies] a^2-lambda^2>0, lambda==a \\[Implies] a^2-lambda^2==0, lambda>a \\[Implies] a^2-lambda^2<0}. For the sign cases, keep the implication statements in expr; do not replace them with the bare mutually exclusive conclusions under the shared assumptions.",
    mayUse: [
      "verify the denominator difference factorization before comparing bases",
      "verify baseV/baseK - 1 equals the factored numerator over the positive denominator",
      "check denominator positivity and r2-lambda^2 positivity separately",
      "verify the three sign cases as lambda<a, lambda==a, and lambda>a implications before summarizing",
      "do not put mutually exclusive positive/zero/negative case conclusions into one shared-assumption list",
      "do not call Reduce on baseV > baseK directly unless the ledger leaves an unresolved condition"
    ],
    verificationTargets: [
      "Kelvin denominator factorization",
      "baseV/baseK minus one sign numerator",
      "lambda < a, lambda == a, lambda > a sign cases"
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
    score,
    firstToolHint: pattern.firstToolHint ?? ""
  }));
}
