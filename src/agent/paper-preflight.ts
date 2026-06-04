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

type MethodRule = {
  method: string;
  detect: RegExp;
  symbolicTools: string[];
  required: Array<{ label: string; regex: RegExp }>;
};

const METHOD_RULES: MethodRule[] = [
  {
    method: "variational_functional",
    detect: /variational|functional|first variation|euler[-\s]?lagrange|nehari|pohozaev|变分|泛函|欧拉|拉格朗日/i,
    symbolicTools: ["verification_template:first_variation_derivative", "wolfram_differentiate", "wolfram_simplify"],
    required: [
      { label: "functional or one-parameter expression", regex: /(?:E|J|I|F)\s*(?:\[|\(|=)|\+\s*t|t\s*\*|u\s*\+\s*t|\\mathcal\{[EJIF]\}/i }
    ]
  },
  {
    method: "barrier_construction",
    detect: /barrier|auxiliary\s+function|maximum\s+principle|sub[-\s]?solution|super[-\s]?solution|闸函数|辅助函数|上下解|最大值原理/i,
    symbolicTools: ["verification_template:barrier_operator_check", "wolfram_differentiate", "wolfram_simplify"],
    required: [
      { label: "candidate barrier or auxiliary function", regex: /(?:H|W|w|\\phi|\\psi|phi|psi)\s*(?:\([^)]*\)|\[[^\]]*\])?\s*(?:=|:=)|\\begin\{equation/i },
      { label: "operator or residual", regex: /(?:L|\\Delta|\\partial|D\^2|-\s*L|operator|residual)/i }
    ]
  },
  {
    method: "moving_spheres",
    detect: /moving\s+spheres|moving\s+planes|kelvin|inversion|reflection|球面|移动球|反演/i,
    symbolicTools: ["verification_template:kelvin_power_check", "wolfram_simplify", "wolfram_differentiate"],
    required: [
      { label: "Kelvin/inversion formula", regex: /(?:lambda|\\lambda|\u03bb)\s*\^|(?:\/\s*\|?y\|?|\|y\|)|Kelvin|inversion|反演/i },
      { label: "comparison function", regex: /(?:w|W|\\tilde\s*w|v_\{?k\}?|u)\s*(?:=|:=|\\ge|\\le)/i }
    ]
  },
  {
    method: "ode_reduction",
    detect: /\bODE\b|ordinary\s+differential|radial\s+equation|radial\s+laplacian|differential\s+inequality|常微分|径向|微分不等式/i,
    symbolicTools: ["verification_template:ode_residual_check", "verification_template:radial_laplacian_check", "wolfram_dsolve"],
    required: [
      { label: "ODE or radial differential expression", regex: /(?:u''|w''|D\[|\\frac\{d|\\dot|\\ddot|\\Delta|radial|ODE|微分)/i }
    ]
  },
  {
    method: "hessian_matrix",
    detect: /hessian|matrix|principal\s+minor|determinant|eigenvalue|maclaurin|newton|矩阵|主子式|特征值|行列式/i,
    symbolicTools: ["verification_template:hessian_matrix_invariants", "wolfram_matrix", "wolfram_simplify"],
    required: [
      { label: "explicit matrix, Hessian, determinant, or minors", regex: /\{\{|\bmatrix\b|pmatrix|bmatrix|D\^2|Hessian|det|Det|S_\{|\\sigma|主子式/i }
    ]
  },
  {
    method: "manifold_integral",
    detect: /manifold|sphere\s+integral|spherical|representation|invariant\s+measure|流形|表示论|球面积分|不变测度/i,
    symbolicTools: ["wolfram_integrate", "wolfram_simplify", "wolfram_transform"],
    required: [
      { label: "integrand, chart, Jacobian, or measure", regex: /\\int|Integrate|d\\mu|Jacobian|chart|coordinate|volume|测度|积分/i }
    ]
  },
  {
    method: "inequality_estimate",
    detect: /inequality|estimate|holder|young|cauchy|sobolev|poincare|absorb|不等式|估计|吸收/i,
    symbolicTools: ["inequality_engine", "wolfram_simplify", "verification_template:parameter_absorption_check"],
    required: [
      { label: "explicit inequality or product/sum/integral expression", regex: /\\le|\\ge|<=|>=|\\sum|\\int|Integrate|Sum|\b[A-Za-z]\s*\*\s*[A-Za-z]/i }
    ]
  }
];

export function analyzePaperPreflight(text: string): PaperPreflight {
  const method = detectMethod(text);
  const evidence = collectEvidence(text);
  if (!method) {
    return {
      class: evidence.length ? "qualitative-only" : "needs-author-data",
      method: "unknown",
      symbolicTools: [],
      missing: ["method-specific local target"],
      evidence,
      maxToolCalls: evidence.length ? 1 : 0,
      recommendedResponse: evidence.length
        ? "Audit the logical structure and ask for the missing symbolic target."
        : "Ask for a concrete local excerpt or formula before using tools."
    };
  }

  const missing = method.required
    .filter(item => !item.regex.test(text))
    .map(item => item.label);
  const hasFormula = hasExplicitFormula(text);
  const klass: PaperPreflightClass = missing.length === 0
    ? "symbolic-checkable"
    : hasFormula || evidence.length
      ? "needs-author-data"
      : "qualitative-only";

  return {
    class: klass,
    method: method.method,
    symbolicTools: klass === "symbolic-checkable" ? method.symbolicTools : [],
    missing,
    evidence,
    maxToolCalls: klass === "symbolic-checkable" ? 3 : evidence.length ? 1 : 0,
    recommendedResponse: klass === "symbolic-checkable"
      ? "Run only the listed local checks, then separate Wolfram evidence from analytic assumptions."
      : "Do not invent formulas; report missing local data and audit author-side assumptions."
  };
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

function detectMethod(text: string): MethodRule | null {
  const explicit = METHOD_RULES.find(rule => new RegExp(`\\b${rule.method}\\b`, "i").test(text));
  if (explicit) return explicit;
  return METHOD_RULES.find(rule => rule.detect.test(text)) ?? null;
}

function collectEvidence(text: string): string[] {
  const evidence: string[] = [];
  if (hasExplicitFormula(text)) evidence.push("explicit formula or relation");
  if (/\\begin\{(?:equation|align|aligned)\}|\\\[|\\\]/.test(text)) evidence.push("display math");
  if (/\\eqref|\\label/.test(text)) evidence.push("cross-reference");
  if (/compact|strictly positive|maximum principle|Hopf|boundary|convergence|narrow domain/i.test(text)) evidence.push("qualitative analytic step");
  return [...new Set(evidence)];
}

function hasExplicitFormula(text: string): boolean {
  return /(?:=|<=|>=|\\le|\\ge|\\sum|\\int|D\[|Integrate|Sum|\{\{|\\Delta|\\nabla|D\^2|S_\{)/.test(text);
}
