import assert from "node:assert/strict";
import { WolframBackend } from "../src/wolfram/backend.js";
import { runVerificationTemplate } from "../src/agent/tools/verification-template.js";

const backend = new WolframBackend();

try {
  const simplify = await backend.call("wolfram_simplify", {
    expr: "Sin[x]^2 + Cos[x]^2",
    assumptions: "",
    operation: "FullSimplify"
  });
  assert.equal(simplify.ok, true);
  assert.equal(simplify.output, "1");

  const equivalence = await backend.call("wolfram_equivalence_check", {
    lhs: "(K+dK)/(L+dL) - K/L",
    rhs: "(dK*L - dL*K)/(L*(L+dL))",
    assumptions: "L != 0 && L + dL != 0",
    mode: "auto"
  });
  assert.equal(equivalence.ok, true);
  assert.match(equivalence.output ?? "", /DifferenceZero.*True/);
  assert.match(equivalence.output ?? "", /Equivalent.*True/);

  const reduceEquivalence = await backend.call("wolfram_equivalence_check", {
    lhs: "x > 1",
    rhs: "x >= 1 && x != 1",
    assumptions: "Element[x, Reals]",
    mode: "reduce_equivalence"
  });
  assert.equal(reduceEquivalence.ok, true);
  assert.equal(reduceEquivalence.output, "True");

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

  const seriesCoefficient = await backend.call("series_coefficient_check", {
    expr: "Exp[x]",
    variable: "x",
    point: "0",
    order: 3,
    expected: "1 + x + x^2/2 + x^3/6",
    assumptions: ""
  });
  assert.equal(seriesCoefficient.ok, true);
  assert.match(seriesCoefficient.output ?? "", /DifferenceZero.*True/);
  assert.match(seriesCoefficient.output ?? "", /CoefficientRules/);

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

  const directProofPattern = await backend.call("wolfram_eval", {
    code: "ProofPatternEngine`PPSuggest[ProofPatternEngine`PPNormalize[Integrate[f[x] g[x], {x, 0, 1}]]][[1, \"Rule\"]]"
  });
  assert.equal(directProofPattern.ok, true);
  assert.match(directProofPattern.output ?? "", /Holder/);

  const compatIneq = await backend.call("wolfram_eval", {
    code: "Get[\"wolfram/InequalityEngine.wl\"]; InequalityEngine`IneqSuggest[InequalityEngine`IneqNormalize[Integrate[f[x] g[x], {x, 0, 1}]]][[1, \"Rule\"]]"
  });
  assert.equal(compatIneq.ok, true);
  assert.match(compatIneq.output ?? "", /Holder/);

  const suggestedMove = await backend.call("proof_pattern_engine", {
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

  const sumCauchyMove = await backend.call("proof_pattern_engine", {
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

  const youngMove = await backend.call("proof_pattern_engine", {
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

  const abstractMoves = await backend.call("proof_pattern_engine", {
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

  const appliedMove = await backend.call("proof_pattern_engine", {
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

  const registry = await backend.call("proof_pattern_engine", {
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
  assert.match(registry.output ?? "", /ProofPatternEngine/);
  assert.match(registry.output ?? "", /CompatibilityAliases/);
  assert.match(registry.output ?? "", /HeuristicCount/);
  assert.match(registry.output ?? "", /Holder/);
  assert.match(registry.output ?? "", /CauchySchwarz/);
  assert.match(registry.output ?? "", /Young/);
  assert.match(registry.output ?? "", /Poincare/);
  assert.match(registry.output ?? "", /Sobolev/);
  assert.match(registry.output ?? "", /LLMMoveSchema/);
  assert.match(registry.output ?? "", /compile/);

  const proofPatternStructure = await backend.call("wolfram_eval", {
    code: "Module[{ruleFiles, transformFiles, rules, transforms, registry, compiler}, ruleFiles = FileNames[\"*.json\", FileNameJoin[{Directory[], \"wolfram\", \"ProofPatternEngine\", \"Data\", \"Rules\"}]]; transformFiles = FileNames[\"*.json\", FileNameJoin[{Directory[], \"wolfram\", \"ProofPatternEngine\", \"Data\", \"Transforms\"}]]; rules = Import[#, \"RawJSON\"] & /@ ruleFiles; transforms = Import[#, \"RawJSON\"] & /@ transformFiles; registry = ProofPatternEngine`PPHandleRequest[<|\"operation\" -> \"registry\"|>]; compiler = Import[FileNameJoin[{Directory[], \"wolfram\", \"ProofPatternEngine\", \"Kernel\", \"Compiler.wl\"}], \"Text\"]; <|\"RuleFiles\" -> Length[ruleFiles], \"RulesValid\" -> AllTrue[rules, TrueQ[Lookup[ProofPatternEngine`ValidatePPRule[#], \"Valid\", False]] &], \"TransformFiles\" -> Length[transformFiles], \"TransformsValid\" -> AllTrue[transforms, TrueQ[Lookup[ProofPatternEngine`ValidatePPTransform[#], \"Valid\", False]] &], \"HeuristicsLoaded\" -> Lookup[registry, \"HeuristicCount\", 0] >= 5, \"CompilerNoRegistration\" -> ! StringContainsQ[compiler, \"RegisterPPRule[\"] && ! StringContainsQ[compiler, \"RegisterPPTransform[\"]|>]"
  });
  assert.equal(proofPatternStructure.ok, true);
  assert.match(proofPatternStructure.output ?? "", /"RuleFiles" -> 6/);
  assert.match(proofPatternStructure.output ?? "", /"RulesValid" -> True/);
  assert.match(proofPatternStructure.output ?? "", /"TransformFiles" -> 11/);
  assert.match(proofPatternStructure.output ?? "", /"TransformsValid" -> True/);
  assert.match(proofPatternStructure.output ?? "", /"HeuristicsLoaded" -> True/);
  assert.match(proofPatternStructure.output ?? "", /"CompilerNoRegistration" -> True/);

  const compiledMoveSchema = await backend.call("proof_pattern_engine", {
    operation: "compile",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: "<|\"RuleIntent\" -> \"Holder\", \"TransformIntents\" -> {\"abs_dominate\", \"explicit_product\"}, \"ConditionIntents\" -> {\"integrability\", \"conjugate exponents\"}, \"MissingConditionIntents\" -> {\"norm membership\"}|>"
  });
  assert.equal(compiledMoveSchema.ok, true);
  assert.match(compiledMoveSchema.output ?? "", /Compiled/);
  assert.match(compiledMoveSchema.output ?? "", /RulePlan/);
  assert.match(compiledMoveSchema.output ?? "", /RuleIntent/);
  assert.match(compiledMoveSchema.output ?? "", /abs-dominate/);
  assert.match(compiledMoveSchema.output ?? "", /ConditionIntents/);
  assert.match(compiledMoveSchema.output ?? "", /proof-move intent/);
  assert.doesNotMatch(compiledMoveSchema.output ?? "", /ToExpression/);
  assert.doesNotMatch(compiledMoveSchema.output ?? "", /Bindings/);

  const problemSpecificSchema = await backend.call("proof_pattern_engine", {
    operation: "compile",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: "<|\"moveName\" -> \"quotient difference rewrite\", \"steps\" -> {\"common denominator\", \"cancel shared numerator term\"}, \"bindings\" -> {a -> a[x], b -> b[x]}, \"sideConditions\" -> <|\"denominator\" -> \"b != 0\"|>, \"missingSideConditions\" -> <|\"perturbed denominator\" -> \"b + db != 0\"|>|>"
  });
  assert.equal(problemSpecificSchema.ok, true);
  assert.match(problemSpecificSchema.output ?? "", /Rejected/);
  assert.match(problemSpecificSchema.output ?? "", /intent-only/);
  assert.match(problemSpecificSchema.output ?? "", /generic proof intent labels/);

  const naturalMoveSchema = await backend.call("proof_pattern_engine", {
    operation: "compile",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: "<|\"moveLabel\" -> \"scale balance solve\", \"transformation\" -> \"solve supplied scale equation\", \"conditionIntents\" -> {\"positive scale parameter\", \"positive exponent parameter\"}, \"missingAssumptions\" -> \"None\"|>"
  });
  assert.equal(naturalMoveSchema.ok, true);
  assert.match(naturalMoveSchema.output ?? "", /Compiled/);
  assert.match(naturalMoveSchema.output ?? "", /AdHocRuleIntent/);
  assert.match(naturalMoveSchema.output ?? "", /scale balance solve/);
  assert.doesNotMatch(naturalMoveSchema.output ?? "", /Rejected/);

  const formulaIntentSchema = await backend.call("proof_pattern_engine", {
    operation: "compile",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: "<|\"suppliedMove\" -> \"differentiate then substitute\", \"steps\" -> {\"differentiate\", \"substitute\"}, \"conditionIntents\" -> {\"differentiability\"}, \"missingConditionIntents\" -> {}|>"
  });
  assert.equal(formulaIntentSchema.ok, true);
  assert.match(formulaIntentSchema.output ?? "", /Compiled/);
  assert.match(formulaIntentSchema.output ?? "", /differentiate then substitute/);
  assert.doesNotMatch(formulaIntentSchema.output ?? "", /binding1/);
  assert.doesNotMatch(formulaIntentSchema.output ?? "", /Rejected/);

  const noCandidateMove = await backend.call("proof_pattern_engine", {
    operation: "suggest",
    goal: "foo[x]",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: ""
  });
  assert.equal(noCandidateMove.ok, true);
  assert.match(noCandidateMove.output ?? "", /NoCandidate/);
  assert.match(noCandidateMove.output ?? "", /restricted schema/);

  const parameterChoice = await backend.call("proof_pattern_engine", {
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

  const largeParameterChoice = await backend.call("proof_pattern_engine", {
    operation: "parameter",
    goal: "",
    known: "",
    context: "",
    state: "",
    moveId: "",
    ruleName: "",
    payload: "<|\"Direction\" -> \"large\", \"Parameter\" -> A2, \"Condition\" -> A2 > C*K0*A0, \"Dependencies\" -> {C, K0, A0}|>"
  });
  assert.equal(largeParameterChoice.ok, true);
  assert.match(largeParameterChoice.output ?? "", /ParameterChoice/);
  assert.match(largeParameterChoice.output ?? "", /"Direction" -> "large"/);
  assert.match(largeParameterChoice.output ?? "", /A2/);

  const integrationByPartsMove = await backend.call("proof_pattern_engine", {
    operation: "suggest",
    goal: "Integrate[u'[x] v[x], {x, a, b}]",
    known: "",
    context: "<|\"TransformHints\" -> {\"integration by parts\"}|>",
    state: "",
    moveId: "",
    ruleName: "",
    payload: ""
  });
  assert.equal(integrationByPartsMove.ok, true);
  assert.match(integrationByPartsMove.output ?? "", /integration_by_parts_1/);
  assert.match(integrationByPartsMove.output ?? "", /BoundaryTrace/);
  assert.match(integrationByPartsMove.output ?? "", /move-derivative/);

  const invalidRegistration = await backend.call("proof_pattern_engine", {
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

  const transformRegistration = await backend.call("proof_pattern_engine", {
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

  const firstVariation = await runVerificationTemplate(backend, {
    template: "first_variation_derivative",
    expr: "(x + t h)^2",
    assumptions: "",
    variable: "t",
    lower: "",
    upper: "",
    expected: "",
    claimed: "2 h x",
    rules: ""
  });
  assert.equal(firstVariation.ok, true);
  assert.equal(firstVariation.output, "True");

  const substitutionCheck = await runVerificationTemplate(backend, {
    template: "substitution_check",
    expr: "normal + (n-2)/2*M*w",
    assumptions: "",
    variable: "",
    lower: "",
    upper: "",
    expected: "",
    claimed: "",
    rules: "{normal -> -(n-2)/2*M*w}"
  });
  assert.equal(substitutionCheck.ok, true);
  assert.equal(substitutionCheck.output, "0");

  const radialLaplacian = await runVerificationTemplate(backend, {
    template: "radial_laplacian_check",
    expr: "r^2",
    assumptions: "",
    variable: "r",
    lower: "",
    upper: "",
    expected: "dimension=n",
    claimed: "2 n",
    rules: ""
  });
  assert.equal(radialLaplacian.ok, true);
  assert.equal(radialLaplacian.output, "True");

  const odeResidual = await runVerificationTemplate(backend, {
    template: "ode_residual_check",
    expr: "D[Exp[x], x] - Exp[x]",
    assumptions: "",
    variable: "x",
    lower: "",
    upper: "",
    expected: "",
    claimed: "",
    rules: ""
  });
  assert.equal(odeResidual.ok, true);
  assert.equal(odeResidual.output, "0");

  const scalingPower = await runVerificationTemplate(backend, {
    template: "scaling_power_check",
    expr: "((2-n)/2) + (1 - n/2) + (n-2)",
    assumptions: "Element[n, Integers] && n >= 3",
    variable: "",
    lower: "",
    upper: "",
    expected: "",
    claimed: "",
    rules: ""
  });
  assert.equal(scalingPower.ok, true);
  assert.equal(scalingPower.output, "0");

  const hessianInvariants = await runVerificationTemplate(backend, {
    template: "hessian_matrix_invariants",
    expr: "{{a, 0}, {0, b}}",
    assumptions: "",
    variable: "lambda",
    lower: "",
    upper: "",
    expected: "",
    claimed: "",
    rules: ""
  });
  assert.equal(hessianInvariants.ok, true);
  assert.match(hessianInvariants.output ?? "", /CharacteristicPolynomial/);
  assert.match(hessianInvariants.output ?? "", /a\*b/);

  console.log("wolfram tool tests passed");
} finally {
  backend.close();
}
