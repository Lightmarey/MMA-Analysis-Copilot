import fs from "node:fs";
import path from "node:path";
import { config } from "../../config.js";
import type { TheoremEntry } from "./types.js";

const builtinTheoremDir = path.resolve(config.rootDir, "theorems");

export const ANALYSIS_DOMAINS = new Set([
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

function isAnalysisTheorem(theorem: TheoremEntry): boolean {
  return theorem.domains.some(domain => ANALYSIS_DOMAINS.has(domain));
}
