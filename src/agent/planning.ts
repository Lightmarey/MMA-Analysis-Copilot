import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { hasInequalityToolHint, inferRecommendedTools } from "./tool-hints.js";

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

export type Subproblem = {
  id: string;
  statement: string;
  dependsOn: string[];
  domain: string;
};

export type ProblemDecomposition = {
  objects: string[];
  subproblems: Subproblem[];
  finalTarget: string;
  dependencyOrder: string[];
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const builtinTheoremDir = path.resolve(projectRoot, "theorems");
const ANALYSIS_DOMAINS = new Set([
  "analysis",
  "real_analysis",
  "measure_theory",
  "integration",
  "sequences",
  "series",
  "functional_analysis",
  "normed_spaces",
  "banach_spaces",
  "compactness",
  "operator_theory",
  "complex_analysis",
  "normal_families",
  "asymptotics",
  "special_functions",
  "differential_equations",
  "ode",
  "partial_differential_equations",
  "pde",
  "elliptic_pde",
  "inequalities",
  "sobolev_spaces",
  "weak_solutions",
  "transforms"
]);

const FALLBACK_THEOREMS: TheoremEntry[] = [
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
    keywords: ["uniform convergence", "uniformly convergent", "weierstrass m-test", "power series"],
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
];

const CONSTRAINT_RE = /\b(such that|given that|subject to|let|define|denote|suppose|assume|where)\b|\u6ee1\u8db3|\u4f7f\u5f97|\u6761\u4ef6/gim;
const MULTISTEP_RE = /\b(then|subsequently|furthermore|compute|find|determine)\b|\u8fdb\u4e00\u6b65|\u7136\u540e|\u518d[\u6c42\u7b97\u8ba1]/gim;
const POLY_DEGREE_RE = /[a-zA-Z]\s*\^\s*\{?(\d+)\}?/g;
const SENTENCE_SPLIT_RE = /[.;\n\u3002\uff1b]+/g;

const COMPLEX_ROUTING_PATTERNS = [
  /proof|prove|show\s+that|\u8bc1\u660e|\u6c42\u8bc1/i,
  /normal\s+family|hahn[-\s]?banach|open\s+mapping|spectral\s+theorem/i,
  /contour\s+integral|rouche|residue\s+theorem/i,
  /variational|functional|minimi[sz]|mountain\s+pass|nehari|pohozaev|barrier|moving\s+spheres|kelvin|sub[-\s]?solution|super[-\s]?solution|hessian\s+quotient|manifold|representation/i,
  /\u53d8\u5206|\u6cdb\u51fd|\u6781\u5c0f|\u95f8\u51fd\u6570|\u4e0a\u4e0b\u89e3|\u79fb\u52a8\u7403|\u7403\u9762\u6cd5|\u8868\u793a\u8bba|\u6d41\u5f62|\u5927hessian/i
];

export function analyzeProblem(problem: string, detectedObjects = ""): ProblemAnalysis {
  const combined = `${problem} ${detectedObjects}`.trim();
  const scaleInfo = estimateScale(combined);
  const matched = matchTheorems(combined);
  const detectedDomains = [...new Set(matched.flatMap(item => item.domains))].sort();
  const suggestedInvariants = suggestInvariants(scaleInfo, matched);
  const verificationChecks = uniqueFlatMap(matched, item => item.verificationHints);
  const scale = scaleInfo.scale;
  const theoryFirst = scale === "heavy" || scale === "infeasible_brute_force" || shouldPrioritizeAnalysisTheory(combined, matched);
  const structuralComplexity = assessStructuralComplexity(combined, detectedDomains.length, matched);
  const shouldUseTheoryFirst = theoryFirst || structuralComplexity.reasons.includes("analysis theorem-first task");
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
  const recommendedTools = inferRecommendedTools(problem, analysis.suggestedTheorems, analysis.workflow.theoryFirst);
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
  if (hasInequalityToolHint(problem)) return "complex";
  const matchedTheorems = analysis.suggestedTheorems.length;
  if (matchedTheorems >= 2 && analysis.detectedDomains.length >= 2) return "complex";
  return "simple";
}

export function decomposeProblem(problem: string, analysis = analyzeProblem(problem)): ProblemDecomposition | null {
  if (!analysis.structuralComplexity.isComplex && problem.length < 500) return null;
  const statements = problem
    .split(SENTENCE_SPLIT_RE)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 8);
  const objects = extractObjects(problem, analysis);
  const subproblems = statements.map((statement, index) => ({
    id: `sp${index + 1}`,
    statement,
    dependsOn: index === 0 ? [] : [`sp${index}`],
    domain: inferStatementDomain(statement, analysis)
  }));
  if (!subproblems.length && objects.length) {
    subproblems.push({
      id: "sp1",
      statement: `Identify and normalize the mathematical objects: ${objects.join(", ")}`,
      dependsOn: [],
      domain: analysis.detectedDomains[0] ?? "general"
    });
  }
  if (!subproblems.length) return null;
  return {
    objects,
    subproblems,
    finalTarget: inferFinalTarget(problem, subproblems),
    dependencyOrder: subproblems.map(item => item.id)
  };
}

