import type { TheoremSuggestion } from "./planning.js";



export function inferRecommendedTools(problem: string, suggestedTheorems: TheoremSuggestion[], theoryFirst: boolean): string[] {
  const lowered = problem.toLowerCase();
  const tools: string[] = [];
  if (theoryFirst || suggestedTheorems.length) tools.push("theorem_advisor");
  for (const theorem of suggestedTheorems) {
    appendUnique(tools, [...theorem.wolframHint.matchAll(/\bwolfram_[a-z_]+\b/g)].map(match => match[0]));
    appendUnique(tools, [...theorem.casHint.matchAll(/\bwolfram_[a-z_]+\b/g)].map(match => match[0]));
  }
  tools.push("load_tool");
  if (/integral|integrate|\u79ef\u5206|\u222b/.test(lowered)) tools.push("wolfram_integrate");
  if (/derivative|differentiate|d\/d|partial|\u6c42\u5bfc|\u5bfc\u6570|\u504f\u5bfc/.test(lowered)) tools.push("wolfram_differentiate");
  if (/limit|lim\b|\u6781\u9650/.test(lowered)) tools.push("wolfram_limit");
  if (/series|taylor|laurent|asymptotic|coefficient|leading term|residual order|\u5c55\u5f00|\u7ea7\u6570/.test(lowered)) tools.push("wolfram_series", "series_coefficient_check");
  if (/sum|summation|sigma|\u6c42\u548c|\u03a3/.test(lowered)) tools.push("wolfram_sum");
  if (/convergen|divergen|converges|diverges|test\s+for|判别|收敛|发散/.test(lowered)) tools.push("wolfram_convergence");
  if (/ode|differential equation|dsolve|\u5fae\u5206\u65b9\u7a0b/.test(lowered)) tools.push("wolfram_dsolve");
  if (/laplace|fourier|mellin|z[-\s]?transform|\u53d8\u6362/.test(lowered)) tools.push("wolfram_transform");
  if (/residue|contour|pole|\u7559\u6570|\u56f4\u9053/.test(lowered)) tools.push("wolfram_residue");
  if (/solve|equation|\u65b9\u7a0b|\u4e0d\u7b49\u5f0f/.test(lowered)) tools.push("wolfram_solve");
  if (/expand|factor|apart|together|cancel|collect|\u5c55\u5f00|\u56e0\u5f0f|\u56e0\u5f0f\u5206\u89e3|\u901a\u5206|\u5408\u5e76\u540c\u7c7b/.test(lowered)) tools.push("wolfram_algebra");
  if (/matrix|determinant|eigen|rank|inverse|row reduce|\u77e9\u9635|\u884c\u5217\u5f0f|\u7279\u5f81\u503c|\u9006\u77e9\u9635/.test(lowered)) tools.push("wolfram_matrix");
  if (/equivalent|equivalence|same as|before\/after|lhs|rhs|\u7b49\u4ef7/.test(lowered)) tools.push("wolfram_equivalence_check");
  if (/simplify|prove identity|identity|\u5316\u7b80|\u6052\u7b49/.test(lowered)) tools.push("wolfram_simplify");
  if (!tools.length) tools.push("wolfram_simplify", "wolfram_eval");
  return [...new Set(tools)];
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
