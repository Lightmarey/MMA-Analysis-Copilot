import assert from "node:assert/strict";
import { WolframBackend } from "../src/wolfram/backend.js";
import { runVerificationTemplate } from "../src/agent/verification-templates.js";

const backend = new WolframBackend();

try {
  const simplify = await backend.call("wolfram_simplify", {
    expr: "Sin[x]^2 + Cos[x]^2",
    assumptions: "",
    operation: "FullSimplify"
  });
  assert.equal(simplify.ok, true);
  assert.equal(simplify.output, "1");

  const integral = await backend.call("wolfram_integrate", {
    expr: "x^2 Exp[-x]",
    variable: "x",
    lower: "0",
    upper: "Infinity",
    assumptions: ""
  });
  assert.equal(integral.ok, true);
  assert.equal(integral.output, "2");

  const conditionalIntegral = await backend.call("wolfram_integrate", {
    expr: "x^a",
    variable: "x",
    lower: "0",
    upper: "1",
    assumptions: ""
  });
  assert.equal(conditionalIntegral.ok, true);
  assert.equal(conditionalIntegral.output, "(1 + a)^(-1)");
  assert.match(conditionalIntegral.conditions ?? "", /Re\[a\] > -1/);
  assert.match(conditionalIntegral.rawOutput ?? "", /ConditionalExpression/);

  const limit = await backend.call("wolfram_limit", {
    expr: "Sin[x]/x",
    variable: "x",
    point: "0",
    direction: "",
    assumptions: ""
  });
  assert.equal(limit.ok, true);
  assert.equal(limit.output, "1");

  const derivative = await backend.call("wolfram_differentiate", {
    expr: "x^3 Sin[x]",
    variable: "x",
    order: 1,
    assumptions: ""
  });
  assert.equal(derivative.ok, true);
  assert.match(derivative.output ?? "", /3\*x\^2\*Sin\[x\]/);

  const algebra = await backend.call("wolfram_algebra", {
    expr: "x^4 - 1",
    operation: "Factor",
    variable: "",
    assumptions: ""
  });
  assert.equal(algebra.ok, true);
  assert.match(algebra.output ?? "", /-1 \+ x/);

  const matrix = await backend.call("wolfram_matrix", {
    matrix: "{{1, 2}, {3, 4}}",
    operation: "Det",
    variable: "",
    assumptions: ""
  });
  assert.equal(matrix.ok, true);
  assert.equal(matrix.output, "-2");

  const series = await backend.call("wolfram_series", {
    expr: "Sin[x]",
    variable: "x",
    point: "0",
    order: 5,
    assumptions: ""
  });
  assert.equal(series.ok, true);
  assert.match(series.output ?? "", /x\^5\/120/);

  const sum = await backend.call("wolfram_sum", {
    expr: "k",
    variable: "k",
    lower: "1",
    upper: "n",
    assumptions: "Element[n, Integers] && n >= 1"
  });
  assert.equal(sum.ok, true);
  assert.match(sum.output ?? "", /n/);
  assert.doesNotMatch(sum.output ?? "", /k\*n/);

  const sumConvergence = await backend.call("wolfram_convergence", {
    expr: "1/k^p",
    variable: "k",
    lower: "1",
    upper: "Infinity",
    operation: "SumConvergence",
    assumptions: ""
  });
  assert.equal(sumConvergence.ok, true);
  assert.equal(sumConvergence.output, "Re[p] > 1");

  const integralConditions = await backend.call("wolfram_convergence", {
    expr: "x^a",
    variable: "x",
    lower: "0",
    upper: "1",
    operation: "IntegralConditions",
    assumptions: ""
  });
  assert.equal(integralConditions.ok, true);
  assert.equal(integralConditions.output, "(1 + a)^(-1)");
  assert.match(integralConditions.conditions ?? "", /Re\[a\] > -1/);

  const residue = await backend.call("wolfram_residue", {
    expr: "1/(z - a)",
    variable: "z",
    point: "a",
    assumptions: ""
  });
  assert.equal(residue.ok, true);
  assert.equal(residue.output, "1");

  const transform = await backend.call("wolfram_transform", {
    expr: "Exp[-a t]",
    variable: "t",
    targetVariable: "s",
    transform: "LaplaceTransform",
    assumptions: "a > 0 && s > 0"
  });
  assert.equal(transform.ok, true);
  assert.match(transform.output ?? "", /a \+ s/);

  const directIneq = await backend.call("wolfram_eval", {
    code: "InequalityEngine`IneqSuggest[InequalityEngine`IneqNormalize[Integrate[f[x] g[x], {x, 0, 1}]]][[1, \"Rule\"]]"
  });
  assert.equal(directIneq.ok, true);
  assert.match(directIneq.output ?? "", /Holder/);

  const suggestedMove = await backend.call("inequality_engine", {
    operation: "suggest",
    goal: "Integrate[f[x] g[x], {x, 0, 1}]",
    known: "",
    context: "<|\"Domain\" -> Interval[{0, 1}], \"FunctionSpaces\" -> {\"f in L2\", \"g in L2\"}|>",
    state: "",
    moveId: "",
    ruleName: "",
    payload: ""
  });
  assert.equal(suggestedMove.ok, true);
  assert.match(suggestedMove.output ?? "", /holder_product_1/);
  assert.match(suggestedMove.output ?? "", /cauchy_schwarz_integral_1/);
  assert.match(suggestedMove.output ?? "", /NeedsUser/);

  const sumCauchyMove = await backend.call("inequality_engine", {
    operation: "suggest",
    goal: "Sum[a[i] b[i], {i, 1, n}]",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: ""
  });
  assert.equal(sumCauchyMove.ok, true);
  assert.match(sumCauchyMove.output ?? "", /cauchy_schwarz_sum_1/);
  assert.match(sumCauchyMove.output ?? "", /FiniteSum/);
  assert.match(sumCauchyMove.output ?? "", /choose-inner-product/);

  const youngMove = await backend.call("inequality_engine", {
    operation: "suggest",
    goal: "a b",
    known: "",
    context: "<|\"AllowedInequalities\" -> {\"Young\"}|>",
    state: "",
    moveId: "",
    ruleName: "",
    payload: ""
  });
  assert.equal(youngMove.ok, true);
  assert.match(youngMove.output ?? "", /young_product_1/);
  assert.match(youngMove.output ?? "", /ConjugateExponentsWithEpsilon/);
  assert.match(youngMove.output ?? "", /choose-small-parameter/);

  const abstractMoves = await backend.call("inequality_engine", {
    operation: "suggest",
    goal: "\"estimate u\"",
    known: "",
    context: "<|\"AllowedInequalities\" -> {\"Poincare\", \"Sobolev\"}, \"Domain\" -> \"bounded Lipschitz\", \"Dimension\" -> n, \"FunctionSpaces\" -> {\"u in W^{1,p}\"}|>",
    state: "",
    moveId: "",
    ruleName: "",
    payload: ""
  });
  assert.equal(abstractMoves.ok, true);
  assert.match(abstractMoves.output ?? "", /poincare_1/);
  assert.match(abstractMoves.output ?? "", /sobolev_1/);
  assert.match(abstractMoves.output ?? "", /AssumedFromContext/);

  const appliedMove = await backend.call("inequality_engine", {
    operation: "apply",
    goal: "Integrate[f[x] g[x], {x, 0, 1}]",
    known: "",
    context: "",
    state: "",
    moveId: "holder_product_1",
    ruleName: "Holder",
    payload: ""
  });
  assert.equal(appliedMove.ok, true);
  assert.match(appliedMove.output ?? "", /LastMove/);
  assert.match(appliedMove.output ?? "", /RequiredConditions/);

  const registry = await backend.call("inequality_engine", {
    operation: "registry",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: ""
  });
  assert.equal(registry.ok, true);
  assert.match(registry.output ?? "", /RuleCount/);
  assert.match(registry.output ?? "", /Holder/);
  assert.match(registry.output ?? "", /CauchySchwarz/);
  assert.match(registry.output ?? "", /Young/);
  assert.match(registry.output ?? "", /Poincare/);
  assert.match(registry.output ?? "", /Sobolev/);

  const parameterChoice = await backend.call("inequality_engine", {
    operation: "parameter",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: "<|\"Direction\" -> \"small\", \"Parameter\" -> eps, \"Condition\" -> C eps <= 1/2, \"Dependencies\" -> {C}|>"
  });
  assert.equal(parameterChoice.ok, true);
  assert.match(parameterChoice.output ?? "", /ParameterChoice/);
  assert.match(parameterChoice.output ?? "", /GeneratedByParameterChoice/);

  const invalidRegistration = await backend.call("inequality_engine", {
    operation: "register",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: "<|\"Type\" -> \"Rule\", \"Name\" -> \"BadRule\"|>"
  });
  assert.equal(invalidRegistration.ok, true);
  assert.match(invalidRegistration.output ?? "", /Rejected/);
  assert.match(invalidRegistration.output ?? "", /CanonicalForm/);

  const transformRegistration = await backend.call("inequality_engine", {
    operation: "register",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: "<|\"Type\" -> \"Transform\", \"Name\" -> \"test-transform\", \"Description\" -> \"Validated test transform.\", \"Cost\" -> 3|>"
  });
  assert.equal(transformRegistration.ok, true);
  assert.match(transformRegistration.output ?? "", /Registered/);
  assert.match(transformRegistration.output ?? "", /test-transform/);

  const coefficient = await runVerificationTemplate(backend, {
    template: "fourier_coefficient",
    expr: "2 y Sin[n Pi y]",
    assumptions: "Element[n, Integers] && n > 0",
    variable: "y",
    lower: "0",
    upper: "1",
    expected: "",
    claimed: "-2 (-1)^n/(n Pi)",
    rules: ""
  });
  assert.equal(coefficient.ok, true);
  assert.equal(coefficient.output, "True");
  assert.match(coefficient.messages?.[0] ?? "", /computed=/);

  console.log("wolfram tool tests passed");
} finally {
  backend.close();
}