export function buildPreplanContext(analysis: ProblemAnalysis, plan: Preplan, decomposition?: ProblemDecomposition | null): string {
  const theoremNames = analysis.suggestedTheorems.map(item => item.theorem);
  const highConfidence = analysis.softConstraints
    .filter(item => item.confidence === "high" || item.score >= 4)
    .sort((a, b) => b.score - a.score)[0];
  const constraint = plan.shouldUseTheoryFirst
    ? "Theory-first structure is likely useful; reduce to explicit verification targets before concluding."
    : "Direct computation may be enough; use structured tools when they clarify explicit checks.";
  const lines: string[] = [];

  if (highConfidence) {
    lines.push(`High-confidence theorem guidance (${highConfidence.theorem}, score=${highConfidence.score.toFixed(1)}):`);
    if (highConfidence.preferredRecipe.length) lines.push(`- preferred_recipe: ${highConfidence.preferredRecipe.join(" -> ")}`);
    if (highConfidence.avoidPatterns.length) lines.push(`- avoid_patterns: ${highConfidence.avoidPatterns.join(" | ")}`);
    if (highConfidence.wolframHint) lines.push(`- wolfram_hint: ${highConfidence.wolframHint}`);
    if (highConfidence.casHint) lines.push(`- cas_hint: ${highConfidence.casHint}`);
    lines.push("");
  }

  if (decomposition?.subproblems.length) {
    lines.push("Problem decomposition:");
    for (const subproblem of decomposition.subproblems) {
      const deps = subproblem.dependsOn.length ? subproblem.dependsOn.join(", ") : "none";
      lines.push(`- [${subproblem.id}] ${subproblem.statement} (depends: ${deps}; domain: ${subproblem.domain})`);
    }
    lines.push(`- final_target: ${decomposition.finalTarget}`);
    lines.push(`- dependency_order: ${decomposition.dependencyOrder.join(" -> ")}`);
    if (decomposition.objects.length) lines.push(`- objects: ${decomposition.objects.join(", ")}`);
    lines.push("- decomposition_note: subproblems are ordered hints; preserve dependency order when it is relevant.");
    lines.push("");
  }

  lines.push("Preplanning context:");
  lines.push(`- scale: ${analysis.scale}`);
  lines.push(`- problem_type: ${plan.problemType}`);
  lines.push(`- detected_domains: ${formatList(analysis.detectedDomains)}`);
  lines.push(`- suggested_theorems: ${formatList(theoremNames)}`);
  lines.push(`- theorem_focus: ${formatList(plan.theoremFocus)}`);
  lines.push(`- local_tool_hints: ${formatList(plan.recommendedTools)}`);
  lines.push(`- key_invariants: ${formatList(plan.keyInvariants)}`);
  lines.push(`- invariant_targets: ${formatList(plan.invariantTargets)}`);
  lines.push(`- verification_targets: ${formatList(plan.verificationTargets)}`);
  lines.push("- workflow_hint: theorem -> invariants -> verification when the problem is theorem-first");
  lines.push(`- strategy: ${plan.strategy || analysis.recommendedApproach || "Use exact Wolfram-backed computation with explicit verification."}`);
  lines.push(`- local_guidance: ${constraint}`);
  lines.push("- verification_note: check listed targets when they are relevant, or state why they remain analytic assumptions.");
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

function matchTheorems(text: string): TheoremSuggestion[] {
  const lowered = text.toLowerCase();
  const scored: Array<{ score: number; theorem: TheoremEntry }> = [];

  for (const theorem of loadTheorems()) {
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
    casHint: theorem.casHint || theorem.wolframHint || "",
    confidence: normalizeConfidence(theorem.confidence, score),
    score
  }));
}

