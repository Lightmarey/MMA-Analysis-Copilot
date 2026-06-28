BeginPackage["FormulaTransformEngine`"];

ApplyFormulaTransform::usage = "ApplyFormulaTransform[rule, opts][expr] deterministically transforms a held formula and returns a relation, trace, conditions, obligations, and state.";
PlanFormulaTransform::usage = "PlanFormulaTransform[rule, opts][expr] builds a target-guided one-shot transform plan without mutating the JSON rule registry.";
PlanFormulaTransformParts::usage = "PlanFormulaTransformParts[rule, opts][expr] returns target-guided candidate part selections and optional per-candidate transform previews without mutating the registry.";
CompileFormulaTransformRule::usage = "CompileFormulaTransformRule[json] validates and compiles a restricted formula-transform rule JSON association.";
CompileFormulaHeuristicRule::usage = "CompileFormulaHeuristicRule[json] validates and compiles a restricted formula-transform heuristic JSON association.";
CompileFormulaStructuralTransform::usage = "CompileFormulaStructuralTransform[json] validates and compiles a restricted structural-transform JSON association.";
CompileFormulaTargetPlanner::usage = "CompileFormulaTargetPlanner[json] validates and compiles a restricted target-planner descriptor JSON association.";
CompileFormulaObligationDischarger::usage = "CompileFormulaObligationDischarger[json] validates and compiles a restricted obligation-discharger JSON association.";
InspectFormulaTransformRegistry::usage = "InspectFormulaTransformRegistry[] summarizes compiled transform rules and heuristics.";
ReloadFormulaTransformRegistry::usage = "ReloadFormulaTransformRegistry[] reloads FormulaTransformEngine JSON registry files into the current Wolfram kernel.";
GetFormulaTransformObligations::usage = "GetFormulaTransformObligations[state] returns deferred formula-transform proof obligations.";
FormulaTransformHandleRequest::usage = "FormulaTransformHandleRequest[args] handles formula_transform tool requests.";
FTMatchAlgebraicStructure::usage = "FTMatchAlgebraicStructure[expr, template] matches an expression against a template string.";
FTSolveParameters::usage = "FTSolveParameters[bindings, unknowns, eqns] solves for unknown parameters using the given equations.";

Begin["`Private`"];

