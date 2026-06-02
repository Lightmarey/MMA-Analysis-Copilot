export type TheoremEntry = {
  id: string;
  name: string;
  domains: string[];
  keywords: string[];
  signals?: string[];
  reduces?: string;
  prerequisites?: string[];
  invariantHints?: string[];
  verificationHints?: string[];
  preferredRecipe?: string[];
  avoidPatterns?: string[];
  wolframHint?: string;
  casHint?: string;
  confidence?: "low" | "medium" | "high";
};

export type TheoremSuggestion = {
  theorem: string;
  why: string;
  domains: string[];
  prerequisites: string[];
  invariantHints: string[];
  verificationHints: string[];
  preferredRecipe: string[];
  avoidPatterns: string[];
  wolframHint: string;
  casHint: string;
  confidence: "low" | "medium" | "high";
  score: number;
};

export type ProblemAnalysis = {
  title: "Theorem advisor";
  scale: "trivial" | "moderate" | "heavy" | "infeasible_brute_force" | "unknown";
  scaleDetail: Record<string, string>;
  suggestedTheorems: TheoremSuggestion[];
  suggestedInvariants: string[];
  verificationChecks: string[];
  workflow: {
    phases: ["theorem", "invariants", "verification"];
    theoryFirst: boolean;
  };
  structuralComplexity: {
    isComplex: boolean;
    reasons: string[];
    domainCount: number;
    constraintCount: number;
    length: number;
  };
  softConstraints: TheoremSuggestion[];
  recommendedApproach: string;
  detectedDomains: string[];
  allowBruteforce: boolean;
};

export type Preplan = {
  problemType: string;
  shouldUseTheoryFirst: boolean;
  recommendedTools: string[];
  keyInvariants: string[];
  theoremFocus: string[];
  invariantTargets: string[];
  verificationTargets: string[];
  strategy: string;
};

export type RouteDifficulty = "simple" | "complex";

