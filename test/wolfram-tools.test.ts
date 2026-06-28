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

  const formulaRegistry = await backend.call("formula_transform", {
    action: "inspect_registry",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(formulaRegistry.ok, true);
  assert.match(formulaRegistry.output ?? "", /FormulaTransformEngine/);
  assert.match(formulaRegistry.output ?? "", /formula_transform/);
  assert.match(formulaRegistry.output ?? "", /Holder/);
  assert.match(formulaRegistry.output ?? "", /CauchySchwarz/);
  assert.match(formulaRegistry.output ?? "", /Young/);
  assert.match(formulaRegistry.output ?? "", /IntegrationByParts/);
  assert.match(formulaRegistry.output ?? "", /SplitSqrt/);
  assert.match(formulaRegistry.output ?? "", /MultiplyByOne/);
  assert.match(formulaRegistry.output ?? "", /RegistryKinds/);
  assert.match(formulaRegistry.output ?? "", /CanonicalFormulaTransform/);
  assert.match(formulaRegistry.output ?? "", /HeuristicRewrite/);
  assert.match(formulaRegistry.output ?? "", /EstimateSeed/);
  assert.match(formulaRegistry.output ?? "", /StructuralTransform/);
  assert.match(formulaRegistry.output ?? "", /TargetPlanner/);
  assert.match(formulaRegistry.output ?? "", /ObligationDischarger/);
  assert.match(formulaRegistry.output ?? "", /Poincare/);
  assert.match(formulaRegistry.output ?? "", /Sobolev/);
  assert.match(formulaRegistry.output ?? "", /"EstimateSeedCount" -> 2/);
  assert.match(formulaRegistry.output ?? "", /DerivativeProduct/);
  assert.match(formulaRegistry.output ?? "", /CommutatorDerivative/);
  assert.match(formulaRegistry.output ?? "", /NormalizeByFactor/);
  assert.match(formulaRegistry.output ?? "", /DropBoundaryTerm/);
  assert.match(formulaRegistry.output ?? "", /"StructuralTransformCount" -> 4/);
  assert.match(formulaRegistry.output ?? "", /YoungAbsorption/);
  assert.match(formulaRegistry.output ?? "", /WeightedHolder/);
  assert.match(formulaRegistry.output ?? "", /"TargetPlannerCount" -> 2/);
  assert.match(formulaRegistry.output ?? "", /BoundaryVanishes/);
  assert.match(formulaRegistry.output ?? "", /FunctionSpaceRegularityDeclaration/);
  assert.match(formulaRegistry.output ?? "", /NormalizationDeclaration/);
  assert.match(formulaRegistry.output ?? "", /RealValuedDeclaration/);
  assert.match(formulaRegistry.output ?? "", /"ObligationDischargerCount" -> 4/);
  const formulaRegistryJson = formulaRegistry.json as Record<string, any>;
  assert.equal(formulaRegistryJson.Package, "FormulaTransformEngine");
  assert.equal(formulaRegistryJson.PublicTool, "formula_transform");
  assert.ok(formulaRegistryJson.RegistryKinds.CanonicalFormulaTransform.includes("Holder"));

  const formulaRegistryReload = await backend.call("formula_transform", {
    action: "reload_registry",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(formulaRegistryReload.ok, true);
  const reloadJson = formulaRegistryReload.json as Record<string, any>;
  assert.equal(reloadJson.Kind, "FormulaTransformRegistryReload");
  assert.equal(reloadJson.Loaded.RuleFiles, 4);
  assert.equal(reloadJson.Registry.RuleCount, 4);

  const derivativeProduct = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[D][f[x] g[x], x]",
    rule: "DerivativeProduct",
    direction: "Equal",
    part: "Whole",
    parameters: "",
    assumptions: "True",
    context: "selected expression has enough differentiability/regularity for structural equality",
    state: "",
    payload: ""
  });
  assert.equal(derivativeProduct.ok, true);
  assert.match(derivativeProduct.output ?? "", /"RegistryKind" -> "StructuralTransform"/);
  assert.match(derivativeProduct.output ?? "", /"Runtime" -> "GenericStructural"/);
  assert.match(derivativeProduct.output ?? "", /ApplyGenericStructuralTransform/);
  assert.match(derivativeProduct.output ?? "", /DerivativeProduct/);
  assert.match(derivativeProduct.output ?? "", /Inactive\[D\]\[f\[x\]\*g\[x\], x\] ==/);
  assert.match(derivativeProduct.output ?? "", /g\[x\]\*Inactive\[D\]\[f\[x\], x\]/);
  assert.match(derivativeProduct.output ?? "", /f\[x\]\*Inactive\[D\]\[g\[x\], x\]/);
  assert.match(derivativeProduct.output ?? "", /DischargedByFunctionSpaceRegularityDeclaration/);
  const derivativeProductJson = derivativeProduct.json as Record<string, any>;
  assert.equal(derivativeProductJson.Kind, "FormulaTransform");
  assert.equal(derivativeProductJson.Rule, "DerivativeProduct");
  assert.match(derivativeProductJson.RelationInputForm, /Inactive\[D\]\[f\[x\]\*g\[x\], x\] ==/);
  assert.equal(derivativeProductJson.Conditions.Discovered.length, 1);
  assert.equal(derivativeProductJson.Conditions.Discovered[0].Predicate, "Regularity");
  assert.equal(derivativeProductJson.Conditions.Discovered[0].Structured.Predicate, "Regularity");
  assert.ok(derivativeProductJson.Conditions.Discovered[0].DischargeStrategy.includes("RegisteredDischarger"));
  assert.equal(derivativeProductJson.Conditions.Discovered[0].FallbackText, false);
  assert.equal(derivativeProductJson.Conditions.Discovered[0].Provenance, "StructuredCondition");
  assert.deepEqual(derivativeProductJson.Obligations, []);
  assert.equal(derivativeProductJson.State.Head, "FormulaTransformState");

  const commutatorDerivative = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[D][a[x] u[x], x] - a[x] Inactive[D][u[x], x]",
    rule: "CommutatorDerivative",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "True",
    context: "selected expression has enough differentiability/regularity for structural equality",
    state: "",
    payload: ""
  });
  assert.equal(commutatorDerivative.ok, true);
  assert.match(commutatorDerivative.output ?? "", /CommutatorDerivative/);
  assert.match(commutatorDerivative.output ?? "", /"Runtime" -> "GenericStructural"/);
  assert.match(commutatorDerivative.output ?? "", /ApplyGenericStructuralTransform/);
  assert.match(commutatorDerivative.output ?? "", /"Direction" -> "Equal"/);
  assert.match(commutatorDerivative.output ?? "", /u\[x\]\*Inactive\[D\]\[a\[x\], x\]/);

  const normalizeByFactor = await backend.call("formula_transform", {
    action: "apply",
    formula: "C E",
    rule: "NormalizeByFactor",
    direction: "Equal",
    part: "Whole",
    parameters: JSON.stringify({ factor: "C" }),
    assumptions: "C != 0",
    context: "selected expression has enough differentiability/regularity for structural equality",
    state: "",
    payload: ""
  });
  assert.equal(normalizeByFactor.ok, true);
  assert.match(normalizeByFactor.output ?? "", /NormalizeByFactor/);
  assert.match(normalizeByFactor.output ?? "", /"Runtime" -> "GenericStructural"/);
  assert.match(normalizeByFactor.output ?? "", /ApplyGenericStructuralTransform/);
  assert.match(normalizeByFactor.output ?? "", /"NormalizedExpression" -> E/);
  assert.match(normalizeByFactor.output ?? "", /NormalizationFactorNonzero/);
  assert.match(normalizeByFactor.output ?? "", /DischargedByAssumptions/);

  const dropBoundaryTerm = await backend.call("formula_transform", {
    action: "apply",
    formula: "u[b] v[b] - u[a] v[a] - Inactive[Integrate][u[x] Inactive[D][v[x], x], {x, a, b}]",
    rule: "DropBoundaryTerm",
    direction: "Equal",
    part: "Whole",
    parameters: JSON.stringify({ boundaryTerm: "u[b] v[b] - u[a] v[a]" }),
    assumptions: "True",
    context: "u has zero boundary trace, so boundary term vanishes",
    state: "",
    payload: ""
  });
  assert.equal(dropBoundaryTerm.ok, true);
  assert.match(dropBoundaryTerm.output ?? "", /DropBoundaryTerm/);
  assert.match(dropBoundaryTerm.output ?? "", /"Runtime" -> "GenericStructural"/);
  assert.match(dropBoundaryTerm.output ?? "", /ApplyGenericStructuralTransform/);
  assert.match(dropBoundaryTerm.output ?? "", /"BoundaryTerm" -> -\(u\[a\]\*v\[a\]\) \+ u\[b\]\*v\[b\]/);
  assert.match(dropBoundaryTerm.output ?? "", /"ReducedExpression" -> -Inactive\[Integrate\]\[u\[x\]\*Inactive\[D\]\[v\[x\], x\], \{x, a, b\}\]/);
  assert.match(dropBoundaryTerm.output ?? "", /BoundaryCondition/);
  assert.match(dropBoundaryTerm.output ?? "", /DischargedByBoundaryVanishes/);
  assert.match(dropBoundaryTerm.output ?? "", /BoundaryTermVanishesInContext/);

  const youngAbsorptionPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "C a b",
    rule: "Young",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      targetRelation: "C a b <= 1/2 a^2 + K b^2",
      absorbFactor: "a",
      objective: "synthesize-parameters"
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngAbsorptionPlan.ok, true);
  assert.match(youngAbsorptionPlan.output ?? "", /FormulaTransformPlan/);
  assert.match(youngAbsorptionPlan.output ?? "", /TargetGuided" -> True/);
  assert.match(youngAbsorptionPlan.output ?? "", /"TargetPlanner" -> "YoungAbsorption"/);
  assert.match(youngAbsorptionPlan.output ?? "", /"TargetPlannerPrimitives" -> \{[^}]*InferAbsorbedQuadraticFactor/);
  assert.match(youngAbsorptionPlan.output ?? "", /BuildResidualCoefficientCondition/);
  assert.match(youngAbsorptionPlan.output ?? "", /TargetPlannerPrimitiveAudit/);
  assert.match(youngAbsorptionPlan.output ?? "", /"MissingRequired" -> \{\}/);
  assert.match(youngAbsorptionPlan.output ?? "", /"Primitive" -> "InferAbsorbedQuadraticFactor", "Status" -> "Executed"/);
  assert.match(youngAbsorptionPlan.output ?? "", /YoungAbsorption/);
  assert.match(youngAbsorptionPlan.output ?? "", /"AbsorbFactor" -> a/);
  assert.match(youngAbsorptionPlan.output ?? "", /"ResidualFactor" -> b/);
  assert.match(youngAbsorptionPlan.output ?? "", /"ProductCoefficient" -> C/);
  assert.match(youngAbsorptionPlan.output ?? "", /K >= C\^2\/2/);
  assert.match(youngAbsorptionPlan.output ?? "", /"RegistryMutation" -> False/);
  assert.match(youngAbsorptionPlan.output ?? "", /YoungResidualCoefficient/);
  assert.match(youngAbsorptionPlan.output ?? "", /Deferred/);

  const youngAutoPartPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "F[C a b, r]",
    rule: "Young",
    direction: "Upper",
    part: "Auto",
    parameters: JSON.stringify({
      targetRelation: "C a b <= 1/2 a^2 + K b^2",
      absorbFactor: "a"
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngAutoPartPlan.ok, true);
  assert.match(youngAutoPartPlan.output ?? "", /FormulaTransformPlan/);
  assert.match(youngAutoPartPlan.output ?? "", /"Selected" -> a\*b\*C/);
  assert.match(youngAutoPartPlan.output ?? "", /"Part" -> "Auto"/);
  assert.match(youngAutoPartPlan.output ?? "", /"PartPath" -> \{1\}/);
  assert.match(youngAutoPartPlan.output ?? "", /SelectPart/);
  assert.match(youngAutoPartPlan.output ?? "", /YoungAbsorption/);

  const youngPartCandidates = await backend.call("formula_transform", {
    action: "plan_parts",
    formula: "F[C a b, C u v]",
    rule: "Young",
    direction: "Upper",
    part: "Auto",
    parameters: JSON.stringify({
      targetPattern: "C_. x_ y_",
      targetRelation: "C a b <= 1/2 a^2 + K b^2",
      absorbFactor: "a"
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngPartCandidates.ok, true);
  assert.match(youngPartCandidates.output ?? "", /FormulaTransformPartPlan/);
  assert.match(youngPartCandidates.output ?? "", /"CandidateCount" -> 2/);
  assert.match(youngPartCandidates.output ?? "", /"PartPath" -> \{1\}/);
  assert.match(youngPartCandidates.output ?? "", /"PartPath" -> \{2\}/);
  assert.match(youngPartCandidates.output ?? "", /"Applicable" -> True/);
  assert.match(youngPartCandidates.output ?? "", /PlanPreview/);
  assert.match(youngPartCandidates.output ?? "", /YoungAbsorption/);
  assert.match(youngPartCandidates.output ?? "", /"RegistryMutation" -> False/);

  const partCandidatesOnly = await backend.call("formula_transform", {
    action: "plan_parts",
    formula: "F[x y, u v]",
    rule: "",
    direction: "Auto",
    part: "Auto",
    parameters: JSON.stringify({
      targetPattern: "a_ b_"
    }),
    assumptions: "",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(partCandidatesOnly.ok, true);
  assert.match(partCandidatesOnly.output ?? "", /FormulaTransformPartPlan/);
  assert.match(partCandidatesOnly.output ?? "", /"Rule" -> ""/);
  assert.match(partCandidatesOnly.output ?? "", /"CandidateCount" -> 2/);
  assert.doesNotMatch(partCandidatesOnly.output ?? "", /PlanPreview/);

  const youngAutoPatternApply = await backend.call("formula_transform", {
    action: "apply",
    formula: "F[x y, r]",
    rule: "Young",
    direction: "Upper",
    part: "Auto",
    parameters: JSON.stringify({
      targetPattern: "a_ b_",
      p: 2,
      q: 2
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngAutoPatternApply.ok, true);
  assert.match(youngAutoPatternApply.output ?? "", /FormulaTransform/);
  assert.match(youngAutoPatternApply.output ?? "", /"Selected" -> x\*y/);
  assert.match(youngAutoPatternApply.output ?? "", /"Part" -> "Auto"/);
  assert.match(youngAutoPatternApply.output ?? "", /"PartPath" -> \{1\}/);
  assert.match(youngAutoPatternApply.output ?? "", /"TargetSelectionMode" -> "Pattern"/);
  assert.match(youngAutoPatternApply.output ?? "", /x\*y <=/);

  const youngPatternTargetPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "F[Sin[t], C a b]",
    rule: "Young",
    direction: "Upper",
    part: "Auto",
    parameters: JSON.stringify({
      targetPattern: "C_. a_ b_",
      targetRelation: "C a b <= 1/2 a^2 + K b^2",
      absorbFactor: "a"
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngPatternTargetPlan.ok, true);
  assert.match(youngPatternTargetPlan.output ?? "", /FormulaTransformPlan/);
  assert.match(youngPatternTargetPlan.output ?? "", /"Selected" -> a\*b\*C/);
  assert.match(youngPatternTargetPlan.output ?? "", /"PartPath" -> \{2\}/);
  assert.match(youngPatternTargetPlan.output ?? "", /"TargetSelectionMode" -> "Pattern"/);
  assert.match(youngPatternTargetPlan.output ?? "", /YoungAbsorption/);
  assert.match(youngPatternTargetPlan.output ?? "", /"RegistryMutation" -> False/);

  const youngNoAbsorbedFactorPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "C a b",
    rule: "Young",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      targetRelation: "C a b <= K b^2",
      absorbFactor: "a"
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngNoAbsorbedFactorPlan.ok, true);
  assert.match(youngNoAbsorbedFactorPlan.output ?? "", /"Status" -> "Failure"/);
  assert.match(youngNoAbsorbedFactorPlan.output ?? "", /Inapplicable/);
  assert.match(youngNoAbsorbedFactorPlan.output ?? "", /absorbed quadratic factor/);

  const youngExplicitPartApply = await backend.call("formula_transform", {
    action: "apply",
    formula: "F[C a b, r]",
    rule: "Young",
    direction: "Upper",
    part: "1",
    parameters: JSON.stringify({ p: 2, q: 2 }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngExplicitPartApply.ok, true);
  assert.match(youngExplicitPartApply.output ?? "", /FormulaTransform/);
  assert.match(youngExplicitPartApply.output ?? "", /"Original" -> F\[a\*b\*C, r\]/);
  assert.match(youngExplicitPartApply.output ?? "", /"Selected" -> a\*b\*C/);
  assert.match(youngExplicitPartApply.output ?? "", /"Part" -> "1"/);
  assert.match(youngExplicitPartApply.output ?? "", /"PartPath" -> \{1\}/);

  const youngNamedPartApply = await backend.call("formula_transform", {
    action: "apply",
    formula: "F[C a b, r]",
    rule: "Young",
    direction: "Upper",
    part: "Named:nonlinear",
    parameters: JSON.stringify({
      p: 2,
      q: 2,
      namedParts: {
        nonlinear: "1"
      }
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngNamedPartApply.ok, true);
  assert.match(youngNamedPartApply.output ?? "", /SelectNamedPart/);
  assert.match(youngNamedPartApply.output ?? "", /"NamedPart" -> "nonlinear"/);
  assert.match(youngNamedPartApply.output ?? "", /"PartPath" -> \{1\}/);
  assert.match(youngNamedPartApply.output ?? "", /"Selected" -> a\*b\*C/);

  const ambiguousAutoPartPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "F[C a b, C a b]",
    rule: "Young",
    direction: "Upper",
    part: "Auto",
    parameters: JSON.stringify({
      targetRelation: "C a b <= 1/2 a^2 + K b^2"
    }),
    assumptions: "True",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(ambiguousAutoPartPlan.ok, true);
  assert.match(ambiguousAutoPartPlan.output ?? "", /AmbiguousPart/);
  assert.match(ambiguousAutoPartPlan.output ?? "", /Candidates/);

  const ambiguousAutoPatternPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "F[x y, u v]",
    rule: "Young",
    direction: "Upper",
    part: "Auto",
    parameters: JSON.stringify({
      targetPattern: "a_ b_"
    }),
    assumptions: "True",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(ambiguousAutoPatternPlan.ok, true);
  assert.match(ambiguousAutoPatternPlan.output ?? "", /AmbiguousPart/);
  assert.match(ambiguousAutoPatternPlan.output ?? "", /"TargetSelectionMode" -> "Pattern"/);
  assert.match(ambiguousAutoPatternPlan.output ?? "", /Candidates/);

  const registryAfterPlan = await backend.call("formula_transform", {
    action: "inspect_registry",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(registryAfterPlan.ok, true);
  assert.match(registryAfterPlan.output ?? "", /"RuleCount" -> 4/);

  const weightedHolderPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "Inactive[Integrate][f[x] g[x], {x, 0, 1}]",
    rule: "Holder",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      p: 2,
      q: 2,
      weight: "w[x]",
      objective: "weighted-holder"
    }),
    assumptions: "w[x] > 0",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(weightedHolderPlan.ok, true);
  assert.match(weightedHolderPlan.output ?? "", /FormulaTransformPlan/);
  assert.match(weightedHolderPlan.output ?? "", /"TargetPlanner" -> "WeightedHolder"/);
  assert.match(weightedHolderPlan.output ?? "", /"TargetPlannerPrimitives" -> \{[^}]*InferWeightFromNormPair/);
  assert.match(weightedHolderPlan.output ?? "", /BuildWeightedHolderBound/);
  assert.match(weightedHolderPlan.output ?? "", /TargetPlannerPrimitiveAudit/);
  assert.match(weightedHolderPlan.output ?? "", /"MissingRequired" -> \{\}/);
  assert.match(weightedHolderPlan.output ?? "", /"Primitive" -> "InferWeightFromNormPair", "Status" -> "Executed"/);
  assert.match(weightedHolderPlan.output ?? "", /WeightedHolder/);
  assert.match(weightedHolderPlan.output ?? "", /MultiplyByOneWeight/);
  assert.match(weightedHolderPlan.output ?? "", /"Weight" -> w\[x\]/);
  assert.match(weightedHolderPlan.output ?? "", /"WeightedFirstFactor"/);
  assert.match(weightedHolderPlan.output ?? "", /"WeightedSecondFactor"/);
  assert.match(weightedHolderPlan.output ?? "", /"RegistryMutation" -> False/);
  assert.match(weightedHolderPlan.output ?? "", /WeightPositive/);
  assert.match(weightedHolderPlan.output ?? "", /DischargedByAssumptions/);

  const registryAfterWeightedHolderPlan = await backend.call("formula_transform", {
    action: "inspect_registry",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(registryAfterWeightedHolderPlan.ok, true);
  assert.match(registryAfterWeightedHolderPlan.output ?? "", /"RuleCount" -> 4/);

  const inferredWeightedHolderPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "Inactive[Integrate][f[x] g[x], {x, 0, 1}]",
    rule: "Holder",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      p: 2,
      q: 2,
      targetRelation: "Inactive[Integrate][f[x] g[x], {x, 0, 1}] <= Inactive[Power][Inactive[Integrate][Abs[f[x]*w[x]^(1/2)]^2, {x, 0, 1}], 1/2] * Inactive[Power][Inactive[Integrate][Abs[g[x]*w[x]^(-1/2)]^2, {x, 0, 1}], 1/2]"
    }),
    assumptions: "w[x] > 0",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(inferredWeightedHolderPlan.ok, true);
  assert.match(inferredWeightedHolderPlan.output ?? "", /FormulaTransformPlan/);
  assert.match(inferredWeightedHolderPlan.output ?? "", /WeightedHolder/);
  assert.match(inferredWeightedHolderPlan.output ?? "", /"Weight" -> w\[x\]/);
  assert.match(inferredWeightedHolderPlan.output ?? "", /"WeightInference" -> "(BothNormFactors|SwappedNormFactors)"/);
  assert.match(inferredWeightedHolderPlan.output ?? "", /MultiplyByOneWeight/);
  assert.match(inferredWeightedHolderPlan.output ?? "", /"RegistryMutation" -> False/);
  assert.match(inferredWeightedHolderPlan.output ?? "", /DischargedByAssumptions/);

  const poincareSeedPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "u",
    rule: "Poincare",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      domain: "Omega",
      p: 2,
      constant: "CP"
    }),
    assumptions: "",
    context: "Omega is a bounded Lipschitz domain and u has zero mean",
    state: "",
    payload: ""
  });
  assert.equal(poincareSeedPlan.ok, true);
  assert.match(poincareSeedPlan.output ?? "", /EstimateSeedInstantiated/);
  assert.match(poincareSeedPlan.output ?? "", /"RegistryKind" -> "EstimateSeed"/);
  assert.match(poincareSeedPlan.output ?? "", /PlanEstimateSeed/);
  assert.match(poincareSeedPlan.output ?? "", /BuildEstimateRelation/);
  assert.match(poincareSeedPlan.output ?? "", /Inactive\[Norm\]\[u, "L2", Omega\]/);
  assert.match(poincareSeedPlan.output ?? "", /DomainRegularity/);
  assert.match(poincareSeedPlan.output ?? "", /FunctionSpaceMembership/);
  assert.match(poincareSeedPlan.output ?? "", /NormalizationCondition/);
  assert.match(poincareSeedPlan.output ?? "", /Deferred/);

  const poincareSeedDischargedPlan = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "u",
    rule: "Poincare",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      domain: "Omega",
      p: 2,
      constant: "CP"
    }),
    assumptions: "",
    context: "Omega is a bounded Lipschitz domain; u belongs to W^{1,2}; u is normalized to have zero mean",
    state: "",
    payload: ""
  });
  assert.equal(poincareSeedDischargedPlan.ok, true);
  assert.match(poincareSeedDischargedPlan.output ?? "", /DischargedByFunctionSpaceRegularityDeclaration/);
  assert.match(poincareSeedDischargedPlan.output ?? "", /DischargedByNormalizationDeclaration/);
  assert.match(poincareSeedDischargedPlan.output ?? "", /FunctionSpaceContextDeclaration|DomainRegularityContextDeclaration/);

  const sobolevSeedApply = await backend.call("formula_transform", {
    action: "apply",
    formula: "u",
    rule: "Sobolev",
    direction: "Auto",
    part: "Whole",
    parameters: JSON.stringify({
      domain: "Omega",
      p: 2,
      q: 6,
      constant: "CS"
    }),
    assumptions: "",
    context: "Omega supports the requested Sobolev embedding and u belongs to W^{1,2}",
    state: "",
    payload: ""
  });
  assert.equal(sobolevSeedApply.ok, true);
  assert.match(sobolevSeedApply.output ?? "", /EstimateSeedInstantiated/);
  assert.match(sobolevSeedApply.output ?? "", /"Rule" -> "Sobolev"/);
  assert.match(sobolevSeedApply.output ?? "", /PlanEstimateSeed/);
  assert.match(sobolevSeedApply.output ?? "", /BuildEstimateRelation/);
  assert.match(sobolevSeedApply.output ?? "", /Inactive\[Norm\]\[u, "L6", Omega\]/);
  assert.match(sobolevSeedApply.output ?? "", /ExponentRange/);
  assert.match(sobolevSeedApply.output ?? "", /FunctionSpaceMembership/);

  const compiledFormulaRule = await backend.call("formula_transform", {
    action: "compile_rule",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "TestYoungLike",
      family: "Young",
      matchers: ["Product[a,b]"],
      orientations: ["Upper"],
      conditions: ["RealValued[a]", "RealValued[b]", "BoundaryTrace[a,Omega]", "ZeroMean[a,Omega]"]
    })
  });
  assert.equal(compiledFormulaRule.ok, true);
  assert.match(compiledFormulaRule.output ?? "", /"Status" -> "Compiled"/);
  assert.match(compiledFormulaRule.output ?? "", /TestYoungLike/);

  const invalidFormulaRule = await backend.call("formula_transform", {
    action: "compile_rule",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "BadFormulaRule",
      matchers: ["UnknownPrimitive[x]"],
      orientations: ["Upper"]
    })
  });
  assert.equal(invalidFormulaRule.ok, true);
  assert.match(invalidFormulaRule.output ?? "", /"Status" -> "Failure"/);
  assert.match(invalidFormulaRule.output ?? "", /InvalidRuleJSON/);
  assert.match(invalidFormulaRule.output ?? "", /unknown compiler primitives/i);

  const unboundSlotFormulaRule = await backend.call("formula_transform", {
    action: "compile_rule",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "UnboundSlotFormulaRule",
      matchers: [
        {
          name: "PointwiseProduct",
          body: { kind: "Product", slots: ["a", "b"] }
        }
      ],
      orientations: [
        {
          name: "BadUpper",
          direction: "Upper",
          relation: "LessEqual",
          lhs: "$selected",
          rhs: "$missing"
        }
      ]
    })
  });
  assert.equal(unboundSlotFormulaRule.ok, true);
  assert.match(unboundSlotFormulaRule.output ?? "", /InvalidRuleJSON/);
  assert.match(unboundSlotFormulaRule.output ?? "", /unbound template slots/i);

  const badOrientationFormulaRule = await backend.call("formula_transform", {
    action: "compile_rule",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "BadOrientationFormulaRule",
      matchers: [
        {
          name: "PointwiseProduct",
          body: { kind: "Product", slots: ["a", "b"] }
        }
      ],
      orientations: [
        {
          name: "BadChain",
          direction: "TwoSided",
          relation: "LessEqualChain",
          terms: ["$a", "$selected"]
        }
      ]
    })
  });
  assert.equal(badOrientationFormulaRule.ok, true);
  assert.match(badOrientationFormulaRule.output ?? "", /InvalidRuleJSON/);
  assert.match(badOrientationFormulaRule.output ?? "", /LessEqualChain requires at least three terms/i);

  const injectionFormulaRule = await backend.call("formula_transform", {
    action: "compile_rule",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "InjectedFormulaRule",
      matchers: ["Product[a,b]"],
      orientations: ["Upper"],
      conditions: ["ToExpression[\"1+1\"]"]
    })
  });
  assert.equal(injectionFormulaRule.ok, true);
  assert.match(injectionFormulaRule.output ?? "", /InvalidRuleJSON/);
  assert.match(injectionFormulaRule.output ?? "", /forbidden executable constructs/i);

  const compiledEstimateSeed = await backend.call("formula_transform", {
    action: "compile_seed",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "TestPoincareSeed",
      kind: "EstimateSeed",
      appliesTo: ["FunctionNormEstimate"],
      parameterDefaults: { domain: "Omega", p: 2, constant: "CP" },
      parameterExpressions: ["domain", "constant"],
      template: {
        relation: "Norm[$selected,Lp[$p,$domain]] <= $constant * Norm[Grad[$selected],Lp[$p,$domain]]"
      },
      conditions: [
        { kind: "DomainRegularity", expr: "domain is bounded Lipschitz: $domain", machineCheckable: false }
      ]
    })
  });
  assert.equal(compiledEstimateSeed.ok, true);
  assert.match(compiledEstimateSeed.output ?? "", /"Status" -> "Compiled"/);
  assert.match(compiledEstimateSeed.output ?? "", /FormulaEstimateSeed/);
  assert.match(compiledEstimateSeed.output ?? "", /TestPoincareSeed/);

  const invalidEstimateSeed = await backend.call("formula_transform", {
    action: "compile_seed",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "BadEstimateSeed",
      template: {
        relation: "UnknownPrimitive[$selected]"
      }
    })
  });
  assert.equal(invalidEstimateSeed.ok, true);
  assert.match(invalidEstimateSeed.output ?? "", /InvalidRuleJSON/);
  assert.match(invalidEstimateSeed.output ?? "", /unknown compiler primitives/i);

  const compiledTargetPlanner = await backend.call("formula_transform", {
    action: "compile_planner",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "TestYoungPlanner",
      kind: "TargetPlanner",
      rules: ["Young"],
      families: ["pointwise-product-inequality"],
      objective: "absorption-target",
      runtime: "YoungAbsorption",
      primitives: [
        "ParseTargetRelation",
        "MatchTargetLHS",
        "ExtractProductFactors",
        "InferAbsorbedQuadraticFactor",
        "InferResidualFactor",
        "ComputeProductCoefficient",
        "BuildResidualCoefficientCondition"
      ],
      registryMutation: false
    })
  });
  assert.equal(compiledTargetPlanner.ok, true);
  assert.match(compiledTargetPlanner.output ?? "", /"Status" -> "Compiled"/);
  assert.match(compiledTargetPlanner.output ?? "", /FormulaTargetPlanner/);
  assert.match(compiledTargetPlanner.output ?? "", /TestYoungPlanner/);

  const compiledDischarger = await backend.call("formula_transform", {
    action: "compile_discharger",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "TestLifecycleDischarger",
      kind: "ObligationDischarger",
      matchesObligation: ["LifecycleTestObligation"],
      evidence: [
        {
          label: "LifecycleEvidence",
          source: "context",
          obligationKinds: ["LifecycleTestObligation"],
          containsAny: ["lifecycle test evidence"]
        }
      ]
    })
  });
  assert.equal(compiledDischarger.ok, true);
  assert.match(compiledDischarger.output ?? "", /"Status" -> "Compiled"/);
  assert.match(compiledDischarger.output ?? "", /FormulaObligationDischarger/);
  assert.match(compiledDischarger.output ?? "", /TestLifecycleDischarger/);

  const dynamicPlannerSelection = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "C a b",
    rule: "Young",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      targetRelation: "C a b <= 1/2 a^2 + K b^2",
      absorbFactor: "a"
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(dynamicPlannerSelection.ok, true);
  assert.match(dynamicPlannerSelection.output ?? "", /"TargetPlanner" -> "TestYoungPlanner"/);
  assert.match(dynamicPlannerSelection.output ?? "", /"TargetPlannerRuntime" -> "YoungAbsorption"/);

  const invalidTargetPlanner = await backend.call("formula_transform", {
    action: "compile_planner",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "BadTargetPlanner",
      rules: ["Young"],
      runtime: "ArbitraryRuntime"
    })
  });
  assert.equal(invalidTargetPlanner.ok, true);
  assert.match(invalidTargetPlanner.output ?? "", /InvalidRuleJSON/);
  assert.match(invalidTargetPlanner.output ?? "", /runtime must be one of/i);

  const invalidTargetPlannerPrimitive = await backend.call("formula_transform", {
    action: "compile_planner",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "BadTargetPlannerPrimitive",
      rules: ["Young"],
      runtime: "YoungAbsorption",
      primitives: ["RunArbitraryCode"]
    })
  });
  assert.equal(invalidTargetPlannerPrimitive.ok, true);
  assert.match(invalidTargetPlannerPrimitive.output ?? "", /InvalidRuleJSON/);
  assert.match(invalidTargetPlannerPrimitive.output ?? "", /unsupported planner primitives/i);

  const incompleteTargetPlanner = await backend.call("formula_transform", {
    action: "compile_planner",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "IncompleteYoungPlanner",
      rules: ["Young"],
      runtime: "YoungAbsorption",
      primitives: ["ParseTargetRelation", "MatchTargetLHS"]
    })
  });
  assert.equal(incompleteTargetPlanner.ok, true);
  assert.match(incompleteTargetPlanner.output ?? "", /"Status" -> "Compiled"/);

  const incompletePlannerFailure = await backend.call("formula_transform", {
    action: "plan_apply",
    formula: "C a b",
    rule: "Young",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      targetRelation: "C a b <= 1/2 a^2 + K b^2",
      absorbFactor: "a"
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(incompletePlannerFailure.ok, true);
  assert.match(incompletePlannerFailure.output ?? "", /CompilerPrimitiveMissing/);
  assert.match(incompletePlannerFailure.output ?? "", /missing required planner primitives/i);
  assert.match(incompletePlannerFailure.output ?? "", /InferAbsorbedQuadraticFactor/);

  const restoredTargetPlanner = await backend.call("formula_transform", {
    action: "compile_planner",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "RestoredYoungPlanner",
      rules: ["Young"],
      runtime: "YoungAbsorption",
      primitives: [
        "ParseTargetRelation",
        "MatchTargetLHS",
        "ExtractProductFactors",
        "InferAbsorbedQuadraticFactor",
        "InferResidualFactor",
        "ComputeProductCoefficient",
        "BuildResidualCoefficientCondition"
      ]
    })
  });
  assert.equal(restoredTargetPlanner.ok, true);
  assert.match(restoredTargetPlanner.output ?? "", /"Status" -> "Compiled"/);

  const compiledStructuralTransform = await backend.call("formula_transform", {
    action: "compile_structural",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "TestStructuralDerivative",
      kind: "StructuralTransform",
      runtime: "GenericStructural",
      matchers: [
        {
          name: "PointwiseDerivativeProduct",
          operator: "PointwiseDerivative",
          body: { kind: "DerivativeProduct", slots: ["f", "g"] },
          varSlot: "var"
        }
      ],
      orientations: [
        {
          name: "ExpandProductDerivative",
          direction: "Equal",
          relation: "Equal",
          lhs: "$selected",
          rhs: "D[$f,$var] * $g + $f * D[$g,$var]"
        }
      ]
    })
  });
  assert.equal(compiledStructuralTransform.ok, true);
  assert.match(compiledStructuralTransform.output ?? "", /"Status" -> "Compiled"/);
  assert.match(compiledStructuralTransform.output ?? "", /FormulaStructuralTransform/);
  assert.match(compiledStructuralTransform.output ?? "", /TestStructuralDerivative/);

  const invalidStructuralTransform = await backend.call("formula_transform", {
    action: "compile_structural",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "BadStructuralTransform",
      runtime: "GenericStructural",
      orientations: [{ name: "Bad", relation: "Equal", lhs: "$selected", rhs: "Import[\"x\"]" }]
    })
  });
  assert.equal(invalidStructuralTransform.ok, true);
  assert.match(invalidStructuralTransform.output ?? "", /InvalidRuleJSON/);
  assert.match(invalidStructuralTransform.output ?? "", /forbidden executable constructs/i);

  const mismatchedStructuralTransform = await backend.call("formula_transform", {
    action: "compile_structural",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "",
    payload: JSON.stringify({
      name: "BadStructuralRelation",
      kind: "StructuralTransform",
      runtime: "GenericStructural",
      matchers: [
        {
          name: "WholeExpression",
          body: { kind: "Whole", slots: [] }
        }
      ],
      orientations: [
        {
          name: "BadInequality",
          direction: "Equal",
          relation: "LessEqual",
          lhs: "$selected",
          rhs: "$selected"
        }
      ]
    })
  });
  assert.equal(mismatchedStructuralTransform.ok, true);
  assert.match(mismatchedStructuralTransform.output ?? "", /InvalidRuleJSON/);
  assert.match(mismatchedStructuralTransform.output ?? "", /direction=Equal with non-equality relation/i);

  const youngUpper = await backend.call("formula_transform", {
    action: "apply",
    formula: "a b",
    rule: "Young",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({ p: 2, q: 2 }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngUpper.ok, true);
  assert.match(youngUpper.output ?? "", /"Status" -> "Success"/);
  assert.match(youngUpper.output ?? "", /"Rule" -> "Young"/);
  assert.match(youngUpper.output ?? "", /"Runtime" -> "GenericTemplate"/);
  assert.match(youngUpper.output ?? "", /ApplyGenericTemplateRule/);
  assert.match(youngUpper.output ?? "", /BuildRelationFromJSON/);
  assert.match(youngUpper.output ?? "", /"Direction" -> "Upper"/);
  assert.match(youngUpper.output ?? "", /a\*b <=/);
  assert.match(youngUpper.output ?? "", /DischargedByRealValuedDeclaration/);
  const youngUpperJson = youngUpper.json as Record<string, any>;
  assert.ok(youngUpperJson.Conditions.Discovered.some((condition: any) => condition.Predicate === "RealValued"));

  const youngTargetApply = await backend.call("formula_transform", {
    action: "apply",
    formula: "C a b",
    rule: "Young",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      targetRelation: "C a b <= 1/2 a^2 + K b^2",
      absorbFactor: "a",
      objective: "synthesize-parameters"
    }),
    assumptions: "K >= C^2/2",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngTargetApply.ok, true);
  assert.match(youngTargetApply.output ?? "", /"Status" -> "Success"/);
  assert.match(youngTargetApply.output ?? "", /"Plan"/);
  assert.match(youngTargetApply.output ?? "", /TargetGuided" -> True/);
  assert.match(youngTargetApply.output ?? "", /a\*b\*C <= a\^2\/2 \+ b\^2\*K/);
  assert.match(youngTargetApply.output ?? "", /YoungResidualCoefficient/);
  assert.match(youngTargetApply.output ?? "", /DischargedByAssumptions/);

  const youngLower = await backend.call("formula_transform", {
    action: "apply",
    formula: "a b",
    rule: "Young",
    direction: "Lower",
    part: "Whole",
    parameters: JSON.stringify({ p: 2, q: 2 }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngLower.ok, true);
  assert.match(youngLower.output ?? "", /"Direction" -> "Lower"/);
  assert.match(youngLower.output ?? "", /<= a\*b/);

  const youngTwoSided = await backend.call("formula_transform", {
    action: "apply",
    formula: "a b",
    rule: "Young",
    direction: "TwoSided",
    part: "Whole",
    parameters: JSON.stringify({ p: 2, q: 2 }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngTwoSided.ok, true);
  assert.match(youngTwoSided.output ?? "", /"Direction" -> "TwoSided"/);
  assert.match(youngTwoSided.output ?? "", /<= a\*b <=/);

  const youngContradiction = await backend.call("formula_transform", {
    action: "apply",
    formula: "a b",
    rule: "Young",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({ p: 1, q: 2 }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(youngContradiction.ok, true);
  assert.match(youngContradiction.output ?? "", /"Status" -> "Failure"/);
  assert.match(youngContradiction.output ?? "", /AssumptionContradiction/);

  const cauchyUpper = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[Integrate][f[x] g[x], {x, 0, 1}]",
    rule: "CauchySchwarz",
    direction: "Upper",
    part: "Whole",
    parameters: "",
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(cauchyUpper.ok, true);
  assert.match(cauchyUpper.output ?? "", /CauchySchwarz/);
  assert.match(cauchyUpper.output ?? "", /"Runtime" -> "GenericTemplate"/);
  assert.match(cauchyUpper.output ?? "", /ApplyGenericTemplateRule/);
  assert.match(cauchyUpper.output ?? "", /BuildRelationFromJSON/);
  assert.match(cauchyUpper.output ?? "", /Inactive\[Power\]/);
  assert.match(cauchyUpper.output ?? "", /FunctionSpaceMembership/);
  assert.match(cauchyUpper.output ?? "", /Deferred/);

  const weightedHolderApply = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[Integrate][f[x] g[x], {x, 0, 1}]",
    rule: "Holder",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      p: 2,
      q: 2,
      weight: "w[x]",
      objective: "weighted-holder"
    }),
    assumptions: "w[x] > 0",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(weightedHolderApply.ok, true);
  assert.match(weightedHolderApply.output ?? "", /"Status" -> "Success"/);
  assert.match(weightedHolderApply.output ?? "", /"Plan"/);
  assert.match(weightedHolderApply.output ?? "", /WeightedHolder/);
  assert.match(weightedHolderApply.output ?? "", /MultiplyByOneWeight/);
  assert.doesNotMatch(weightedHolderApply.output ?? "", /ApplyGenericTemplateRule/);
  assert.match(weightedHolderApply.output ?? "", /Inactive\[Power\]/);
  assert.match(weightedHolderApply.output ?? "", /WeightPositive/);

  const inferredWeightedHolderApply = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[Integrate][f[x] g[x], {x, 0, 1}]",
    rule: "Holder",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      p: 2,
      q: 2,
      targetRelation: "Inactive[Integrate][f[x] g[x], {x, 0, 1}] <= Inactive[Power][Inactive[Integrate][Abs[f[x]*w[x]^(1/2)]^2, {x, 0, 1}], 1/2] * Inactive[Power][Inactive[Integrate][Abs[g[x]*w[x]^(-1/2)]^2, {x, 0, 1}], 1/2]"
    }),
    assumptions: "w[x] > 0",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(inferredWeightedHolderApply.ok, true);
  assert.match(inferredWeightedHolderApply.output ?? "", /"Status" -> "Success"/);
  assert.match(inferredWeightedHolderApply.output ?? "", /"Plan"/);
  assert.match(inferredWeightedHolderApply.output ?? "", /"WeightInference" -> "(BothNormFactors|SwappedNormFactors)"/);
  assert.match(inferredWeightedHolderApply.output ?? "", /"Weight" -> w\[x\]/);
  assert.match(inferredWeightedHolderApply.output ?? "", /MultiplyByOneWeight/);

  const holderAuto = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[Integrate][h[x], {x, 0, 1}]",
    rule: "Holder",
    direction: "Auto",
    part: "Whole",
    parameters: JSON.stringify({ p: 2, q: 2 }),
    assumptions: "h[x] >= 0",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(holderAuto.ok, true);
  assert.match(holderAuto.output ?? "", /SplitSqrt/);
  assert.match(holderAuto.output ?? "", /"Runtime" -> "JSONHeuristic"/);
  assert.match(holderAuto.output ?? "", /"Rewritten" -> Inactive\[Integrate\]\[Inactive\[Times\]\[Sqrt\[h\[x\]\], Sqrt\[h\[x\]\]\], \{x, 0, 1\}\]/);
  assert.match(holderAuto.output ?? "", /MatchRule/);
  assert.doesNotMatch(holderAuto.output ?? "", /ApplyGenericTemplateRule/);
  assert.match(holderAuto.output ?? "", /HeuristicSearch/);
  assert.match(holderAuto.output ?? "", /SearchTree/);
  assert.match(holderAuto.output ?? "", /GoalMatched/);
  assert.match(holderAuto.output ?? "", /Nonnegativity/);
  assert.match(holderAuto.output ?? "", /DischargedByAssumptions/);
  const holderAutoJson = holderAuto.json as Record<string, any>;
  assert.ok(holderAutoJson.Conditions.Discovered.some((condition: any) => condition.Predicate === "Nonnegative"));
  assert.ok(holderAutoJson.Conditions.Discovered.some((condition: any) => condition.Predicate === "FunctionSpace"));
  assert.ok(holderAutoJson.Conditions.Discovered.some((condition: any) => condition.Predicate === "MeasurableIntegrable"));

  const holderMultiplyByOneSearch = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[Integrate][h[x], {x, 0, 1}]",
    rule: "Holder",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      p: 2,
      q: 2,
      allowedHeuristics: ["MultiplyByOne"],
      maxSearchDepth: 1
    }),
    assumptions: "True",
    context: "selected expression is real-valued",
    state: "",
    payload: ""
  });
  assert.equal(holderMultiplyByOneSearch.ok, true);
  assert.match(holderMultiplyByOneSearch.output ?? "", /MultiplyByOne/);
  assert.match(holderMultiplyByOneSearch.output ?? "", /"Runtime" -> "JSONHeuristic"/);
  assert.match(holderMultiplyByOneSearch.output ?? "", /"HeuristicDepth" -> 1/);
  assert.match(holderMultiplyByOneSearch.output ?? "", /Inactive\[Times\]\[h\[x\], 1\]/);
  assert.doesNotMatch(holderMultiplyByOneSearch.output ?? "", /SplitSqrt/);

  const holderNoSearch = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[Integrate][h[x], {x, 0, 1}]",
    rule: "Holder",
    direction: "Upper",
    part: "Whole",
    parameters: JSON.stringify({
      p: 2,
      q: 2,
      maxSearchDepth: 0
    }),
    assumptions: "True",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(holderNoSearch.ok, true);
  assert.match(holderNoSearch.output ?? "", /"Status" -> "Failure"/);
  assert.match(holderNoSearch.output ?? "", /Inapplicable/);
  assert.match(holderNoSearch.output ?? "", /"MaxDepth" -> 0/);
  assert.match(holderNoSearch.output ?? "", /"VisitedCount" -> 1/);

  const integrationByPartsTransform = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[Integrate][Derivative[1][u][x] v[x], {x, a, b}]",
    rule: "IntegrationByParts",
    direction: "Equal",
    part: "Whole",
    parameters: "",
    assumptions: "True",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(integrationByPartsTransform.ok, true);
  assert.match(integrationByPartsTransform.output ?? "", /IntegrationByParts/);
  assert.match(integrationByPartsTransform.output ?? "", /"Runtime" -> "GenericTemplate"/);
  assert.match(integrationByPartsTransform.output ?? "", /ApplyGenericTemplateRule/);
  assert.match(integrationByPartsTransform.output ?? "", /BuildRelationFromJSON/);
  assert.match(integrationByPartsTransform.output ?? "", /Equal/);
  assert.match(integrationByPartsTransform.output ?? "", /BoundaryCondition/);
  const integrationByPartsJson = integrationByPartsTransform.json as Record<string, any>;
  assert.ok(integrationByPartsJson.Conditions.Discovered.some((condition: any) => condition.Predicate === "BoundaryCondition"));
  assert.ok(integrationByPartsJson.Conditions.Discovered.some((condition: any) => condition.Predicate === "FunctionSpace"));
  assert.ok(integrationByPartsJson.Conditions.Discovered.some((condition: any) => condition.Predicate === "MeasurableIntegrable"));

  const integrationByPartsAuto = await backend.call("formula_transform", {
    action: "apply",
    formula: "Inactive[Integrate][Derivative[1][u][x] v[x], {x, a, b}]",
    rule: "IntegrationByParts",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "True",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(integrationByPartsAuto.ok, true);
  assert.match(integrationByPartsAuto.output ?? "", /"Runtime" -> "GenericTemplate"/);
  assert.match(integrationByPartsAuto.output ?? "", /"Direction" -> "Equal"/);
  assert.match(integrationByPartsAuto.output ?? "", /-\(u\[a\]\*v\[a\]\) \+ u\[b\]\*v\[b\]/);

  const formulaObligations = await backend.call("formula_transform", {
    action: "get_obligations",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "",
    state: "<|\"Head\" -> \"FormulaTransformState\", \"Obligations\" -> {<|\"Id\" -> \"o1\", \"Kind\" -> \"FunctionSpaceMembership\"|>}, \"Trace\" -> {}|>",
    payload: ""
  });
  assert.equal(formulaObligations.ok, true);
  assert.match(formulaObligations.output ?? "", /FormulaTransformObligations/);
  assert.match(formulaObligations.output ?? "", /"Count" -> 1/);

  const boundaryDischarge = await backend.call("formula_transform", {
    action: "discharge_obligation",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: JSON.stringify({ obligationId: "b1" }),
    assumptions: "",
    context: "u has compact support, so boundary term vanishes",
    state: "<|\"Head\" -> \"FormulaTransformState\", \"Obligations\" -> {<|\"Id\" -> \"b1\", \"Kind\" -> \"BoundaryCondition\", \"Expr\" -> \"boundary term is retained unless context proves it vanishes\", \"MachineCheckable\" -> False, \"Status\" -> \"Deferred\"|>, <|\"Id\" -> \"f1\", \"Kind\" -> \"FunctionSpaceMembership\", \"Expr\" -> \"u has enough regularity\", \"MachineCheckable\" -> False, \"Status\" -> \"Deferred\"|>}, \"Trace\" -> {}|>",
    payload: ""
  });
  assert.equal(boundaryDischarge.ok, true);
  assert.match(boundaryDischarge.output ?? "", /FormulaTransformObligationDischarge/);
  assert.match(boundaryDischarge.output ?? "", /BoundaryVanishes/);
  assert.match(boundaryDischarge.output ?? "", /DischargedByBoundaryVanishes/);
  assert.match(boundaryDischarge.output ?? "", /"Evidence" -> <\|/);
  assert.match(boundaryDischarge.output ?? "", /BoundaryTermVanishesInContext/);
  assert.match(boundaryDischarge.output ?? "", /"RemainingObligations" -> \{<\|"Id" -> "f1"/);
  assert.doesNotMatch(boundaryDischarge.output ?? "", /"RemainingObligations" -> \{<\|"Id" -> "b1"/);

  const realValuedDischarge = await backend.call("formula_transform", {
    action: "discharge_obligation",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "selected expression is real-valued",
    state: "<|\"Head\" -> \"FormulaTransformState\", \"Obligations\" -> {<|\"Id\" -> \"r1\", \"Kind\" -> \"RealValued\", \"Expr\" -> \"selected expression is real-valued\", \"MachineCheckable\" -> False, \"Status\" -> \"Deferred\"|>}, \"Trace\" -> {}|>",
    payload: ""
  });
  assert.equal(realValuedDischarge.ok, true);
  assert.match(realValuedDischarge.output ?? "", /DischargedByAssumptions|AssumedFromContext|RealValuedDeclaration/);
  assert.match(realValuedDischarge.output ?? "", /"RemainingObligations" -> \{\}/);

  const realValuedRegisteredDischarge = await backend.call("formula_transform", {
    action: "discharge_obligation",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "all selected quantities are real functions",
    state: "<|\"Head\" -> \"FormulaTransformState\", \"Obligations\" -> {<|\"Id\" -> \"r2\", \"Kind\" -> \"RealValued\", \"Expr\" -> \"selected expression is real-valued\", \"MachineCheckable\" -> False, \"Status\" -> \"Deferred\"|>}, \"Trace\" -> {}|>",
    payload: ""
  });
  assert.equal(realValuedRegisteredDischarge.ok, true);
  assert.match(realValuedRegisteredDischarge.output ?? "", /DischargedByRealValuedDeclaration/);
  assert.match(realValuedRegisteredDischarge.output ?? "", /RealValuedContextDeclaration/);
  assert.match(realValuedRegisteredDischarge.output ?? "", /"RemainingObligations" -> \{\}/);

  const normalizationDischarge = await backend.call("formula_transform", {
    action: "discharge_obligation",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "u is normalized to have zero mean on Omega",
    state: "<|\"Head\" -> \"FormulaTransformState\", \"Obligations\" -> {<|\"Id\" -> \"n1\", \"Kind\" -> \"NormalizationCondition\", \"Expr\" -> \"selected function has zero trace or zero mean on Omega\", \"MachineCheckable\" -> False, \"Status\" -> \"Deferred\"|>}, \"Trace\" -> {}|>",
    payload: ""
  });
  assert.equal(normalizationDischarge.ok, true);
  assert.match(normalizationDischarge.output ?? "", /DischargedByNormalizationDeclaration/);
  assert.match(normalizationDischarge.output ?? "", /ZeroMeanNormalization/);
  assert.match(normalizationDischarge.output ?? "", /"RemainingObligations" -> \{\}/);

  const functionSpaceRegularityDischarge = await backend.call("formula_transform", {
    action: "discharge_obligation",
    formula: "",
    rule: "",
    direction: "Auto",
    part: "Whole",
    parameters: "",
    assumptions: "",
    context: "u belongs to W^{1,2}; v is sufficiently smooth; all products are measurable and integrable",
    state: "<|\"Head\" -> \"FormulaTransformState\", \"Obligations\" -> {<|\"Id\" -> \"fs1\", \"Kind\" -> \"FunctionSpaceMembership\", \"Expr\" -> \"u has enough regularity\", \"MachineCheckable\" -> False, \"Status\" -> \"Deferred\"|>, <|\"Id\" -> \"rg1\", \"Kind\" -> \"Regularity\", \"Expr\" -> \"selected expression has enough differentiability/regularity for structural equality\", \"MachineCheckable\" -> False, \"Status\" -> \"Deferred\"|>, <|\"Id\" -> \"mi1\", \"Kind\" -> \"MeasurabilityIntegrability\", \"Expr\" -> \"products are measurable and integrable\", \"MachineCheckable\" -> False, \"Status\" -> \"Deferred\"|>}, \"Trace\" -> {}|>",
    payload: ""
  });
  assert.equal(functionSpaceRegularityDischarge.ok, true);
  assert.match(functionSpaceRegularityDischarge.output ?? "", /DischargedByFunctionSpaceRegularityDeclaration/);
  assert.match(functionSpaceRegularityDischarge.output ?? "", /FunctionSpaceContextDeclaration/);
  assert.match(functionSpaceRegularityDischarge.output ?? "", /RegularityContextDeclaration/);
  assert.match(functionSpaceRegularityDischarge.output ?? "", /MeasurableIntegrableContextDeclaration/);
  assert.match(functionSpaceRegularityDischarge.output ?? "", /"RemainingObligations" -> \{\}/);

  const formulaBadPart = await backend.call("formula_transform", {
    action: "apply",
    formula: "a b",
    rule: "Young",
    direction: "Upper",
    part: "not-a-path",
    parameters: JSON.stringify({ p: 2, q: 2 }),
    assumptions: "True",
    context: "",
    state: "",
    payload: ""
  });
  assert.equal(formulaBadPart.ok, true);
  assert.match(formulaBadPart.output ?? "", /AmbiguousPart/);

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
