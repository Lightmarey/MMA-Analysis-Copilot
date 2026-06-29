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
  estimatePatterns: EstimatePatternSuggestion[];
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