const THEOREMS: TheoremEntry[] = [
  {
    id: "dominated_convergence",
    name: "Dominated convergence theorem",
    domains: ["analysis", "measure_theory", "integration"],
    keywords: ["dominated convergence", "dct", "pointwise convergence", "dominated", "limit under the integral"],
    signals: ["dominated\\s+by", "exchange\\s+limit\\s+and\\s+integral", "lim.*integral|integral.*lim"],
    reduces: "justify exchanging a limit with an integral once domination and pointwise convergence are checked",
    prerequisites: ["pointwise almost everywhere convergence", "integrable dominating function"],
    invariantHints: ["dominating function", "exceptional null set"],
    verificationHints: ["check domination is independent of the limiting index", "check integrability of the bound"],
    preferredRecipe: ["identify pointwise limit", "prove a uniform integrable bound", "apply DCT", "verify endpoint or singular behavior separately"],
    avoidPatterns: ["do not swap limit and integral before proving domination"],
    wolframHint: "Use wolfram_limit for the pointwise limit and wolfram_integrate to test candidate dominating integrals."
  },
  {
    id: "monotone_convergence",
    name: "Monotone convergence theorem",
    domains: ["analysis", "measure_theory", "integration"],
    keywords: ["monotone convergence", "mct", "increasing sequence", "nonnegative functions"],
    signals: ["f_n\\s*(?:\\u2191|increases|increasing)", "nonnegative.*limit.*integral"],
    reduces: "exchange limit and integral for increasing nonnegative functions",
    prerequisites: ["nonnegative functions", "monotone pointwise convergence"],
    invariantHints: ["monotonicity direction", "pointwise limit"],
    verificationHints: ["verify nonnegativity", "verify monotonicity for all indices"],
    wolframHint: "Use wolfram_simplify with assumptions to verify f[n+1,x] - f[n,x] >= 0 when the expression is explicit."
  },
  {
    id: "fubini_tonelli",
    name: "Fubini and Tonelli theorems",
    domains: ["analysis", "measure_theory", "integration"],
    keywords: ["fubini", "tonelli", "double integral", "iterated integral", "change order of integration"],
    signals: ["double\\s+integral", "iterated\\s+integral", "swap\\s+order"],
    reduces: "justify changing integration order or splitting product measures",
    prerequisites: ["nonnegativity or absolute integrability"],
    invariantHints: ["absolute integral", "integration domain"],
    verificationHints: ["check absolute convergence before Fubini", "use Tonelli only for nonnegative integrands"],
    wolframHint: "Use wolfram_integrate for both integration orders and compare under explicit assumptions."
  },
  {
    id: "uniform_convergence",
    name: "Uniform convergence tests",
    domains: ["analysis", "sequences", "series"],
    keywords: ["uniform convergence", "weierstrass m-test", "uniformly", "power series"],
    signals: ["uniform\\s+conver", "M-test|Weierstrass"],
    reduces: "control convergence independently of the variable",
    prerequisites: ["uniform bound or explicit sup norm estimate"],
    invariantHints: ["supremum norm", "majorant series"],
    verificationHints: ["check convergence of the majorant series", "check interval/domain endpoints"],
    preferredRecipe: ["find a uniform bound", "sum the bound", "handle boundary cases"],
    wolframHint: "Use wolfram_simplify for bounds and wolfram_sum for candidate majorant series."
  },
  {
    id: "arzela_ascoli",
    name: "Arzela-Ascoli theorem",
    domains: ["analysis", "functional_analysis", "compactness"],
    keywords: ["arzela", "ascoli", "equicontinuous", "compact family", "precompact"],
    signals: ["equicontinu", "compact.*family|precompact"],
    reduces: "turn equicontinuity and boundedness into compactness of function families",
    prerequisites: ["uniform boundedness", "equicontinuity", "compact domain"],
    invariantHints: ["uniform bound", "modulus of continuity"],
    verificationHints: ["check compactness of the domain", "check equicontinuity uniformly across the family"]
  },
  {
    id: "hahn_banach",
    name: "Hahn-Banach theorem",
    domains: ["functional_analysis", "normed_spaces"],
    keywords: ["hahn-banach", "extend linear functional", "separate convex sets", "supporting functional"],
    signals: ["extend.*linear\\s+functional", "separat(e|ion).*convex"],
    reduces: "extend bounded linear functionals or separate convex sets",
    prerequisites: ["sublinear domination or norm bound"],
    invariantHints: ["functional norm", "dominating seminorm"],
    verificationHints: ["verify linearity on the subspace", "verify the norm/sublinear bound"]
  },
  {
    id: "open_mapping",
    name: "Open mapping and bounded inverse theorems",
    domains: ["functional_analysis", "banach_spaces"],
    keywords: ["open mapping", "bounded inverse", "banach space", "closed graph"],
    signals: ["bounded\\s+inverse", "open\\s+mapping", "closed\\s+graph"],
    reduces: "deduce continuity or inverse boundedness from Banach-space hypotheses",
    prerequisites: ["complete normed spaces", "surjective bounded linear operator"],
    invariantHints: ["operator norm", "kernel", "range"],
    verificationHints: ["check completeness", "check boundedness and surjectivity"]
  },
  {
    id: "spectral_theorem",
    name: "Spectral theorem",
    domains: ["linear_algebra", "functional_analysis", "operator_theory"],
    keywords: ["spectral theorem", "self-adjoint", "normal operator", "eigen decomposition", "orthogonal diagonalization"],
    signals: ["self[-\\s]?adjoint|normal\\s+operator|orthogonal\\s+diagonal"],
    reduces: "replace a normal or self-adjoint operator by spectral data",
    prerequisites: ["normality or self-adjointness", "finite-dimensional or appropriate Hilbert-space setting"],
    invariantHints: ["spectrum", "eigenvalues", "orthogonal eigenspaces"],
    verificationHints: ["check normality/self-adjointness", "verify multiplicities and invariant subspaces"],
    wolframHint: "Use wolfram_eval with Eigenvalues, Eigensystem, or JordanDecomposition for explicit matrices."
  },
  {
    id: "residue_theorem",
    name: "Residue theorem",
    domains: ["complex_analysis"],
    keywords: ["residue", "contour integral", "pole", "laurent", "complex integral"],
    signals: ["contour\\s+integral|closed\\s+contour", "residue", "poles?"],
    reduces: "turn contour integrals into sums of residues",
    prerequisites: ["singularities inside the contour", "residues at poles"],
    invariantHints: ["pole locations", "residue values", "contour orientation"],
    verificationHints: ["check which poles lie inside the contour", "check arc estimates if an improper real integral is reduced to residues"],
    preferredRecipe: ["locate poles", "compute residues", "sum residues inside contour", "apply orientation factor"],
    wolframHint: "Use wolfram_residue for each pole and wolfram_simplify for the residue sum."
  },
  {
    id: "rouche_theorem",
    name: "Rouche theorem",
    domains: ["complex_analysis"],
    keywords: ["rouche", "number of zeros", "zeros in disk", "argument principle"],
    signals: ["zeros?.*disk", "number\\s+of\\s+zeros", "Rouche"],
    reduces: "count zeros by comparing a function with a dominant part on a boundary",
    prerequisites: ["strict boundary dominance"],
    invariantHints: ["boundary inequality", "dominant summand"],
    verificationHints: ["verify strict inequality on the whole boundary", "count zeros of the simpler comparison function"],
    avoidPatterns: ["do not rely only on sample points on the boundary"]
  },
  {
    id: "montel_theorem",
    name: "Montel theorem",
    domains: ["complex_analysis", "normal_families"],
    keywords: ["montel", "normal family", "locally bounded", "holomorphic family"],
    signals: ["normal\\s+family", "locally\\s+bounded", "Montel"],
    reduces: "obtain subsequential compactness for locally bounded holomorphic families",
    prerequisites: ["holomorphicity", "local boundedness"],
    invariantHints: ["local bound on compact subsets"],
    verificationHints: ["check holomorphicity on the common domain", "check bounds are local and uniform over the family"]
  },
  {
    id: "asymptotic_expansion",
    name: "Asymptotic expansion and dominant balance",
    domains: ["analysis", "asymptotics"],
    keywords: ["asymptotic", "dominant balance", "saddle point", "stationary phase", "laplace method"],
    signals: ["asymptotic", "dominant\\s+balance", "stationary\\s+phase|saddle\\s+point|Laplace\\s+method"],
    reduces: "extract leading terms before attempting exact closed forms",
    prerequisites: ["expansion point or large parameter", "dominant contribution"],
    invariantHints: ["leading exponent", "critical point", "error order"],
    verificationHints: ["check expansion order", "check assumptions on the large/small parameter"],
    wolframHint: "Use wolfram_series for local expansions and wolfram_limit for dominant ratios."
  },
  {
    id: "special_function_identities",
    name: "Special-function identities",
    domains: ["analysis", "special_functions"],
    keywords: ["gamma", "beta function", "bessel", "hypergeometric", "legendre", "fourier transform", "laplace transform"],
    signals: ["Gamma\\[|gamma\\(", "Hypergeometric|Bessel|Legendre", "Laplace\\s+transform|Fourier\\s+transform"],
    reduces: "use known transformations, recurrences, and integral representations",
    prerequisites: ["parameter assumptions", "branch and convergence conditions"],
    invariantHints: ["parameter domain", "branch choices", "normalization convention"],
    verificationHints: ["check conditions returned by Wolfram", "test a generic numeric parameter point when appropriate"],
    wolframHint: "Use wolfram_transform, wolfram_integrate, wolfram_simplify, and wolfram_series with explicit assumptions."
  },
  {
    id: "finite_field_curve_zeta",
    name: "Weil zeta function for curves",
    domains: ["algebraic_geometry", "finite_fields", "number_theory"],
    keywords: ["finite field", "projective curve", "points over", "weil zeta", "frobenius", "hasse-weil"],
    signals: ["F_\\{?\\d+\\^\\{?\\d+\\}?\\}?", "GF\\(\\s*\\d+\\s*\\^\\s*\\d+\\s*\\)", "points?.*finite\\s+field"],
    reduces: "avoid brute-force point enumeration over large extension fields",
    prerequisites: ["field characteristic", "extension degree", "genus or Frobenius data"],
    invariantHints: ["field characteristic", "extension degree", "genus", "Frobenius characteristic polynomial"],
    verificationHints: ["Hasse-Weil bound", "small extension consistency"],
    preferredRecipe: ["identify base field", "compute zeta/Frobenius data over a small field", "lift to extension degree", "verify Hasse-Weil bound"],
    avoidPatterns: ["do not enumerate every point over a huge extension field"],
    confidence: "high"
  }
];