export function loadTheorems(): TheoremEntry[] {
  const sourceMode = (process.env.WOLFRAM_THEOREM_SOURCE || process.env.AI4MATH_THEOREM_SOURCE || config.theoremSource || "merge").trim().toLowerCase();
  const externalPath = (process.env.WOLFRAM_THEOREM_EXTERNAL_PATH || process.env.AI4MATH_THEOREM_EXTERNAL_PATH || config.theoremExternalPath || "").trim();
  const loaded: TheoremEntry[] = [];

  if (sourceMode !== "external") {
    loaded.push(...FALLBACK_THEOREMS);
    loaded.push(...loadTheoremDirectory(builtinTheoremDir));
  }
  if (sourceMode !== "builtin" && externalPath) {
    loaded.push(...loadTheoremPayload(readTextIfExists(externalPath)));
  }
  if (!loaded.length) {
    loaded.push(...FALLBACK_THEOREMS);
  }
  return dedupeTheorems(loaded).filter(isAnalysisTheorem);
}

function loadTheoremDirectory(directory: string): TheoremEntry[] {
  try {
    return fs.readdirSync(directory)
      .filter(fileName => fileName.endsWith(".json"))
      .flatMap(fileName => loadTheoremPayload(readTextIfExists(path.join(directory, fileName))));
  } catch {
    return [];
  }
}

function readTextIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function loadTheoremPayload(payload: string): TheoremEntry[] {
  if (!payload.trim()) return [];
  try {
    const parsed = JSON.parse(payload) as unknown;
    const entries = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { theorems?: unknown }).theorems)
        ? (parsed as { theorems: unknown[] }).theorems
        : [];
    return entries.map(normalizeTheoremEntry).filter((entry): entry is TheoremEntry => entry !== null);
  } catch {
    return [];
  }
}

function normalizeTheoremEntry(raw: unknown): TheoremEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = readString(record.id);
  const name = readString(record.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    domains: readStringArray(record.domains),
    keywords: readStringArray(record.keywords),
    signals: readStringArray(record.signals),
    reduces: readString(record.reduces),
    prerequisites: readStringArray(record.prerequisites),
    invariantHints: readStringArray(record.invariantHints ?? record.invariant_hints),
    verificationHints: readStringArray(record.verificationHints ?? record.verification_hints),
    preferredRecipe: readStringArray(record.preferredRecipe ?? record.preferred_recipe),
    avoidPatterns: readStringArray(record.avoidPatterns ?? record.avoid_patterns),
    wolframHint: readString(record.wolframHint ?? record.wolfram_hint),
    casHint: readString(record.casHint ?? record.cas_hint ?? record.sage_hint),
    confidence: readConfidence(record.confidence)
  };
}

function dedupeTheorems(theorems: TheoremEntry[]): TheoremEntry[] {
  const deduped: TheoremEntry[] = [];
  const seen = new Set<string>();
  for (const theorem of theorems) {
    if (seen.has(theorem.id)) continue;
    seen.add(theorem.id);
    deduped.push(theorem);
  }
  return deduped;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean);
}

