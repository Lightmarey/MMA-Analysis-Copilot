BeginPackage["ProofPatternEngine`"];

PPNormalize::usage = "PPNormalize[input, context] creates a proof-rule state for expression-pattern matching.";
PPSuggest::usage = "PPSuggest[state] returns candidate proof-rule or transform moves for a proof state.";
PPApply::usage = "PPApply[state, move] applies one candidate move and appends proof trace.";
PPTrace::usage = "PPTrace[state] returns the proof trace stored in a state.";
PPHandleRequest::usage = "PPHandleRequest[args] handles ai4math proof_pattern_engine tool requests.";
RegisterPPRule::usage = "RegisterPPRule[rule] registers a proof-pattern rule association.";
RegisterPPTransform::usage = "RegisterPPTransform[transform] registers a transform association.";
RegisterPPHeuristic::usage = "RegisterPPHeuristic[name, function] registers a proof-pattern heuristic.";
ValidatePPRule::usage = "ValidatePPRule[rule] validates the restricted proof-pattern rule schema.";
ValidatePPTransform::usage = "ValidatePPTransform[transform] validates the restricted transform schema.";
ValidatePPMoveSchema::usage = "ValidatePPMoveSchema[schema] validates an LLM-proposed restricted proof move schema without evaluating injected code.";
CompilePPMoveSchema::usage = "CompilePPMoveSchema[schema] compiles a validated restricted proof move schema into a safe proof-rule plan.";
PPParameterChoice::usage = "PPParameterChoice[direction, parameter, condition, dependencies] creates a small/large parameter proof obligation.";

Begin["`Private`"];

ClearAll[
  $PPPackageDirectory, $PPRuleRegistry, $PPTransformRegistry, $PPHeuristicRegistry,
  PPNow, PPReadString, PPParseInput, PPParseContext, PPParsePayload,
  PPStateQ, PPGoal, PPContext, PPKnown, PPTrace, PPNormalize,
  PPSuggest, PPApply, PPHandleRequest, RegisterPPRule,
  RegisterPPTransform, RegisterPPHeuristic, ValidatePPRule,
  ValidatePPTransform, ValidatePPMoveSchema, CompilePPMoveSchema,
  PPParameterChoice, PPRegisteredHeuristicMoves, PPLoadBuiltInRegistry,
  PPLoadBuiltInHeuristics, PPDataDirectory, PPConditionStatus,
  PPGoalText, PPContextValues, PPContextHasText, PPContextStatus,
  PPCompilerSchemaSummary, PPCanonicalRegistryName, PPKnownRuleNameQ,
  PPKnownTransformNameQ
];

$PPPackageDirectory = FileNameJoin[{DirectoryName[$InputFileName], "ProofPatternEngine"}];

Get[FileNameJoin[{$PPPackageDirectory, "Kernel", "Registry.wl"}]];
Get[FileNameJoin[{$PPPackageDirectory, "Kernel", "Compiler.wl"}]];
Get[FileNameJoin[{$PPPackageDirectory, "Kernel", "Core.wl"}]];
Get[FileNameJoin[{$PPPackageDirectory, "Kernel", "Heuristics", "ProductIntegral.wl"}]];
Get[FileNameJoin[{$PPPackageDirectory, "Kernel", "Heuristics", "SumProduct.wl"}]];
Get[FileNameJoin[{$PPPackageDirectory, "Kernel", "Heuristics", "ProductPointwise.wl"}]];
Get[FileNameJoin[{$PPPackageDirectory, "Kernel", "Heuristics", "IntegrationByParts.wl"}]];
Get[FileNameJoin[{$PPPackageDirectory, "Kernel", "Heuristics", "FunctionSpace.wl"}]];

PPLoadBuiltInRegistry[];
PPLoadBuiltInHeuristics[];

End[];

EndPackage[];