const CONSTRAINT_RE = /\b(such that|given that|subject to|let|define|denote|suppose|assume|where)\b|\u6ee1\u8db3|\u4f7f\u5f97|\u6761\u4ef6/gim;
const MULTISTEP_RE = /\b(then|subsequently|furthermore|compute|find|determine)\b|\u8fdb\u4e00\u6b65|\u7136\u540e|\u518d[\u6c42\u7b97\u8ba1]/gim;
const POLY_DEGREE_RE = /[a-zA-Z]\s*\^\s*\{?(\d+)\}?/g;
const LARGE_POWER_RE = /(\d+)\s*\^\s*(\d+)/g;
const SENTENCE_SPLIT_RE = /[.;\n\u3002\uff1b]+/g;

const COMPLEX_ROUTING_PATTERNS = [
  /galois|groebner|mordell[-\s]?weil/i,
  /elliptic\s*curve|finite\s*field|number\s*field|GF\(/i,
  /proof|prove|show\s+that|\u8bc1\u660e|\u6c42\u8bc1/i,
  /class\s*number|sylow|character\s+table|\u7279\u5f81\u6807/i,
  /harmonic\s+weak\s+maass|maass\s+form|hecke|cm\s+point/i,
  /normal\s+family|hahn[-\s]?banach|open\s+mapping|spectral\s+theorem/i,
  /contour\s+integral|rouche|residue\s+theorem/i
];

export function analyzeProblem(problem: string, detectedObjects = ""): ProblemAnalysis {
  const combined = `${problem} ${detectedObjects}`.trim();
  const scaleInfo = estimateScale(combined);
  const matched = matchTheorems(combined);
  const detectedDomains = [...new Set(matched.flatMap(item => item.domains))].sort();
  const suggestedInvariants = suggestInvariants(scaleInfo, matched);
  const verificationChecks = uniqueFlatMap(matched, item => item.verificationHints);
  const scale = scaleInfo.scale;
  const theoryFirst = scale === "heavy" || scale === "infeasible_brute_force";
  const structuralComplexity = assessStructuralComplexity(combined, detectedDomains.length, matched);
  const shouldUseTheoryFirst = theoryFirst || structuralComplexity.reasons.includes("constructive modular-form research task");
  const allowBruteforce = (scale === "trivial" || scale === "moderate") && !shouldUseTheoryFirst;
  const softConstraints = matched.filter(item => item.preferredRecipe.length > 0 || item.avoidPatterns.length > 0 || item.wolframHint);
  const recommendedApproach = buildRecommendedApproach(scale, matched, suggestedInvariants, verificationChecks, shouldUseTheoryFirst);

  return {
    title: "Theorem advisor",
    scale,
    scaleDetail: Object.fromEntries(
      Object.entries(scaleInfo)
        .filter(([key]) => key !== "scale")
        .map(([key, value]) => [key, String(value)])
    ),
    suggestedTheorems: matched,
    suggestedInvariants,
    verificationChecks,
    workflow: {
      phases: ["theorem", "invariants", "verification"],
      theoryFirst: shouldUseTheoryFirst
    },
    structuralComplexity,
    softConstraints,
    recommendedApproach,
    detectedDomains,
    allowBruteforce
  };
}

export function createPreplan(problem: string, analysis = analyzeProblem(problem)): Preplan {
  const theoremFocus = analysis.suggestedTheorems.map(item => item.theorem);
  const recommendedTools = inferRecommendedTools(problem, analysis);
  const shouldUseTheoryFirst = analysis.workflow.theoryFirst || analysis.scale === "heavy" || analysis.scale === "infeasible_brute_force";

  return {
    problemType: inferProblemType(problem, analysis),
    shouldUseTheoryFirst,
    recommendedTools,
    keyInvariants: analysis.suggestedInvariants,
    theoremFocus,
    invariantTargets: analysis.suggestedInvariants,
    verificationTargets: analysis.verificationChecks,
    strategy: analysis.recommendedApproach || defaultStrategy(analysis)
  };
}

export function classifyDifficulty(problem: string, analysis = analyzeProblem(problem)): RouteDifficulty {
  if (analysis.structuralComplexity.isComplex) return "complex";
  if (analysis.scale === "heavy" || analysis.scale === "infeasible_brute_force") return "complex";
  if (analysis.workflow.theoryFirst) return "complex";
  if (COMPLEX_ROUTING_PATTERNS.some(pattern => pattern.test(problem))) return "complex";
  const matchedTheorems = analysis.suggestedTheorems.length;
  if (matchedTheorems >= 2 && analysis.detectedDomains.length >= 2) return "complex";
  return "simple";
}

export function buildPreplanContext(analysis: ProblemAnalysis, plan: Preplan): string {
  const theoremNames = analysis.suggestedTheorems.map(item => item.theorem);
  const highConfidence = analysis.softConstraints
    .filter(item => item.confidence === "high" || item.score >= 4)
    .sort((a, b) => b.score - a.score)[0];
  const constraint = plan.shouldUseTheoryFirst
    ? "Do not brute force. Follow theorem -> invariants -> verification before concluding."
    : "Direct computation is allowed, but prefer structured tools and verify assumptions.";
  const lines: string[] = [];

  if (highConfidence) {
    lines.push(`High-confidence theorem guidance (${highConfidence.theorem}, score=${highConfidence.score.toFixed(1)}):`);
    if (highConfidence.preferredRecipe.length) lines.push(`- preferred_recipe: ${highConfidence.preferredRecipe.join(" -> ")}`);
    if (highConfidence.avoidPatterns.length) lines.push(`- avoid_patterns: ${highConfidence.avoidPatterns.join(" | ")}`);
    if (highConfidence.wolframHint) lines.push(`- wolfram_hint: ${highConfidence.wolframHint}`);
    if (highConfidence.casHint) lines.push(`- cas_hint: ${highConfidence.casHint}`);
    lines.push("");
  }

  lines.push("Preplanning context:");
  lines.push(`- scale: ${analysis.scale}`);
  lines.push(`- problem_type: ${plan.problemType}`);
  lines.push(`- detected_domains: ${formatList(analysis.detectedDomains)}`);
  lines.push(`- suggested_theorems: ${formatList(theoremNames)}`);
  lines.push(`- theorem_focus: ${formatList(plan.theoremFocus)}`);
  lines.push(`- recommended_tools: ${formatList(plan.recommendedTools)}`);
  lines.push(`- key_invariants: ${formatList(plan.keyInvariants)}`);
  lines.push(`- invariant_targets: ${formatList(plan.invariantTargets)}`);
  lines.push(`- verification_targets: ${formatList(plan.verificationTargets)}`);
  lines.push("- workflow_order: theorem -> invariants -> verification");
  lines.push(`- strategy: ${plan.strategy || analysis.recommendedApproach || "Use exact Wolfram-backed computation with explicit verification."}`);
  lines.push(`- constraint: ${constraint}`);
  lines.push("- execution_rule: do not present a final answer until the relevant verification targets have been checked or explicitly marked as assumptions.");
  return lines.join("\n");
}

export function theoremAdvisorTool(args: Record<string, unknown>) {
  const problem = typeof args.problem === "string" ? args.problem : "";
  const detectedObjects = typeof args.detected_objects === "string"
    ? args.detected_objects
    : typeof args.detectedObjects === "string"
      ? args.detectedObjects
      : "";
  const analysis = analyzeProblem(problem, detectedObjects);
  return {
    id: null,
    ok: true,
    title: "Theorem advisor",
    output: JSON.stringify(analysis, null, 2),
    elapsedMs: 0
  };
}

function estimateScale(text: string): Record<string, string | number> & { scale: ProblemAnalysis["scale"] } {
  const finiteField = extractFiniteField(text);
  if (finiteField) {
    const [p, n] = finiteField;
    const q = p ** n;
    if (q > 1e9) {
      return {
        finite_field: `F_{${p}^{${n}}}`,
        field_characteristic: p,
        field_extension_degree: n,
        field_size: q,
        field_size_sci: q.toExponential(2),
        reason: `field size ${q.toExponential(2)} makes point enumeration infeasible`,
        scale: "infeasible_brute_force"
      };
    }
    if (q > 1e6) {
      return {
        finite_field: `F_{${p}^{${n}}}`,
        field_characteristic: p,
        field_extension_degree: n,
        field_size: q,
        field_size_sci: q.toExponential(2),
        reason: `field size ${q.toExponential(2)} is expensive for direct enumeration`,
        scale: "heavy"
      };
    }
    if (q > 1e3) {
      return {
        finite_field: `F_{${p}^{${n}}}`,
        field_characteristic: p,
        field_extension_degree: n,
        field_size: q,
        scale: "moderate"
      };
    }
    return {
      finite_field: `F_{${p}^{${n}}}`,
      field_characteristic: p,
      field_extension_degree: n,
      field_size: q,
      scale: "trivial"
    };
  }

  const degrees = [...text.matchAll(POLY_DEGREE_RE)].map(match => Number.parseInt(match[1], 10));
  if (degrees.length) {
    const maxDegree = Math.max(...degrees);
    if (maxDegree > 20) {
      return {
        max_polynomial_degree: maxDegree,
        reason: `polynomial degree ${maxDegree} may make symbolic computation expensive`,
        scale: "heavy"
      };
    }
  }
  return { scale: "moderate" };
}

function extractFiniteField(text: string): [number, number] | null {
  const patterns = [
    /(?:GF|F)\s*\(\s*(\d+)\s*\^\s*(\d+)\s*\)/i,
    /\\mathbb\{F\}_\{?(\d+)\^\{?(\d+)\}?\}?/i,
    /F_\{?(\d+)\^\{?(\d+)\}?\}?/i,
    /(?:GF|F)\s*\(\s*(\d+)\s*\)/i,
    /F_(\d+)/i
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const p = Number.parseInt(match[1], 10);
    const n = match[2] ? Number.parseInt(match[2], 10) : 1;
    if (Number.isFinite(p) && Number.isFinite(n)) return [p, n];
  }

  for (const match of text.matchAll(LARGE_POWER_RE)) {
    const base = Number.parseInt(match[1], 10);
    const exponent = Number.parseInt(match[2], 10);
    if (base >= 2 && base <= 100 && exponent >= 2) {
      return [base, exponent];
    }
  }
  return null;
}

function matchTheorems(text: string): TheoremSuggestion[] {
  const lowered = text.toLowerCase();
  const scored: Array<{ score: number; theorem: TheoremEntry }> = [];

  for (const theorem of THEOREMS) {
    let score = 0;
    for (const keyword of theorem.keywords) {
      if (lowered.includes(keyword.toLowerCase())) score += 1;
    }
    for (const signal of theorem.signals ?? []) {
      try {
        if (new RegExp(signal, "i").test(text)) score += 2;
      } catch {
        // Ignore invalid theorem-library patterns.
      }
    }
    if (score > 0) scored.push({ score, theorem });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map(({ score, theorem }) => ({
    theorem: theorem.name,
    why: theorem.reduces ?? "",
    domains: theorem.domains,
    prerequisites: theorem.prerequisites ?? [],
    invariantHints: theorem.invariantHints ?? [],
    verificationHints: theorem.verificationHints ?? [],
    preferredRecipe: theorem.preferredRecipe ?? [],
    avoidPatterns: theorem.avoidPatterns ?? [],
    wolframHint: theorem.wolframHint ?? "",
    casHint: theorem.casHint ?? theorem.wolframHint ?? "",
    confidence: normalizeConfidence(theorem.confidence, score),
    score
  }));
}

function normalizeConfidence(prior: TheoremEntry["confidence"], score: number): TheoremSuggestion["confidence"] {
  if (prior) return prior;
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function suggestInvariants(scaleInfo: Record<string, string | number>, matched: TheoremSuggestion[]): string[] {
  const invariants: string[] = [];
  if (scaleInfo.field_characteristic) invariants.push(`field characteristic p = ${scaleInfo.field_characteristic}`);
  if (scaleInfo.field_extension_degree) invariants.push(`extension degree n = ${scaleInfo.field_extension_degree}`);
  if (scaleInfo.field_size) invariants.push(`field size q = ${scaleInfo.field_size}`);
  if (scaleInfo.max_polynomial_degree) invariants.push(`max polynomial degree = ${scaleInfo.max_polynomial_degree}`);
  appendUnique(invariants, uniqueFlatMap(matched, item => [...item.invariantHints, ...item.prerequisites]));
  return invariants;
}

function assessStructuralComplexity(text: string, domainCount: number, matched: TheoremSuggestion[]) {
  const reasons: string[] = [];
  const length = text.length;
  const sentenceCount = text.split(SENTENCE_SPLIT_RE).filter(part => part.trim()).length;
  const constraintCount = countMatches(text, CONSTRAINT_RE);
  const multistepCount = countMatches(text, MULTISTEP_RE);

  if (length > 500 || sentenceCount > 6) reasons.push(`long problem (length=${length}, sentences=${sentenceCount})`);
  if (domainCount >= 3) reasons.push(`multi-domain (${domainCount} domains)`);
  if (constraintCount >= 3) reasons.push(`many constraints (${constraintCount})`);
  if (multistepCount >= 2) reasons.push(`multi-step (${multistepCount} steps)`);
  if (requiresTheoryFirstConstruction(text, matched)) reasons.push("constructive modular-form research task");

  return {
    isComplex: reasons.length >= 2,
    reasons,
    domainCount,
    constraintCount,
    length
  };
}

function requiresTheoryFirstConstruction(text: string, matched: TheoremSuggestion[]): boolean {
  const patterns = [/construct/i, /maass/i, /hecke/i, /cm\s+point/i, /catalan/i, /holomorphic/i];
  const signalCount = patterns.filter(pattern => pattern.test(text)).length;
  const hasModular = matched.some(item => item.domains.includes("modular_forms"));
  return signalCount >= 3 || (signalCount >= 2 && hasModular);
}

function buildRecommendedApproach(
  scale: ProblemAnalysis["scale"],
  matched: TheoremSuggestion[],
  invariants: string[],
  checks: string[],
  theoryFirst: boolean
): string {
  const parts: string[] = [];
  if (theoryFirst) {
    parts.push(scale === "heavy" || scale === "infeasible_brute_force"
      ? "Direct brute-force computation is not appropriate; reduce the problem using theory first"
      : "Use a theory-first route before computation");
  } else if (scale === "moderate") {
    parts.push("Direct computation is possible, but check for structural simplification first");
  } else {
    parts.push("A direct structured Wolfram computation is likely sufficient");
  }
  const top = matched[0];
  if (top) {
    parts.push(`anchor on ${top.theorem}${top.why ? `: ${top.why}` : ""}`);
  }
  if (invariants.length) parts.push(`compute invariants: ${invariants.slice(0, 5).join(", ")}`);
  if (checks.length) parts.push(`verify: ${checks.slice(0, 4).join(", ")}`);
  return parts.join(" -> ");
}

function inferRecommendedTools(problem: string, analysis: ProblemAnalysis): string[] {
  const lowered = problem.toLowerCase();
  const tools: string[] = [];
  if (analysis.workflow.theoryFirst || analysis.suggestedTheorems.length) tools.push("theorem_advisor");
  if (/integral|integrate|\u79ef\u5206|\u222b/.test(lowered)) tools.push("wolfram_integrate");
  if (/limit|lim\b|\u6781\u9650/.test(lowered)) tools.push("wolfram_limit");
  if (/series|taylor|laurent|asymptotic|\u5c55\u5f00|\u7ea7\u6570/.test(lowered)) tools.push("wolfram_series");
  if (/sum|summation|sigma|\u6c42\u548c|\u03a3/.test(lowered)) tools.push("wolfram_sum");
  if (/ode|differential equation|dsolve|\u5fae\u5206\u65b9\u7a0b/.test(lowered)) tools.push("wolfram_dsolve");
  if (/laplace|fourier|mellin|z[-\s]?transform|\u53d8\u6362/.test(lowered)) tools.push("wolfram_transform");
  if (/residue|contour|pole|\u7559\u6570|\u56f4\u9053/.test(lowered)) tools.push("wolfram_residue");
  if (/solve|equation|\u65b9\u7a0b|\u4e0d\u7b49\u5f0f/.test(lowered)) tools.push("wolfram_solve");
  if (/simplify|prove identity|identity|\u5316\u7b80|\u6052\u7b49/.test(lowered)) tools.push("wolfram_simplify");
  if (!tools.length) tools.push("wolfram_simplify", "wolfram_eval");
  return [...new Set(tools)];
}

function inferProblemType(problem: string, analysis: ProblemAnalysis): string {
  if (analysis.detectedDomains.length) return analysis.detectedDomains[0];
  const lowered = problem.toLowerCase();
  if (/integral|limit|series|sum|\u79ef\u5206|\u6781\u9650|\u7ea7\u6570|\u6c42\u548c/.test(lowered)) return "analysis";
  if (/matrix|eigen|linear/.test(lowered)) return "linear_algebra";
  if (/probability|expectation|variance|\u6982\u7387/.test(lowered)) return "probability";
  return "general";
}

function defaultStrategy(analysis: ProblemAnalysis): string {
  if (analysis.workflow.theoryFirst) return "Use theorem-first reasoning, compute invariants, then verify final conditions.";
  return "Use structured Wolfram tools, keep assumptions explicit, and verify the final expression.";
}

function uniqueFlatMap<T>(items: T[], selector: (item: T) => string[]): string[] {
  const values: string[] = [];
  for (const item of items) appendUnique(values, selector(item));
  return values;
}

function appendUnique(target: string[], values: string[]): void {
  const seen = new Set(target);
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned || seen.has(cleaned)) continue;
    target.push(cleaned);
    seen.add(cleaned);
  }
}

function countMatches(text: string, regex: RegExp): number {
  regex.lastIndex = 0;
  let count = 0;
  while (regex.exec(text)) count += 1;
  regex.lastIndex = 0;
  return count;
}

function formatList(values: string[]): string {
  return values.length ? values.join(", ") : "none";
}