function readConfidence(value: unknown): TheoremEntry["confidence"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

function normalizeConfidence(prior: TheoremEntry["confidence"], score: number): TheoremSuggestion["confidence"] {
  if (prior) return prior;
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function suggestInvariants(scaleInfo: Record<string, string | number>, matched: TheoremSuggestion[]): string[] {
  const invariants: string[] = [];
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
  if (requiresTheoryFirstConstruction(text, matched)) reasons.push("analysis theorem-first task");

  return {
    isComplex: reasons.length >= 2,
    reasons,
    domainCount,
    constraintCount,
    length
  };
}

function requiresTheoryFirstConstruction(text: string, matched: TheoremSuggestion[]): boolean {
  const patterns = [/uniform/i, /compact/i, /dominat/i, /holomorphic/i, /contour/i, /asymptotic/i, /weak/i];
  const signalCount = patterns.filter(pattern => pattern.test(text)).length;
  const hasAnalysisTheorem = matched.some(item => item.domains.some(domain => ANALYSIS_DOMAINS.has(domain)));
  return signalCount >= 3 || (signalCount >= 2 && hasAnalysisTheorem);
}

function shouldPrioritizeAnalysisTheory(text: string, matched: TheoremSuggestion[]): boolean {
  if (!matched.length) return false;
  const asksForJustification = /\b(prove|show|justify|establish)\b|\u8bc1\u660e|\u6c42\u8bc1|\u8bf4\u660e/.test(text);
  return matched.some(item => (
    item.score >= 2 &&
    item.domains.some(domain => ANALYSIS_DOMAINS.has(domain)) &&
    (asksForJustification || item.preferredRecipe.length > 0 || item.verificationHints.length >= 2)
  ));
}

function isAnalysisTheorem(theorem: TheoremEntry): boolean {
  return theorem.domains.some(domain => ANALYSIS_DOMAINS.has(domain));
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

function inferProblemType(problem: string, analysis: ProblemAnalysis): string {
  const preferredDomain = [
    "elliptic_pde",
    "partial_differential_equations",
    "inequalities",
    "sobolev_spaces",
    "weak_solutions",
    "complex_analysis",
    "functional_analysis",
    "analysis"
  ].find(domain => analysis.detectedDomains.includes(domain));
  if (preferredDomain) return preferredDomain;
  const lowered = problem.toLowerCase();
  if (/integral|limit|series|sum|\u79ef\u5206|\u6781\u9650|\u7ea7\u6570|\u6c42\u548c/.test(lowered)) return "analysis";
  if (/matrix|eigen|linear/.test(lowered)) return "linear_algebra";
  return "general";
}

function extractObjects(problem: string, analysis: ProblemAnalysis): string[] {
  const objects: string[] = [];
  const namedAssignments = [...problem.matchAll(/\b([A-Z][A-Za-z0-9_]*|[a-z]_\{?\d+\}?|[a-z]_\d+)\s*(?:=|:=|is|be)\s*([^.;\n]+)/g)]
    .slice(0, 10)
    .map(match => `${match[1]} = ${match[2].trim()}`);
  appendUnique(objects, namedAssignments);

  const functions = [...problem.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*\(([^)]{1,40})\)/g)]
    .slice(0, 10)
    .map(match => `${match[1]}(${match[2]})`);
  appendUnique(objects, functions);
  appendUnique(objects, analysis.suggestedInvariants.slice(0, 8));
  return objects.slice(0, 16);
}

function inferStatementDomain(statement: string, analysis: ProblemAnalysis): string {
  const lowered = statement.toLowerCase();
  if (/residue|contour|pole|rouche|holomorphic|meromorphic/i.test(statement)) return "complex_analysis";
  if (/integral|limit|series|sum|convergen/i.test(lowered)) return "analysis";
  if (/matrix|eigen|operator|linear/i.test(statement)) return "linear_algebra";
  return analysis.detectedDomains[0] ?? "general";
}

function inferFinalTarget(problem: string, subproblems: Subproblem[]): string {
  const targetPatterns = [
    /\b(?:compute|find|determine|prove|show)\b([^.;\n]+)/gi,
    /(?:\u6c42|\u8ba1\u7b97|\u8bc1\u660e|\u5224\u65ad)([^\u3002\uff1b;\n]+)/g
  ];
  for (const pattern of targetPatterns) {
    const matches = [...problem.matchAll(pattern)];
    const last = matches.at(-1);
    if (last?.[0]) return last[0].trim();
  }
  return subproblems.at(-1)?.statement ?? "solve the original problem";
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