ClearAll[
  $FTPackageDirectory, $FTRuleRegistry, $FTHeuristicRegistry, $FTEstimateSeedRegistry, $FTStructuralRegistry, $FTDischargerRegistry, $FTTargetPlannerRegistry,
  FTReadString, FTParsePayload, FTParseHeldFormula, FTParseAssumptions,
  FTParseState, FTNow, FTFailure, FTSuccess, FTCondition, FTConditionId, FTConditionStructure, FTConditionPredicate,
  FTConditionDischargeStrategy, FTMachineConditionDischargedQ, FTMachineConditionContradictedQ,
  FTRealValuedCondition, FTFunctionSpaceCondition, FTMeasurableCondition, FTMeasurableIntegrableCondition,
  FTBoundaryCondition, FTRegularityCondition,
  FTAppendTrace, FTLoadBuiltInRegistry, FTLoadDataFiles, FTImportJSON,
  FTValidateName, FTValidateStringList, FTValidateTemplates, FTTemplateSlotRefs, FTDeclaredTemplateSlots, FTValidateTemplateSlots,
  FTValidateOrientations, FTCompileRule,
  FTCompileHeuristic, FTCompileEstimateSeed, FTCompileStructuralTransform, FTCompileTargetPlanner, FTCompileObligationDischarger,
  CompileFormulaTransformRule, CompileFormulaHeuristicRule, CompileFormulaStructuralTransform, CompileFormulaTargetPlanner,
  CompileFormulaObligationDischarger,
  FTResolveRule, FTResolveTransform, FTMergeRule, InspectFormulaTransformRegistry, ReloadFormulaTransformRegistry,
  ApplyFormulaTransform, PlanFormulaTransform, PlanFormulaTransformParts, FormulaTransformHandleRequest,
  FTApplyRule, FTApplyHolderLike, FTApplyYoung,
  FTIntegralQ, FTSumQ, FTIntegralParts, FTSumParts, FTProductFactors,
  FTLpBound, FTBuildOrientedRelation, FTBuildConditions,
  FTParseMaybeExpression, FTPlanRule, FTPlanYoungTarget, FTPlanYoungGeneric,
  FTPlanHolderTarget, FTPlanHolderGeneric, FTWeightedHolderBound,
  FTTargetPlannerMatchesQ, FTFindTargetPlanner, FTPlannerPrimitiveAudit, FTRequirePlannerPrimitives,
  FTWeightedHolderParseIntegralOrSumProduct, FTWeightedHolderParseWeightParameter,
  FTWeightedHolderInferWeight, FTWeightedHolderBuildBound, FTWeightedHolderBuildConditions,
  FTNormPowerParts, FTInferHolderWeightFromNormPair, FTInferHolderWeightFromTarget,
  FTPlanEstimateSeed, FTEstimateSeedCondition, FTEstimateSeedTextTemplate,
  FTPlanStructuralTransform,
  FTTargetText, FTTerms, FTExpressionFactors, FTQuadraticCoefficient, FTProductCoefficient,
  FTYoungParseTargetRelation, FTYoungMatchTargetLHS, FTYoungExtractProductFactors,
  FTYoungInferAbsorbedQuadraticFactor, FTYoungInferResidualFactor,
  FTYoungComputeProductCoefficient, FTYoungBuildResidualCoefficientCondition,
  FTSelectPart, FTPlanPartCandidates, FTParsePartPath, FTNamedPartPath, FTTargetPatternText, FTTargetRelationText,
  FTTargetSelectionSpec, FTExpressionMatchesSelectionQ, FTEquivalentExpressionQ,
  FTApplyGenericTemplateRule, FTPlanGenericTemplateRule, FTGenericMatcherBindings,
  FTPrepareParameterExpressionBindings, FTApplyGenericStructuralTransform,
  FTEvaluateTemplate, FTPrimitiveEvaluate, FTPrimitiveHeadQ, FTCompiledCondition,
  FTIBPBoundaryTerm, FTIBPInteriorIntegral,
  FTHeuristicMatcherBindings, FTApplyHeuristicRewrite, FTApplyCompatibleHeuristic,
  FTHeuristicSearch, FTHeuristicNames, FTHeuristicGoalQ,
  FTDischargeConditions, FTConditionDischargedByTextQ, FTAddObligations,
  FTDischargeObligation, FTDischargerAppliesQ, FTCompileDischargerEvidenceRules,
  FTDischargerEvidenceMatch, FTDischargerEvidenceRuleMatchQ,
  FTUpdateStateAfterDischarge, GetFormulaTransformObligations,
  FTReadAction, FTReadAssociationField
];

$FTPackageDirectory = FileNameJoin[{DirectoryName[$InputFileName], "FormulaTransformEngine"}];
$FTRuleRegistry = <||>;
$FTHeuristicRegistry = <||>;
$FTEstimateSeedRegistry = <||>;
$FTStructuralRegistry = <||>;
$FTDischargerRegistry = <||>;
$FTTargetPlannerRegistry = <||>;

SetAttributes[ApplyFormulaTransform, HoldAll];
If[MemberQ[Names["System`*"], "SubValuesHoldAll"],
  Quiet@Check[SetAttributes[ApplyFormulaTransform, SubValuesHoldAll], Null]
];


Get[FileNameJoin[{$FTPackageDirectory, "Core.wl"}]];
Get[FileNameJoin[{$FTPackageDirectory, "Conditions.wl"}]];
Get[FileNameJoin[{$FTPackageDirectory, "Compiler.wl"}]];
Get[FileNameJoin[{$FTPackageDirectory, "Expressions.wl"}]];
Get[FileNameJoin[{$FTPackageDirectory, "Rules.wl"}]];
Get[FileNameJoin[{$FTPackageDirectory, "Heuristics.wl"}]];
Get[FileNameJoin[{$FTPackageDirectory, "Specifics", "Young.wl"}]];
Get[FileNameJoin[{$FTPackageDirectory, "Specifics", "IntegrationByParts.wl"}]];
Get[FileNameJoin[{$FTPackageDirectory, "Planners.wl"}]];

End[];

EndPackage[];

