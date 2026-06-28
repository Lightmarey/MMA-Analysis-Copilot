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
  FTApplyRule, FTApplyHolderLike, FTApplyYoung, FTApplyIntegrationByParts,
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

FTReadString[value_] := If[StringQ[value], StringTrim[value], ""];

FTNow[] := DateString[{"ISODate", "T", "Time"}];

FTParsePayload[value_] := Module[{text, parsed},
  text = FTReadString[value];
  If[text === "", Return[<||>]];
  parsed = Quiet@Check[ImportString[text, "RawJSON"], $Failed];
  If[AssociationQ[parsed], parsed, <|"__InvalidPayload" -> text|>]
];

FTParseHeldFormula[value_] := Module[{text, parsed},
  text = FTReadString[value];
  If[text === "", Return[$Failed]];
  parsed = Quiet@Check[ToExpression["HoldComplete[" <> text <> "]", InputForm], $Failed];
  If[Head[parsed] === HoldComplete, parsed, $Failed]
];

FTParseAssumptions[value_] := Module[{text, parsed},
  text = FTReadString[value];
  If[text === "", Return[True]];
  parsed = Quiet@Check[ToExpression[text, InputForm], $Failed];
  If[parsed === $Failed, True, parsed]
];

FTParseMaybeExpression[value_] := Module[{text, parsed},
  If[! StringQ[value], Return[value]];
  text = StringTrim[value];
  If[text === "", Return[$Failed]];
  parsed = Quiet@Check[ToExpression[text, InputForm], $Failed];
  parsed
];

FTParseState[value_] := Module[{text, parsed},
  text = FTReadString[value];
  If[text === "", Return[<|"Head" -> "FormulaTransformState", "Obligations" -> {}, "Trace" -> {}|>]];
  parsed = Quiet@Check[ToExpression[text, InputForm], $Failed];
  If[AssociationQ[parsed], parsed, <|"Head" -> "FormulaTransformState", "Obligations" -> {}, "Trace" -> {}|>]
];

FTConditionId[kind_, expr_] := "cond-" <> IntegerString[Hash[{kind, HoldComplete[expr]}, "CRC32"], 16, 8];

FTConditionPredicate[kind_String, expr_] := Which[
  MatchQ[expr, Inactive[FunctionSpace][_, _]], "FunctionSpace",
  MatchQ[expr, Inactive[RealValued][_]], "RealValued",
  MatchQ[expr, Inactive[Measurable][_, _]], "Measurable",
  MatchQ[expr, Inactive[MeasurableIntegrable][_, _]], "MeasurableIntegrable",
  MatchQ[expr, Inactive[BoundaryTerm][__]], "BoundaryTerm",
  MatchQ[expr, Inactive[BoundaryTrace][__]], "BoundaryTrace",
  MatchQ[expr, Inactive[ZeroMean][__]], "Normalization",
  MatchQ[expr, Inactive[Regularity][_]], "Regularity",
  kind === "FunctionSpaceMembership", "FunctionSpace",
  kind === "RealValued", "RealValued",
  kind === "Nonnegativity", "Nonnegative",
  kind === "Measurability" || kind === "MeasurabilityIntegrability", "MeasurableIntegrable",
  kind === "BoundaryCondition", "BoundaryCondition",
  kind === "NormalizationCondition", "Normalization",
  kind === "NormalizationFactorNonzero", "Nonzero",
  kind === "WeightPositive" || kind === "TargetCoefficientPositive", "Positive",
  kind === "ExponentConstraint", "ExponentConstraint",
  kind === "ExponentConjugacy", "ExponentConjugacy",
  True, kind
];

FTConditionStructure[kind_String, expr_] := Module[{predicate, arguments, exprText},
  predicate = FTConditionPredicate[kind, expr];
  exprText = If[StringQ[expr], expr, ToString[expr, InputForm, PageWidth -> Infinity]];
  arguments = Which[
    MatchQ[expr, Inactive[FunctionSpace][_, _]],
      ToString[#, InputForm, PageWidth -> Infinity] & /@ List @@ expr,
    MatchQ[expr, Inactive[RealValued][_]] || MatchQ[expr, Inactive[Regularity][_]],
      {ToString[First[List @@ expr], InputForm, PageWidth -> Infinity]},
    MatchQ[expr, Inactive[BoundaryTerm][__]],
      ToString[#, InputForm, PageWidth -> Infinity] & /@ List @@ expr,
    MatchQ[expr, Inactive[BoundaryTrace][__]] || MatchQ[expr, Inactive[ZeroMean][__]],
      ToString[#, InputForm, PageWidth -> Infinity] & /@ List @@ expr,
    MatchQ[expr, Inactive[Measurable][_, _]],
      ToString[#, InputForm, PageWidth -> Infinity] & /@ List @@ expr,
    MatchQ[expr, Inactive[MeasurableIntegrable][_, _]],
      ToString[#, InputForm, PageWidth -> Infinity] & /@ List @@ expr,
    StringQ[expr],
      {expr},
    True,
      {exprText}
  ];
  <|
    "Predicate" -> predicate,
    "Arguments" -> arguments,
    "ExpressionInputForm" -> exprText
  |>
];

FTConditionDischargeStrategy[kind_String, predicate_String, machineCheckable_] := Which[
  TrueQ[machineCheckable], {"Simplify", "Reduce"},
  MemberQ[{"FunctionSpace", "RealValued", "Measurable", "MeasurableIntegrable", "Regularity", "BoundaryCondition", "Normalization"}, predicate],
    {"ContextDeclaration", "RegisteredDischarger"},
  True,
    {"ContextDeclaration", "DeferredObligation"}
];

FTRealValuedCondition[expr_, source_] := FTCondition["RealValued", Inactive[RealValued][expr], source, False];

FTFunctionSpaceCondition[expr_, space_, source_] :=
  FTCondition["FunctionSpaceMembership", Inactive[FunctionSpace][expr, space], source, False];

FTMeasurableCondition[expr_, domain_, source_] :=
  FTCondition["Measurability", Inactive[Measurable][expr, domain], source, False];

FTMeasurableIntegrableCondition[exprs_, domain_, source_] :=
  FTCondition["MeasurabilityIntegrability", Inactive[MeasurableIntegrable][exprs, domain], source, False];

FTBoundaryCondition[expr_, source_] := FTCondition["BoundaryCondition", Inactive[BoundaryTerm][expr], source, False];

FTRegularityCondition[expr_, source_] := FTCondition["Regularity", Inactive[Regularity][expr], source, False];

FTCondition[kind_String, expr_, source_, machineCheckable_: True] := Module[{structured},
  structured = FTConditionStructure[kind, expr];
  <|
    "Id" -> FTConditionId[kind, expr],
    "Kind" -> kind,
    "Expr" -> expr,
    "Structured" -> structured,
    "Predicate" -> Lookup[structured, "Predicate", kind],
    "FallbackText" -> StringQ[expr],
    "Provenance" -> If[StringQ[expr], "TextFallbackCondition", "StructuredCondition"],
    "Source" -> source,
    "MachineCheckable" -> machineCheckable,
    "DischargeStrategy" -> FTConditionDischargeStrategy[kind, Lookup[structured, "Predicate", kind], machineCheckable],
    "Status" -> "Discovered"
  |>
];

FTFailure[type_String, message_String, extra_: <||>] := Join[
  <|"Status" -> "Failure", "Kind" -> "FormulaTransform", "FailureType" -> type, "Message" -> message|>,
  If[AssociationQ[extra], extra, <||>]
];

FTSuccess[assoc_Association] := Join[<|"Status" -> "Success", "Kind" -> "FormulaTransform"|>, assoc];

FTAppendTrace[trace_List, step_String, data_: <||>] := Append[
  trace,
  Join[<|"Step" -> step, "Time" -> FTNow[]|>, If[AssociationQ[data], data, <|"Data" -> data|>]]
];

FTImportJSON[file_] := Module[{data},
  data = Quiet@Check[Import[file, "RawJSON"], $Failed];
  If[AssociationQ[data], data, <|"__InvalidFile" -> file|>]
];

FTLoadDataFiles[subdir_String, compiler_] := Module[{dir, files, compiled},
  dir = FileNameJoin[{$FTPackageDirectory, "Registry", subdir}];
  files = Sort@FileNames["*.json", dir];
  compiled = compiler /@ (FTImportJSON /@ files);
  <|"Directory" -> dir, "Files" -> files, "Compiled" -> compiled|>
];

FTLoadBuiltInRegistry[] := Module[{ruleLoad, heuristicLoad, estimateLoad, structuralLoad, targetPlannerLoad, dischargerLoad},
  $FTRuleRegistry = <||>;
  $FTHeuristicRegistry = <||>;
  $FTEstimateSeedRegistry = <||>;
  $FTStructuralRegistry = <||>;
  $FTDischargerRegistry = <||>;
  $FTTargetPlannerRegistry = <||>;
  ruleLoad = FTLoadDataFiles["Rules", CompileFormulaTransformRule];
  heuristicLoad = FTLoadDataFiles["Heuristics", CompileFormulaHeuristicRule];
  estimateLoad = FTLoadDataFiles["EstimateSeeds", FTCompileEstimateSeed];
  structuralLoad = FTLoadDataFiles["StructuralTransforms", FTCompileStructuralTransform];
  targetPlannerLoad = FTLoadDataFiles["TargetPlanners", FTCompileTargetPlanner];
  dischargerLoad = FTLoadDataFiles["ObligationDischargers", FTCompileObligationDischarger];
  <|"Rules" -> ruleLoad, "Heuristics" -> heuristicLoad, "EstimateSeeds" -> estimateLoad, "StructuralTransforms" -> structuralLoad, "TargetPlanners" -> targetPlannerLoad, "ObligationDischargers" -> dischargerLoad|>
];

FTValidateName[assoc_Association] := StringQ[Lookup[assoc, "name", ""]] && StringTrim[Lookup[assoc, "name", ""]] =!= "";

FTValidateStringList[value_] := ListQ[value] && AllTrue[value, StringQ[#] && StringTrim[#] =!= "" &];

FTValidateConditionList[value_] := ListQ[value] && AllTrue[value, 
  (StringQ[#] && StringTrim[#] =!= "") || 
  (AssociationQ[#] && KeyExistsQ[#, "predicate"] && KeyExistsQ[#, "arguments"] && ListQ[Lookup[#, "arguments"]]) &
];

FTTemplateSlotRefs[assoc_Association] := DeleteDuplicates@StringDrop[
  StringCases[ToString[assoc, InputForm, PageWidth -> Infinity], RegularExpression["\\$[A-Za-z][A-Za-z0-9]*"]],
  1
];

FTDeclaredTemplateSlots[assoc_Association] := Module[
  {slots = {"selected"}, parameters, defaults, expressions, matchers, derived},
  parameters = Lookup[assoc, "parameters", {}];
  defaults = Lookup[assoc, "parameterDefaults", <||>];
  expressions = Lookup[assoc, "parameterExpressions", {}];
  matchers = Cases[Lookup[assoc, "matchers", {}], _Association, Infinity];
  derived = Lookup[assoc, "derivedBindings", <||>];
  slots = Join[
    slots,
    If[ListQ[parameters], Cases[parameters, p_Association :> Lookup[p, "name", Nothing]], {}],
    If[AssociationQ[defaults], Keys[defaults], {}],
    If[ListQ[expressions], Select[expressions, StringQ], {}],
    Cases[matchers, a_Association /; KeyExistsQ[a, "slots"] :> Lookup[a, "slots"], Infinity] // Flatten,
    Cases[matchers, a_Association /; KeyExistsQ[a, "domainSlot"] :> Lookup[a, "domainSlot"], Infinity],
    Cases[matchers, a_Association /; KeyExistsQ[a, "bodySlot"] :> Lookup[a, "bodySlot"], Infinity],
    Cases[matchers, a_Association /; KeyExistsQ[a, "varSlot"] :> Lookup[a, "varSlot"], Infinity],
    If[AssociationQ[derived], Keys[derived], {}]
  ];
  DeleteDuplicates@Select[slots, StringQ[#] && StringTrim[#] =!= "" &]
];

FTValidateTemplateSlots[assoc_Association] := Module[{refs, declared, unknown},
  If[FTReadString[Lookup[assoc, "extends", ""]] =!= "", Return[{}]];
  refs = FTTemplateSlotRefs[assoc];
  declared = FTDeclaredTemplateSlots[assoc];
  unknown = Complement[refs, declared];
  If[unknown === {}, {}, {"Rule JSON references unbound template slots: " <> StringRiffle["$" <> # & /@ unknown, ", "]}]
];

FTValidateOrientations[assoc_Association] := Module[{orientations, issues = {}, direction, relation, name},
  orientations = Lookup[assoc, "orientations", {}];
  If[! ListQ[orientations], Return[{}]];
  Do[
    If[AssociationQ[orientation],
      name = FTReadString[Lookup[orientation, "name", "unnamed"]];
      direction = FTReadString[Lookup[orientation, "direction", "Auto"]];
      relation = FTReadString[Lookup[orientation, "relation", ""]];
      If[! MemberQ[{"Upper", "Lower", "TwoSided", "Equal", "Auto"}, direction],
        AppendTo[issues, "orientation " <> name <> " has unsupported direction " <> direction <> "."]
      ];
      If[relation =!= "" && ! MemberQ[{"LessEqual", "LessEqualChain", "Equal"}, relation],
        AppendTo[issues, "orientation " <> name <> " has unsupported relation " <> relation <> "."]
      ];
      If[direction === "Equal" && relation =!= "" && relation =!= "Equal",
        AppendTo[issues, "orientation " <> name <> " uses direction=Equal with non-equality relation " <> relation <> "."]
      ];
      If[relation === "Equal" && MemberQ[{"Upper", "Lower", "TwoSided"}, direction],
        AppendTo[issues, "orientation " <> name <> " uses inequality direction with relation=Equal."]
      ];
      If[relation === "LessEqual" && !(KeyExistsQ[orientation, "lhs"] && KeyExistsQ[orientation, "rhs"]),
        AppendTo[issues, "orientation " <> name <> " relation=LessEqual requires lhs and rhs."]
      ];
      If[relation === "LessEqualChain" && !(ListQ[Lookup[orientation, "terms", {}]] && Length[Lookup[orientation, "terms", {}]] >= 3),
        AppendTo[issues, "orientation " <> name <> " relation=LessEqualChain requires at least three terms."]
      ];
      If[Lookup[assoc, "kind", ""] === "StructuralTransform" && relation =!= "" && relation =!= "Equal",
        AppendTo[issues, "structural orientation " <> name <> " must use relation=Equal."]
      ]
    ],
    {orientation, orientations}
  ];
  issues
];

FTValidateTemplates[assoc_Association] := Module[
  {asText, forbidden, unknownPrimitive, allowed},
  asText = ToString[assoc, InputForm, PageWidth -> Infinity];
  forbidden = Select[
    {"ToExpression", "Get[", "Put[", "Run[", "Import[", "Read[", "Write[", "DeleteFile", "SetDirectory", "CreateFile", ";"},
    StringContainsQ[asText, #] &
  ];
  allowed = {
    "Integral", "Sum", "Product", "Abs", "Power", "Sqrt", "D",
    "Norm", "Grad", "Gradient", "NormIntegral", "NormSum", "FunctionSpace",
    "RealValued", "Nonnegative", "YoungConstant", "BoundaryTerm", "IBPIntegral", "Lp", "Lq",
    "L2", "W", "ZeroMean", "BoundaryTrace", "BoundedLipschitzDomain",
    "Measurable", "MeasurableIntegrable", "Regularity", "RegularEnoughForIBP", "NormalizeQuotient", "NormalizationFactorNonzero",
    "Norm", "Grad"
  };
  unknownPrimitive = DeleteDuplicates@Cases[
    StringCases[asText, RegularExpression["\\b[A-Z][A-Za-z0-9]+\\["]],
    s_ :> StringDrop[s, -1]
  ];
  unknownPrimitive = Complement[unknownPrimitive, allowed, {"Rule", "Association"}];
  Join[
    If[forbidden === {}, {}, {"Rule JSON contains forbidden executable constructs: " <> StringRiffle[forbidden, ", "]}],
    If[unknownPrimitive === {}, {}, {"Rule JSON references unknown compiler primitives: " <> StringRiffle[unknownPrimitive, ", "]}],
    FTValidateTemplateSlots[assoc],
    FTValidateOrientations[assoc]
  ]
];

FTCompileRule[rule_Association] := Module[
  {issues = {}, name, extends, family, matchers, orientations, conditions, compatibleHeuristics, defaults, parameterList, parameterDefaults},
  If[! FTValidateName[rule], AppendTo[issues, "name must be a non-empty string."]];
  name = StringTrim[Lookup[rule, "name", ""]];
  extends = FTReadString[Lookup[rule, "extends", ""]];
  family = FTReadString[Lookup[rule, "family", If[extends =!= "", extends, name]]];
  matchers = Lookup[rule, "matchers", {}];
  orientations = Lookup[rule, "orientations", {}];
  conditions = Lookup[rule, "conditions", {}];
  compatibleHeuristics = Lookup[rule, "compatibleHeuristics", {}];
  defaults = Lookup[rule, "parameterDefaults", <||>];
  parameterList = Lookup[rule, "parameters", {}];
  parameterDefaults = If[ListQ[parameterList],
    Association@Cases[parameterList, p_Association /; KeyExistsQ[p, "default"] :> Lookup[p, "name"] -> Lookup[p, "default"]],
    <||>
  ];
  If[extends === "" && ! ListQ[matchers], AppendTo[issues, "matchers must be a list."]];
  If[extends === "" && ! ListQ[orientations], AppendTo[issues, "orientations must be a list."]];
  If[! FTValidateConditionList[conditions] && conditions =!= {}, AppendTo[issues, "conditions must be a valid condition list."]];
  If[! FTValidateStringList[compatibleHeuristics] && compatibleHeuristics =!= {}, AppendTo[issues, "compatibleHeuristics must be a string list."]];
  issues = Join[issues, FTValidateTemplates[rule]];
  If[issues =!= {},
    Return[FTFailure["InvalidRuleJSON", "Formula transform rule JSON was rejected.", <|"Issues" -> issues, "Rule" -> name|>]]
  ];
  <|
    "Head" -> "CompiledFormulaTransformRule",
    "RegistryKind" -> Lookup[rule, "kind", "CanonicalFormulaTransform"],
    "Name" -> name,
    "Extends" -> extends,
    "Family" -> family,
    "Runtime" -> FTReadString[Lookup[rule, "runtime", ""]],
    "Matchers" -> matchers,
    "Orientations" -> orientations,
    "Conditions" -> conditions,
    "DerivedBindings" -> Lookup[rule, "derivedBindings", <||>],
    "CompatibleHeuristics" -> compatibleHeuristics,
    "ParameterDefaults" -> Join[parameterDefaults, If[AssociationQ[defaults], defaults, <||>]],
    "Raw" -> rule
  |>
];

CompileFormulaTransformRule[rule_Association] := Module[{compiled},
  compiled = FTCompileRule[rule];
  If[Lookup[compiled, "Status", "Success"] === "Failure", Return[compiled]];
  $FTRuleRegistry[Lookup[compiled, "Name"]] = compiled;
  Join[<|"Status" -> "Compiled", "Kind" -> "FormulaTransformRule"|>, compiled]
];

CompileFormulaTransformRule[_] := FTFailure["InvalidRuleJSON", "Rule payload must be an Association."];

FTCompileHeuristic[heuristic_Association] := Module[{issues = {}, name, appliesTo},
  If[! FTValidateName[heuristic], AppendTo[issues, "name must be a non-empty string."]];
  name = StringTrim[Lookup[heuristic, "name", ""]];
  appliesTo = Lookup[heuristic, "appliesTo", {}];
  If[! FTValidateStringList[appliesTo] && appliesTo =!= {}, AppendTo[issues, "appliesTo must be a string list."]];
  issues = Join[issues, FTValidateTemplates[heuristic]];
  If[issues =!= {},
    Return[FTFailure["InvalidRuleJSON", "Formula heuristic JSON was rejected.", <|"Issues" -> issues, "Heuristic" -> name|>]]
  ];
  <|
    "Head" -> "CompiledFormulaHeuristicRule",
    "RegistryKind" -> Lookup[heuristic, "kind", "HeuristicRewrite"],
    "Name" -> name,
    "AppliesTo" -> appliesTo,
    "Matchers" -> Lookup[heuristic, "matchers", {}],
    "Rewrite" -> Lookup[heuristic, "rewrite", <||>],
    "Conditions" -> Lookup[heuristic, "conditions", {}],
    "Cost" -> Lookup[heuristic, "cost", 1],
    "MaxApplications" -> Lookup[heuristic, "maxApplications", 1],
    "Raw" -> heuristic
  |>
];

CompileFormulaHeuristicRule[heuristic_Association] := Module[{compiled},
  compiled = FTCompileHeuristic[heuristic];
  If[Lookup[compiled, "Status", "Success"] === "Failure", Return[compiled]];
  $FTHeuristicRegistry[Lookup[compiled, "Name"]] = compiled;
  Join[<|"Status" -> "Compiled", "Kind" -> "FormulaHeuristicRule"|>, compiled]
];

CompileFormulaHeuristicRule[_] := FTFailure["InvalidRuleJSON", "Heuristic payload must be an Association."];

FTCompileEstimateSeed[seed_Association] := Module[{issues = {}, name, appliesTo, parameterExpressions, parameterDefaults},
  If[! FTValidateName[seed], AppendTo[issues, "name must be a non-empty string."]];
  name = StringTrim[Lookup[seed, "name", ""]];
  appliesTo = Lookup[seed, "appliesTo", {}];
  parameterExpressions = Lookup[seed, "parameterExpressions", {}];
  parameterDefaults = Lookup[seed, "parameterDefaults", <||>];
  If[! FTValidateStringList[appliesTo] && appliesTo =!= {}, AppendTo[issues, "appliesTo must be a string list."]];
  If[! FTValidateStringList[parameterExpressions] && parameterExpressions =!= {}, AppendTo[issues, "parameterExpressions must be a string list."]];
  If[! AssociationQ[parameterDefaults] && parameterDefaults =!= <||>, AppendTo[issues, "parameterDefaults must be an object."]];
  issues = Join[issues, FTValidateTemplates[seed]];
  If[issues =!= {},
    Return[FTFailure["InvalidRuleJSON", "Estimate seed JSON was rejected.", <|"Issues" -> issues, "EstimateSeed" -> name|>]]
  ];
  $FTEstimateSeedRegistry[name] = <|
    "Head" -> "CompiledFormulaEstimateSeed",
    "RegistryKind" -> Lookup[seed, "kind", "EstimateSeed"],
    "Name" -> name,
    "AppliesTo" -> appliesTo,
    "Template" -> Lookup[seed, "template", <||>],
    "Conditions" -> Lookup[seed, "conditions", {}],
    "ParameterDefaults" -> parameterDefaults,
    "ParameterExpressions" -> parameterExpressions,
    "Raw" -> seed
  |>;
  Join[<|"Status" -> "Compiled", "Kind" -> "FormulaEstimateSeed"|>, $FTEstimateSeedRegistry[name]]
];

FTCompileEstimateSeed[_] := FTFailure["InvalidRuleJSON", "Estimate seed payload must be an Association."];

FTCompileStructuralTransform[transform_Association] := Module[{issues = {}, name, appliesTo, runtime, parameterExpressions},
  If[! FTValidateName[transform], AppendTo[issues, "name must be a non-empty string."]];
  name = StringTrim[Lookup[transform, "name", ""]];
  appliesTo = Lookup[transform, "appliesTo", {}];
  runtime = FTReadString[Lookup[transform, "runtime", name]];
  parameterExpressions = Lookup[transform, "parameterExpressions", {}];
  If[! FTValidateStringList[appliesTo] && appliesTo =!= {}, AppendTo[issues, "appliesTo must be a string list."]];
  If[! FTValidateStringList[parameterExpressions] && parameterExpressions =!= {}, AppendTo[issues, "parameterExpressions must be a string list."]];
  If[runtime === "", AppendTo[issues, "runtime must be a non-empty string."]];
  issues = Join[issues, FTValidateTemplates[transform]];
  If[issues =!= {},
    Return[FTFailure["InvalidRuleJSON", "Structural transform JSON was rejected.", <|"Issues" -> issues, "StructuralTransform" -> name|>]]
  ];
  $FTStructuralRegistry[name] = <|
    "Head" -> "CompiledFormulaStructuralTransform",
    "RegistryKind" -> Lookup[transform, "kind", "StructuralTransform"],
    "Name" -> name,
    "Runtime" -> runtime,
    "AppliesTo" -> appliesTo,
    "Matchers" -> Lookup[transform, "matchers", {}],
    "Orientations" -> Lookup[transform, "orientations", {}],
    "Conditions" -> Lookup[transform, "conditions", {}],
    "DerivedBindings" -> Lookup[transform, "derivedBindings", <||>],
    "ParameterExpressions" -> parameterExpressions,
    "Raw" -> transform
  |>;
  Join[<|"Status" -> "Compiled", "Kind" -> "FormulaStructuralTransform"|>, $FTStructuralRegistry[name]]
];

FTCompileStructuralTransform[_] := FTFailure["InvalidRuleJSON", "Structural transform payload must be an Association."];

CompileFormulaStructuralTransform[transform_Association] := FTCompileStructuralTransform[transform];

CompileFormulaStructuralTransform[_] := FTFailure["InvalidRuleJSON", "Structural transform payload must be an Association."];

FTCompileTargetPlanner[planner_Association] := Module[
  {issues = {}, name, rules, family, runtime, objective, primitives, allowedPrimitives},
  If[! FTValidateName[planner], AppendTo[issues, "name must be a non-empty string."]];
  name = StringTrim[Lookup[planner, "name", ""]];
  rules = Lookup[planner, "rules", {}];
  If[StringQ[rules], rules = {rules}];
  family = Lookup[planner, "families", {}];
  If[StringQ[family], family = {family}];
  runtime = FTReadString[Lookup[planner, "runtime", ""]];
  objective = FTReadString[Lookup[planner, "objective", ""]];
  primitives = Lookup[planner, "primitives", {}];
  If[StringQ[primitives], primitives = {primitives}];
  allowedPrimitives = {
    "ParseTargetRelation", "MatchTargetLHS", "ExtractProductFactors",
    "InferAbsorbedQuadraticFactor", "InferResidualFactor",
    "ComputeProductCoefficient", "BuildResidualCoefficientCondition",
    "ParseIntegralOrSumProduct", "ParseWeightParameter",
    "InferWeightFromNormPair", "BuildWeightedHolderBound",
    "BuildWeightPositiveCondition", "BuildFunctionSpaceObligations"
  };
  If[! FTValidateStringList[rules] && rules =!= {}, AppendTo[issues, "rules must be a string or string list."]];
  If[! FTValidateStringList[family] && family =!= {}, AppendTo[issues, "families must be a string or string list."]];
  If[! FTValidateStringList[primitives] && primitives =!= {}, AppendTo[issues, "primitives must be a string or string list."]];
  If[ListQ[primitives] && Complement[primitives, allowedPrimitives] =!= {},
    AppendTo[issues, "primitives contains unsupported planner primitives: " <> StringRiffle[Complement[primitives, allowedPrimitives], ", "]]
  ];
  If[runtime === "", AppendTo[issues, "runtime must be a non-empty string."]];
  If[! MemberQ[{"YoungAbsorption", "WeightedHolder"}, runtime],
    AppendTo[issues, "runtime must be one of: YoungAbsorption, WeightedHolder."]
  ];
  issues = Join[issues, FTValidateTemplates[planner]];
  If[issues =!= {},
    Return[FTFailure["InvalidRuleJSON", "Target planner JSON was rejected.", <|"Issues" -> issues, "Planner" -> name|>]]
  ];
  $FTTargetPlannerRegistry[name] = <|
    "Head" -> "CompiledFormulaTargetPlanner",
    "RegistryKind" -> Lookup[planner, "kind", "TargetPlanner"],
    "Name" -> name,
    "Rules" -> rules,
    "Families" -> family,
    "Runtime" -> runtime,
    "Objective" -> objective,
    "Primitives" -> primitives,
    "Raw" -> planner
  |>;
  Join[<|"Status" -> "Compiled", "Kind" -> "FormulaTargetPlanner"|>, $FTTargetPlannerRegistry[name]]
];

FTCompileTargetPlanner[_] := FTFailure["InvalidRuleJSON", "Target planner payload must be an Association."];

CompileFormulaTargetPlanner[planner_Association] := FTCompileTargetPlanner[planner];

CompileFormulaTargetPlanner[_] := FTFailure["InvalidRuleJSON", "Target planner payload must be an Association."];

FTCompileDischargerEvidenceRules[discharger_Association] := Module[
  {rawRules, legacy, issues = {}, normalizeList, compileRule, rules},
  normalizeList[value_] := Which[
    StringQ[value], {value},
    ListQ[value] && AllTrue[value, StringQ], value,
    MatchQ[value, Missing["KeyAbsent", _]] || value === {}, {},
    True, $Failed
  ];
  rawRules = Lookup[discharger, "evidence", {}];
  If[AssociationQ[rawRules], rawRules = {rawRules}];
  If[MatchQ[rawRules, Missing["KeyAbsent", _]], rawRules = {}];
  If[! ListQ[rawRules],
    AppendTo[issues, "evidence must be an object or list of objects."];
    rawRules = {}
  ];
  compileRule[rule_Association, index_Integer] := Module[
    {source, any, all, label, obligationKinds},
    source = ToLowerCase@FTReadString[Lookup[rule, "source", "any"]];
    any = normalizeList[Lookup[rule, "containsAny", Lookup[rule, "contains", {}]]];
    all = normalizeList[Lookup[rule, "containsAll", {}]];
    obligationKinds = normalizeList[Lookup[rule, "obligationKinds", {}]];
    label = FTReadString[Lookup[rule, "label", "EvidenceRule" <> ToString[index]]];
    If[! MemberQ[{"any", "assumptions", "context"}, source],
      AppendTo[issues, "evidence[" <> ToString[index] <> "].source must be any, assumptions, or context."]
    ];
    If[any === $Failed,
      AppendTo[issues, "evidence[" <> ToString[index] <> "].containsAny must be a string or string list."];
      any = {}
    ];
    If[all === $Failed,
      AppendTo[issues, "evidence[" <> ToString[index] <> "].containsAll must be a string or string list."];
      all = {}
    ];
    If[obligationKinds === $Failed,
      AppendTo[issues, "evidence[" <> ToString[index] <> "].obligationKinds must be a string or string list."];
      obligationKinds = {}
    ];
    If[any === {} && all === {},
      AppendTo[issues, "evidence[" <> ToString[index] <> "] must include containsAny or containsAll."]
    ];
    <|
      "Label" -> If[label === "", "EvidenceRule" <> ToString[index], label],
      "Source" -> source,
      "ObligationKinds" -> obligationKinds,
      "ContainsAny" -> ToLowerCase /@ any,
      "ContainsAll" -> ToLowerCase /@ all
    |>
  ];
  rules = MapIndexed[
    If[AssociationQ[#1],
      compileRule[#1, First[#2]],
      AppendTo[issues, "evidence[" <> ToString[First[#2]] <> "] must be an object."]; Nothing
    ] &,
    rawRules
  ];
  legacy = Lookup[discharger, "evidenceText", {}];
  If[StringQ[legacy], legacy = {legacy}];
  If[ListQ[legacy] && legacy =!= {},
    rules = Append[
      rules,
      <|
        "Label" -> "LegacyEvidenceText",
        "Source" -> "any",
        "ObligationKinds" -> {},
        "ContainsAny" -> ToLowerCase /@ Select[legacy, StringQ],
        "ContainsAll" -> {}
      |>
    ]
  ];
  If[issues =!= {}, <|"Status" -> "Failure", "Issues" -> issues|>, <|"Status" -> "Success", "Rules" -> rules|>]
];

FTCompileObligationDischarger[discharger_Association] := Module[{issues = {}, name, matches, evidence, evidenceRules},
  If[! FTValidateName[discharger], AppendTo[issues, "name must be a non-empty string."]];
  name = StringTrim[Lookup[discharger, "name", ""]];
  matches = Lookup[discharger, "matchesObligation", {}];
  evidence = Lookup[discharger, "evidenceText", {}];
  evidenceRules = FTCompileDischargerEvidenceRules[discharger];
  If[StringQ[matches], matches = {matches}];
  If[StringQ[evidence], evidence = {evidence}];
  If[! FTValidateStringList[matches], AppendTo[issues, "matchesObligation must be a string or string list."]];
  If[! FTValidateStringList[evidence], AppendTo[issues, "evidenceText must be a string or string list."]];
  If[Lookup[evidenceRules, "Status", "Success"] === "Failure",
    issues = Join[issues, Lookup[evidenceRules, "Issues", {}]]
  ];
  issues = Join[issues, FTValidateTemplates[discharger]];
  If[issues =!= {},
    Return[FTFailure["InvalidRuleJSON", "Obligation discharger JSON was rejected.", <|"Issues" -> issues, "Discharger" -> name|>]]
  ];
  $FTDischargerRegistry[name] = <|
    "Head" -> "CompiledFormulaObligationDischarger",
    "RegistryKind" -> Lookup[discharger, "kind", "ObligationDischarger"],
    "Name" -> name,
    "MatchesObligation" -> matches,
    "EvidenceText" -> ToLowerCase /@ evidence,
    "EvidenceRules" -> Lookup[evidenceRules, "Rules", {}],
    "Raw" -> discharger
  |>;
  Join[<|"Status" -> "Compiled", "Kind" -> "FormulaObligationDischarger"|>, $FTDischargerRegistry[name]]
];

FTCompileObligationDischarger[_] := FTFailure["InvalidRuleJSON", "Obligation discharger payload must be an Association."];

CompileFormulaObligationDischarger[discharger_Association] := FTCompileObligationDischarger[discharger];
CompileFormulaObligationDischarger[_] := FTFailure["InvalidRuleJSON", "Obligation discharger payload must be an Association."];

FTMergeRule[base_Association, child_Association] := Module[
  {raw = Lookup[child, "Raw", <||>], childMatchers, childOrientations, childDerived, childHeuristics},
  childMatchers = Lookup[child, "Matchers", {}];
  childOrientations = Lookup[child, "Orientations", {}];
  childDerived = Lookup[child, "DerivedBindings", <||>];
  childHeuristics = Lookup[child, "CompatibleHeuristics", {}];
  Join[
    base,
    child,
    <|
      "Matchers" -> If[childMatchers === {}, Lookup[base, "Matchers", {}], childMatchers],
      "Orientations" -> If[childOrientations === {}, Lookup[base, "Orientations", {}], childOrientations],
      "Conditions" -> Lookup[raw, "overrideConditions", Lookup[child, "Conditions", Lookup[base, "Conditions", {}]]],
      "DerivedBindings" -> If[childDerived === <||>, Lookup[base, "DerivedBindings", <||>], childDerived],
      "Runtime" -> If[Lookup[child, "Runtime", ""] =!= "", Lookup[child, "Runtime"], Lookup[base, "Runtime", ""]],
      "ParameterDefaults" -> Join[Lookup[base, "ParameterDefaults", <||>], Lookup[child, "ParameterDefaults", <||>]],
      "CompatibleHeuristics" -> If[childHeuristics === {}, Lookup[base, "CompatibleHeuristics", {}], childHeuristics]
    |>
  ]
];

FTResolveRule[name_String] := Module[{rule, baseName, base},
  rule = Lookup[$FTRuleRegistry, name, Missing["NotFound"]];
  If[! AssociationQ[rule], Return[Missing["NotFound"]]];
  baseName = Lookup[rule, "Extends", ""];
  If[baseName === "", Return[rule]];
  base = Lookup[$FTRuleRegistry, baseName, Missing["NotFound"]];
  If[AssociationQ[base], FTMergeRule[base, rule], rule]
];

FTResolveTransform[name_String] := Module[{rule},
  rule = FTResolveRule[name];
  If[AssociationQ[rule], Return[rule]];
  rule = Lookup[$FTEstimateSeedRegistry, name, Missing["NotFound"]];
  If[AssociationQ[rule], Return[rule]];
  Lookup[$FTStructuralRegistry, name, Missing["NotFound"]]
];

FTTargetPlannerMatchesQ[planner_Association, compiled_Association, runtime_String] := Module[
  {name, family, rules, families},
  If[Lookup[planner, "Runtime", ""] =!= runtime, Return[False]];
  name = ToLowerCase@Lookup[compiled, "Name", ""];
  family = ToLowerCase@Lookup[compiled, "Family", ""];
  rules = ToLowerCase /@ Lookup[planner, "Rules", {}];
  families = ToLowerCase /@ Lookup[planner, "Families", {}];
  (rules === {} || MemberQ[rules, name]) ||
    (family =!= "" && AnyTrue[families, StringContainsQ[family, #] || StringContainsQ[#, family] &])
];

FTFindTargetPlanner[compiled_Association, runtime_String] := Module[{matches},
  matches = Select[Values[$FTTargetPlannerRegistry], FTTargetPlannerMatchesQ[#, compiled, runtime] &];
  If[matches === {}, Missing["NoTargetPlanner", runtime], Last[matches]]
];

FTPlannerPrimitiveAudit[planner_Association, executed_List] := Module[{declared = Lookup[planner, "Primitives", {}]},
  <|
    "Declared" -> declared,
    "Executed" -> (<|"Primitive" -> #, "Status" -> If[MemberQ[declared, #], "Executed", "UndeclaredExecution"]|> & /@ executed),
    "MissingRequired" -> Complement[executed, declared],
    "UnusedDeclared" -> Complement[declared, executed]
  |>
];

FTRequirePlannerPrimitives[planner_Association, required_List, trace_, state_] := Module[
  {missing = Complement[required, Lookup[planner, "Primitives", {}]]},
  If[missing === {},
    Null,
    FTFailure[
      "CompilerPrimitiveMissing",
      "TargetPlanner descriptor is missing required planner primitives: " <> StringRiffle[missing, ", "],
      <|"Trace" -> trace, "State" -> state, "TargetPlanner" -> Lookup[planner, "Name"], "MissingPrimitives" -> missing|>
    ]
  ]
];

InspectFormulaTransformRegistry[] := <|
  "Package" -> "FormulaTransformEngine",
  "PublicTool" -> "formula_transform",
  "RegistryKinds" -> <|
    "CanonicalFormulaTransform" -> Keys[$FTRuleRegistry],
    "HeuristicRewrite" -> Keys[$FTHeuristicRegistry],
    "EstimateSeed" -> Keys[$FTEstimateSeedRegistry],
    "StructuralTransform" -> Keys[$FTStructuralRegistry],
    "TargetPlanner" -> Keys[$FTTargetPlannerRegistry],
    "ObligationDischarger" -> Keys[$FTDischargerRegistry]
  |>,
  "Rules" -> Keys[$FTRuleRegistry],
  "Heuristics" -> Keys[$FTHeuristicRegistry],
  "EstimateSeeds" -> Keys[$FTEstimateSeedRegistry],
  "StructuralTransforms" -> Keys[$FTStructuralRegistry],
  "TargetPlanners" -> Keys[$FTTargetPlannerRegistry],
  "ObligationDischargers" -> Keys[$FTDischargerRegistry],
  "RuleCount" -> Length[$FTRuleRegistry],
  "HeuristicCount" -> Length[$FTHeuristicRegistry],
  "EstimateSeedCount" -> Length[$FTEstimateSeedRegistry],
  "StructuralTransformCount" -> Length[$FTStructuralRegistry],
  "TargetPlannerCount" -> Length[$FTTargetPlannerRegistry],
  "ObligationDischargerCount" -> Length[$FTDischargerRegistry],
  "AllowedFailureTypes" -> {
    "InvalidRequest", "InvalidRuleJSON", "UnsupportedRule", "AmbiguousPart",
    "Inapplicable", "DirectionUnavailable", "AssumptionContradiction",
    "CompilerPrimitiveMissing"
  }
|>;

ReloadFormulaTransformRegistry[] := Module[{load},
  load = FTLoadBuiltInRegistry[];
  <|
    "Status" -> "Success",
    "Kind" -> "FormulaTransformRegistryReload",
    "Loaded" -> <|
      "RuleFiles" -> Length[Lookup[Lookup[load, "Rules", <||>], "Files", {}]],
      "HeuristicFiles" -> Length[Lookup[Lookup[load, "Heuristics", <||>], "Files", {}]],
      "EstimateSeedFiles" -> Length[Lookup[Lookup[load, "EstimateSeeds", <||>], "Files", {}]],
      "StructuralTransformFiles" -> Length[Lookup[Lookup[load, "StructuralTransforms", <||>], "Files", {}]],
      "TargetPlannerFiles" -> Length[Lookup[Lookup[load, "TargetPlanners", <||>], "Files", {}]],
      "ObligationDischargerFiles" -> Length[Lookup[Lookup[load, "ObligationDischargers", <||>], "Files", {}]]
    |>,
    "Registry" -> InspectFormulaTransformRegistry[]
  |>
];

FTReadAssociationField[assoc_Association, key_String] := Module[{value = Lookup[assoc, key, ""]},
  Which[
    AssociationQ[value], value,
    StringQ[value], FTParsePayload[value],
    True, <||>
  ]
];

FTReadAction[args_Association] := Module[{action = ToLowerCase[FTReadString[Lookup[args, "action", "apply"]]]},
  Switch[action,
    "plan_parts", "plan_parts",
    "plan_apply", "plan_apply",
    "inspect_registry", "inspect_registry",
    "reload_registry", "reload_registry",
    "compile_rule", "compile_rule",
    "compile_heuristic", "compile_heuristic",
    "compile_seed", "compile_seed",
    "compile_planner", "compile_planner",
    "compile_structural", "compile_structural",
    "compile_discharger", "compile_discharger",
    "get_obligations", "get_obligations",
    "discharge_obligation", "discharge_obligation",
    _, "apply"
  ]
];

FormulaTransformHandleRequest[args_Association] := Module[
  {action, payload, held, rule, direction, part, parameters, assumptions, assumptionsText, context, contextText, state},
  action = FTReadAction[args];
  payload = FTParsePayload[Lookup[args, "payload", ""]];
  Switch[action,
    "inspect_registry", Return[InspectFormulaTransformRegistry[]],
    "reload_registry", Return[ReloadFormulaTransformRegistry[]],
    "compile_rule", Return[CompileFormulaTransformRule[payload]],
    "compile_heuristic", Return[CompileFormulaHeuristicRule[payload]],
    "compile_seed", Return[FTCompileEstimateSeed[payload]],
    "compile_planner", Return[CompileFormulaTargetPlanner[payload]],
    "compile_structural", Return[CompileFormulaStructuralTransform[payload]],
    "compile_discharger", Return[CompileFormulaObligationDischarger[payload]],
    "get_obligations",
      state = FTParseState[Lookup[args, "state", ""]];
      Return[GetFormulaTransformObligations[state]],
    "discharge_obligation",
      state = FTParseState[Lookup[args, "state", ""]];
      parameters = FTReadAssociationField[args, "parameters"];
      assumptionsText = FTReadString[Lookup[args, "assumptions", ""]];
      assumptions = FTParseAssumptions[assumptionsText];
      contextText = FTReadString[Lookup[args, "context", ""]];
      Return[FTDischargeObligation[state, parameters, assumptions, assumptionsText, contextText]]
  ];

  held = FTParseHeldFormula[Lookup[args, "formula", ""]];
  If[held === $Failed, Return[FTFailure["InvalidRequest", "formula must be a non-empty Wolfram InputForm expression."]]];
  rule = FTReadString[Lookup[args, "rule", ""]];
  direction = FTReadString[Lookup[args, "direction", "Auto"]];
  If[direction === "", direction = "Auto"];
  part = FTReadString[Lookup[args, "part", "Whole"]];
  If[part === "", part = "Whole"];
  parameters = FTReadAssociationField[args, "parameters"];
  assumptionsText = FTReadString[Lookup[args, "assumptions", ""]];
  assumptions = FTParseAssumptions[assumptionsText];
  contextText = FTReadString[Lookup[args, "context", ""]];
  context = FTReadAssociationField[args, "context"];
  state = FTParseState[Lookup[args, "state", ""]];
  If[action =!= "plan_parts" && rule === "", Return[FTFailure["InvalidRequest", "rule must be provided."]]];
  With[
    {
      r = rule, d = direction, pt = part, params = parameters, asm = assumptions,
      asmText = assumptionsText, ctx = context, ctxText = contextText, st = state,
      h = held
    },
    Which[
      action === "plan_parts",
      PlanFormulaTransformParts[r,
        "Direction" -> d,
        "Part" -> pt,
        "Parameters" -> params,
        "Assumptions" -> asm,
        "AssumptionsText" -> asmText,
        "Context" -> ctx,
        "ContextText" -> ctxText,
        "State" -> st
      ][h],
      action === "plan_apply",
      PlanFormulaTransform[r,
        "Direction" -> d,
        "Part" -> pt,
        "Parameters" -> params,
        "Assumptions" -> asm,
        "AssumptionsText" -> asmText,
        "Context" -> ctx,
        "ContextText" -> ctxText,
        "State" -> st
      ][h],
      True,
      ApplyFormulaTransform[r,
        "Direction" -> d,
        "Part" -> pt,
        "Parameters" -> params,
        "Assumptions" -> asm,
        "AssumptionsText" -> asmText,
        "Context" -> ctx,
        "ContextText" -> ctxText,
        "State" -> st
      ][h]
    ]
  ]
];

Options[ApplyFormulaTransform] = {
  "Direction" -> "Auto",
  "Part" -> "Whole",
  "Parameters" -> <||>,
  "Assumptions" -> True,
  "AssumptionsText" -> "",
  "Context" -> <||>,
  "ContextText" -> "",
  "State" -> <|"Head" -> "FormulaTransformState", "Obligations" -> {}, "Trace" -> {}|>
};

Options[PlanFormulaTransform] = Options[ApplyFormulaTransform];
Options[PlanFormulaTransformParts] = Options[ApplyFormulaTransform];

ApplyFormulaTransform[rule_String, opts : OptionsPattern[]][held_HoldComplete] := Module[
  {compiled, part, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace, selection, selected, result},
  compiled = FTResolveTransform[rule];
  If[! AssociationQ[compiled], Return[FTFailure["UnsupportedRule", "Unknown formula transform rule: " <> rule]]];
  part = OptionValue["Part"];
  direction = OptionValue["Direction"];
  parameters = OptionValue["Parameters"];
  assumptions = OptionValue["Assumptions"];
  assumptionsText = OptionValue["AssumptionsText"];
  context = OptionValue["Context"];
  contextText = OptionValue["ContextText"];
  state = OptionValue["State"];
  trace = FTAppendTrace[Lookup[state, "Trace", {}], "ParseHeld", <|"Rule" -> rule, "Part" -> part|>];
  selection = FTSelectPart[held, part, parameters, state, trace];
  If[Lookup[selection, "Status", ""] === "Failure", Return[selection]];
  selected = Lookup[selection, "Selected"];
  result = FTApplyRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, Lookup[selection, "Trace", trace]];
  If[AssociationQ[result] && Lookup[result, "Status", ""] === "Success",
    result = Join[
      result,
      <|
        "Original" -> Lookup[selection, "Original"],
        "Selected" -> selected,
        "Part" -> Lookup[selection, "Part"],
        "PartPath" -> Lookup[selection, "PartPath"]
      |>
    ]
  ];
  result
];

ApplyFormulaTransform[rule_String, opts : OptionsPattern[]][expr_] := ApplyFormulaTransform[rule, opts][HoldComplete[expr]];

PlanFormulaTransform[rule_String, opts : OptionsPattern[]][held_HoldComplete] := Module[
  {compiled, part, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace, selection, selected, result},
  compiled = FTResolveTransform[rule];
  If[! AssociationQ[compiled], Return[FTFailure["UnsupportedRule", "Unknown formula transform rule: " <> rule]]];
  part = OptionValue["Part"];
  direction = OptionValue["Direction"];
  parameters = OptionValue["Parameters"];
  assumptions = OptionValue["Assumptions"];
  assumptionsText = OptionValue["AssumptionsText"];
  context = OptionValue["Context"];
  contextText = OptionValue["ContextText"];
  state = OptionValue["State"];
  trace = FTAppendTrace[Lookup[state, "Trace", {}], "PlanParseHeld", <|"Rule" -> rule, "Part" -> part|>];
  selection = FTSelectPart[held, part, parameters, state, trace];
  If[Lookup[selection, "Status", ""] === "Failure", Return[selection]];
  selected = Lookup[selection, "Selected"];
  result = FTPlanRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, Lookup[selection, "Trace", trace]];
  If[AssociationQ[result] && Lookup[result, "Status", ""] === "Success",
    result = Join[
      result,
      <|
        "Original" -> Lookup[selection, "Original"],
        "Selected" -> selected,
        "Part" -> Lookup[selection, "Part"],
        "PartPath" -> Lookup[selection, "PartPath"]
      |>
    ]
  ];
  result
];

PlanFormulaTransform[rule_String, opts : OptionsPattern[]][expr_] := PlanFormulaTransform[rule, opts][HoldComplete[expr]];

FTPlanPartCandidates[held_HoldComplete, spec_Association] := Module[
  {whole, positions, matches, mode, target},
  whole = First[List @@ held];
  mode = Lookup[spec, "Mode", "Expression"];
  target = Lookup[spec, "Target", Missing["NoTarget"]];
  positions = Rest /@ Position[held, _, {1, Infinity}, Heads -> False];
  matches = Select[positions, FTExpressionMatchesSelectionQ[Extract[whole, #], spec] &];
  <|
    "Original" -> whole,
    "TargetSelection" -> target,
    "TargetSelectionMode" -> mode,
    "Candidates" -> (<|"Part" -> ToString[#, InputForm, PageWidth -> Infinity], "PartPath" -> #, "Expression" -> Extract[whole, #], "ExpressionInputForm" -> ToString[Extract[whole, #], InputForm, PageWidth -> Infinity]|> & /@ matches)
  |>
];

PlanFormulaTransformParts[rule_String, opts : OptionsPattern[]][held_HoldComplete] := Module[
  {compiled, hasRule, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace, spec, candidatePlan, data, candidates},
  hasRule = StringTrim[rule] =!= "";
  compiled = If[hasRule, FTResolveTransform[rule], Missing["NoRule"]];
  If[hasRule && ! AssociationQ[compiled], Return[FTFailure["UnsupportedRule", "Unknown formula transform rule: " <> rule]]];
  direction = OptionValue["Direction"];
  parameters = OptionValue["Parameters"];
  assumptions = OptionValue["Assumptions"];
  assumptionsText = OptionValue["AssumptionsText"];
  context = OptionValue["Context"];
  contextText = OptionValue["ContextText"];
  state = OptionValue["State"];
  trace = FTAppendTrace[Lookup[state, "Trace", {}], "PlanPartsParseHeld", <|"Rule" -> rule|>];
  spec = FTTargetSelectionSpec[parameters];
  If[spec === $Failed,
    Return[FTFailure["InvalidRequest", "plan_parts requires parameters.targetRelation or parameters.targetPattern.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  data = FTPlanPartCandidates[held, spec];
  candidates = Lookup[data, "Candidates", {}];
  If[hasRule,
    candidates = Map[
      Function[candidate,
        candidatePlan = FTPlanRule[compiled, Lookup[candidate, "Expression"], direction, parameters, assumptions, assumptionsText, context, contextText, state, trace];
        Join[
          candidate,
          <|
            "Applicable" -> TrueQ[AssociationQ[candidatePlan] && Lookup[candidatePlan, "Status", ""] === "Success"],
            "PlanPreview" -> candidatePlan
          |>
        ]
      ],
      candidates
    ]
  ];
  FTSuccess[<|
    "Kind" -> "FormulaTransformPartPlan",
    "Rule" -> rule,
    "Direction" -> direction,
    "Original" -> Lookup[data, "Original"],
    "TargetSelection" -> Lookup[data, "TargetSelection"],
    "TargetSelectionMode" -> Lookup[data, "TargetSelectionMode"],
    "CandidateCount" -> Length[candidates],
    "Candidates" -> candidates,
    "RegistryMutation" -> False,
    "Trace" -> FTAppendTrace[trace, "PlanPartCandidates", <|"CandidateCount" -> Length[candidates], "TargetSelectionMode" -> Lookup[data, "TargetSelectionMode"]|>],
    "Conditions" -> <|"Discovered" -> {}, "Discharged" -> {}, "Deferred" -> {}, "Contradicted" -> {}|>,
    "Obligations" -> {},
    "State" -> state
  |>]
];

PlanFormulaTransformParts[rule_String, opts : OptionsPattern[]][expr_] := PlanFormulaTransformParts[rule, opts][HoldComplete[expr]];

FTApplyRule[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], family = ToLowerCase[Lookup[compiled, "Family", ""]], effectiveName, runtime},
  effectiveName = ToLowerCase[name];
  runtime = Lookup[compiled, "Runtime", ""];
  Which[
    Lookup[compiled, "RegistryKind", ""] === "EstimateSeed",
      FTPlanEstimateSeed[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    Lookup[compiled, "RegistryKind", ""] === "StructuralTransform",
      FTPlanStructuralTransform[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    runtime === "GenericTemplate" && FTTargetRelationText[parameters] === "" && !(effectiveName === "cauchyschwarz" || effectiveName === "cauchy-schwarz" || StringContainsQ[family, "holder"]),
      FTApplyGenericTemplateRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    effectiveName === "cauchyschwarz" || effectiveName === "cauchy-schwarz" || StringContainsQ[family, "holder"],
      FTApplyHolderLike[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    effectiveName === "young" || StringContainsQ[family, "young"] || StringContainsQ[family, "pointwise-product"],
      FTApplyYoung[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    effectiveName === "integrationbyparts" || StringContainsQ[family, "integration"],
      FTApplyIntegrationByParts[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    True,
      FTFailure["CompilerPrimitiveMissing", "No runtime primitive exists for compiled rule family: " <> family, <|"Trace" -> trace, "State" -> state|>]
  ]
];

FTPlanRule[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], family = ToLowerCase[Lookup[compiled, "Family", ""]], effectiveName, runtime},
  effectiveName = ToLowerCase[name];
  runtime = Lookup[compiled, "Runtime", ""];
  Which[
    Lookup[compiled, "RegistryKind", ""] === "EstimateSeed",
      FTPlanEstimateSeed[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    Lookup[compiled, "RegistryKind", ""] === "StructuralTransform",
      FTPlanStructuralTransform[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    runtime === "GenericTemplate" && FTTargetRelationText[parameters] === "" && !(effectiveName === "cauchyschwarz" || effectiveName === "cauchy-schwarz" || StringContainsQ[family, "holder"]),
      FTPlanGenericTemplateRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    effectiveName === "cauchyschwarz" || effectiveName === "cauchy-schwarz" || StringContainsQ[family, "holder"],
      FTPlanHolderTarget[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    effectiveName === "young" || StringContainsQ[family, "young"] || StringContainsQ[family, "pointwise-product"],
      FTPlanYoungTarget[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    True,
      FTSuccess[<|
        "Kind" -> "FormulaTransformPlan",
        "Rule" -> name,
        "Direction" -> direction,
        "Original" -> selected,
        "Selected" -> selected,
        "TargetGuided" -> False,
        "RegistryMutation" -> False,
        "PlanStatus" -> "NoTargetPlanner",
        "Message" -> "No target-guided planner is implemented for this rule family yet.",
        "Trace" -> FTAppendTrace[trace, "PlanNoTargetPlanner", <|"Rule" -> name|>],
        "Conditions" -> <|"Discovered" -> {}, "Discharged" -> {}, "Deferred" -> {}, "Contradicted" -> {}|>,
        "Obligations" -> {},
        "State" -> state
      |>]
  ]
];

FTTargetText[parameters_Association] := Module[{target},
  target = Lookup[parameters, "targetRelation", Lookup[parameters, "targetPattern", ""]];
  If[StringQ[target], StringTrim[target], ""]
];

FTTargetRelationText[parameters_Association] := Module[{target},
  target = Lookup[parameters, "targetRelation", ""];
  If[StringQ[target], StringTrim[target], ""]
];

FTTargetPatternText[parameters_Association] := Module[{target},
  target = Lookup[parameters, "targetPattern", ""];
  If[StringQ[target], StringTrim[target], ""]
];

FTTerms[expr_Plus] := List @@ expr;
FTTerms[expr_] := {expr};

FTExpressionFactors[expr_Times] := List @@ expr;
FTExpressionFactors[expr_] := {expr};

FTParsePartPath[part_String] := Module[{text, parsed},
  text = StringTrim[part];
  Which[
    text === "" || text === "Whole",
      {},
    StringMatchQ[text, DigitCharacter..],
      {ToExpression[text, InputForm]},
    StringMatchQ[text, DigitCharacter.. ~~ ("," ~~ DigitCharacter..)..],
      ToExpression["{" <> text <> "}", InputForm],
    StringStartsQ[text, "{"] && StringEndsQ[text, "}"],
      parsed = Quiet@Check[ToExpression[text, InputForm], $Failed];
      If[VectorQ[parsed, IntegerQ], parsed, $Failed],
    True,
      $Failed
  ]
];

FTNamedPartPath[part_String, parameters_Association] := Module[
  {text = StringTrim[part], name, named, raw, path},
  If[! StringStartsQ[text, "Named:" | "Name:"], Return[$Failed]];
  name = StringTrim@StringReplace[text, StartOfString ~~ ("Named:" | "Name:") -> ""];
  If[name === "", Return[Missing["NoName"]]];
  named = Lookup[parameters, "namedParts", <||>];
  If[! AssociationQ[named], Return[Missing["NamedPartsMissing"]]];
  raw = Lookup[named, name, Missing["NamedPartNotFound"]];
  If[MatchQ[raw, Missing[_]], Return[raw]];
  path = Which[
    StringQ[raw], FTParsePartPath[raw],
    IntegerQ[raw], {raw},
    ListQ[raw] && AllTrue[raw, IntegerQ], raw,
    AssociationQ[raw] && KeyExistsQ[raw, "path"] && StringQ[Lookup[raw, "path"]], FTParsePartPath[Lookup[raw, "path"]],
    AssociationQ[raw] && KeyExistsQ[raw, "path"] && ListQ[Lookup[raw, "path"]] && AllTrue[Lookup[raw, "path"], IntegerQ], Lookup[raw, "path"],
    True, $Failed
  ];
  If[path === $Failed, Missing["InvalidNamedPartPath"], <|"Name" -> name, "PartPath" -> path|>]
];

FTTargetSelectionSpec[parameters_Association] := Module[{patternText, relationText, targetText, target},
  patternText = FTTargetPatternText[parameters];
  If[patternText =!= "",
    target = FTParseMaybeExpression[patternText];
    If[target === $Failed, Return[$Failed]];
    Return[<|"Mode" -> "Pattern", "Text" -> patternText, "Target" -> target|>]
  ];
  relationText = FTTargetRelationText[parameters];
  targetText = If[relationText === "", FTTargetText[parameters], relationText];
  If[targetText === "", Return[$Failed]];
  target = FTParseMaybeExpression[targetText];
  If[target === $Failed, Return[$Failed]];
  If[MatchQ[target, LessEqual[_, __] | GreaterEqual[_, __] | Equal[_, __]],
    <|"Mode" -> "Expression", "Text" -> targetText, "Target" -> First[List @@ target]|>,
    <|"Mode" -> "Expression", "Text" -> targetText, "Target" -> target|>
  ]
];

FTEquivalentExpressionQ[a_, b_] := TrueQ[SameQ[Unevaluated[a], Unevaluated[b]]] ||
  TrueQ[Quiet@Check[Simplify[a == b], False]];

FTExpressionMatchesSelectionQ[expr_, spec_Association] := Module[{mode = Lookup[spec, "Mode", "Expression"], target = Lookup[spec, "Target", $Failed]},
  If[target === $Failed, Return[False]];
  Switch[mode,
    "Pattern",
      TrueQ[Quiet@Check[MatchQ[expr, target], False]],
    _,
      FTEquivalentExpressionQ[expr, target]
  ]
];

FTSelectPart[held_HoldComplete, part_, parameters_Association, state_Association, trace_List] := Module[
  {whole, partText, path, selected, spec, positions, matches, candidateData, namedPath},
  whole = First[List @@ held];
  partText = If[StringQ[part], StringTrim[part], ToString[part, InputForm, PageWidth -> Infinity]];
  If[partText === "" || partText === "Whole",
    Return[<|"Status" -> "Success", "Original" -> whole, "Selected" -> whole, "Part" -> "Whole", "PartPath" -> {}, "Trace" -> FTAppendTrace[trace, "SelectPart", <|"Part" -> "Whole", "PartPath" -> {}|>]|>]
  ];
  If[partText === "Auto",
    spec = FTTargetSelectionSpec[parameters];
    If[spec === $Failed,
      Return[FTFailure["AmbiguousPart", "part=Auto requires parameters.targetRelation or parameters.targetPattern.", <|"Trace" -> trace, "State" -> state|>]]
    ];
    positions = Rest /@ Position[held, _, {1, Infinity}, Heads -> False];
    matches = Select[positions, FTExpressionMatchesSelectionQ[Extract[whole, #], spec] &];
    If[matches === {},
      Return[FTFailure["AmbiguousPart", "part=Auto could not find a subexpression matching the target lhs/pattern.", <|"Trace" -> trace, "State" -> state, "TargetSelection" -> Lookup[spec, "Target"], "TargetSelectionMode" -> Lookup[spec, "Mode", "Expression"]|>]]
    ];
    If[Length[matches] > 1,
      candidateData = <|"Path" -> #, "Expression" -> Extract[whole, #]|> & /@ matches;
      Return[FTFailure["AmbiguousPart", "part=Auto matched more than one subexpression; pass an explicit part path.", <|"Trace" -> trace, "State" -> state, "TargetSelection" -> Lookup[spec, "Target"], "TargetSelectionMode" -> Lookup[spec, "Mode", "Expression"], "Candidates" -> candidateData|>]]
    ];
    path = First[matches];
    selected = Extract[whole, path];
    Return[<|"Status" -> "Success", "Original" -> whole, "Selected" -> selected, "Part" -> "Auto", "PartPath" -> path, "Trace" -> FTAppendTrace[trace, "SelectPart", <|"Part" -> "Auto", "PartPath" -> path, "TargetSelection" -> Lookup[spec, "Target"], "TargetSelectionMode" -> Lookup[spec, "Mode", "Expression"]|>]|>]
  ];
  namedPath = FTNamedPartPath[partText, parameters];
  If[AssociationQ[namedPath],
    path = Lookup[namedPath, "PartPath"];
    selected = Quiet@Check[Extract[whole, path], $Failed];
    If[selected === $Failed,
      Return[FTFailure["AmbiguousPart", "named part path does not select a valid subexpression.", <|"Trace" -> trace, "State" -> state, "Part" -> partText, "NamedPart" -> Lookup[namedPath, "Name"], "PartPath" -> path|>]]
    ];
    Return[<|"Status" -> "Success", "Original" -> whole, "Selected" -> selected, "Part" -> partText, "NamedPart" -> Lookup[namedPath, "Name"], "PartPath" -> path, "Trace" -> FTAppendTrace[trace, "SelectNamedPart", <|"Part" -> partText, "NamedPart" -> Lookup[namedPath, "Name"], "PartPath" -> path|>]|>]
  ];
  If[MatchQ[namedPath, Missing[_]],
    Return[FTFailure["AmbiguousPart", "named part selector could not be resolved from parameters.namedParts.", <|"Trace" -> trace, "State" -> state, "Part" -> partText, "Reason" -> namedPath|>]]
  ];
  path = FTParsePartPath[partText];
  If[path === $Failed,
    Return[FTFailure["AmbiguousPart", "part must be Whole, Auto, an integer path like 2, or a list path like {1,2}.", <|"Trace" -> trace, "State" -> state, "Part" -> partText|>]]
  ];
  selected = Quiet@Check[Extract[whole, path], $Failed];
  If[selected === $Failed,
    Return[FTFailure["AmbiguousPart", "part path does not select a valid subexpression.", <|"Trace" -> trace, "State" -> state, "Part" -> partText, "PartPath" -> path|>]]
  ];
  <|"Status" -> "Success", "Original" -> whole, "Selected" -> selected, "Part" -> partText, "PartPath" -> path, "Trace" -> FTAppendTrace[trace, "SelectPart", <|"Part" -> partText, "PartPath" -> path|>]|>
];

FTQuadraticCoefficient[term_, var_] := Module[{coeff},
  coeff = Quiet@Check[Simplify[term/(var^2)], $Failed];
  If[coeff === $Failed || AnyTrue[FTExpressionFactors[var], ! FreeQ[coeff, #] &], Missing["NotQuadratic"], coeff]
];

FTProductCoefficient[selected_, left_, right_] := Module[{coeff},
  coeff = Quiet@Check[Simplify[selected/(left * right)], $Failed];
  If[coeff === $Failed || ! FreeQ[coeff, left] || ! FreeQ[coeff, right], Missing["NoCoefficient"], coeff]
];

FTYoungParseTargetRelation[targetText_String] := Module[{target},
  target = FTParseMaybeExpression[targetText];
  If[MatchQ[target, LessEqual[_, _]], <|"Target" -> target, "LHS" -> First[List @@ target], "RHS" -> Last[List @@ target]|>, Missing["InvalidTargetRelation"]]
];

FTYoungMatchTargetLHS[target_Association, selected_] :=
  TrueQ[Quiet@Check[Simplify[Lookup[target, "LHS"] == selected], False]];

FTYoungExtractProductFactors[selected_] := Module[{factors, flatFactors},
  factors = FTProductFactors[selected];
  If[factors === $Failed, Return[Missing["NoProductFactors"]]];
  flatFactors = If[Head[selected] === Times, List @@ selected, List @@ Times @@ factors];
  <|"Factors" -> factors, "FlatFactors" -> flatFactors|>
];

FTYoungInferAbsorbedQuadraticFactor[rhs_, flatFactors_List, absorbParam_] := Module[
  {terms, allCandidates, candidates},
  terms = FTTerms[rhs];
  allCandidates = DeleteCases[
    Table[
      With[{qcoeffs = DeleteMissing[FTQuadraticCoefficient[#, factor] & /@ terms]},
        If[qcoeffs === {}, Nothing, <|"Factor" -> factor, "Coefficient" -> First[qcoeffs]|>]
      ],
      {factor, flatFactors}
    ],
    Nothing
  ];
  candidates = allCandidates;
  If[absorbParam =!= $Failed,
    candidates = Select[candidates, TrueQ[Quiet@Check[Simplify[Lookup[#, "Factor"] == absorbParam], False]] &]
  ];
  If[candidates === {}, Return[Missing["NoAbsorbedQuadraticFactor"]]];
  Join[First[candidates], <|"AllCandidates" -> allCandidates, "Terms" -> terms|>]
];

FTYoungInferResidualFactor[selected_, flatFactors_List, allCandidates_List, absorb_] := Module[
  {residualCandidates},
  residualCandidates = Select[allCandidates, ! TrueQ[Quiet@Check[Simplify[Lookup[#, "Factor"] == absorb], False]] &];
  If[residualCandidates === {},
    Times @@ DeleteCases[flatFactors, absorb, {1}, 1],
    Lookup[First[residualCandidates], "Factor"]
  ]
];

FTYoungComputeProductCoefficient[selected_, absorb_, residual_] :=
  FTProductCoefficient[selected, absorb, residual];

FTYoungBuildResidualCoefficientCondition[terms_List, residual_, coeff_, theta_] := Module[
  {residualTarget, residualRequired},
  residualTarget = DeleteMissing[FTQuadraticCoefficient[#, residual] & /@ terms];
  residualRequired = coeff^2/(4 theta);
  <|
    "ResidualTarget" -> residualTarget,
    "ResidualRequired" -> residualRequired,
    "Condition" -> If[residualTarget === {}, True, First[residualTarget] >= residualRequired]
  |>
];

FTPrimitiveHeadQ[head_, name_String] := Module[{symbolName},
  symbolName = Quiet@Check[SymbolName[Unevaluated[head]], ""];
  symbolName === name || symbolName === "FTTemplate" <> name
];

FTIBPBoundaryTerm[u_, v_, {x_, a_, b_}] := u[b] * (v /. x -> b) - u[a] * (v /. x -> a);
FTIBPBoundaryTerm[u_, v_, domain_] := Inactive[BoundaryTerm][u, v, domain];

FTIBPInteriorIntegral[u_, v_, {x_, a_, b_}] := Inactive[Integrate][u[x] * D[v, x], {x, a, b}];
FTIBPInteriorIntegral[u_, v_, domain_] := Inactive[IBPIntegral][u, v, domain];

FTPrimitiveEvaluate[expr_] := FixedPoint[
  ReplaceAll[
    #,
    {
      FTTemplateNormalizeQuotient[quotientExpr_, quotientFactor_] :> Quiet@Check[Simplify[quotientExpr/quotientFactor], quotientExpr/quotientFactor],
      h_[f_, lp_[p_, domain_]] /; FTPrimitiveHeadQ[h, "Norm"] && FTPrimitiveHeadQ[lp, "Lp"] :> Inactive[Norm][f, "L" <> ToString[p, InputForm], domain],
      h_[f_, lq_[q_, domain_]] /; FTPrimitiveHeadQ[h, "Norm"] && FTPrimitiveHeadQ[lq, "Lq"] :> Inactive[Norm][f, "L" <> ToString[q, InputForm], domain],
      h_[f_] /; FTPrimitiveHeadQ[h, "Grad"] :> Inactive[Grad][f],
      h_[a_, b_] /; FTPrimitiveHeadQ[h, "Product"] :> Inactive[Times][a, b],
      h_[body_, domain_] /; FTPrimitiveHeadQ[h, "Integral"] :> Inactive[Integrate][body, domain],
      h_[body_, domain_] /; FTPrimitiveHeadQ[h, "Sum"] :> Inactive[Sum][body, domain],
      h_[body_, var_] /; FTPrimitiveHeadQ[h, "D"] :> Inactive[D][body, var],
      h_[f_, p_, domain_] /; FTPrimitiveHeadQ[h, "NormIntegral"] :> Inactive[Power][Inactive[Integrate][Abs[f]^p, domain], 1/p],
      h_[f_, p_, domain_] /; FTPrimitiveHeadQ[h, "NormSum"] :> Inactive[Power][Inactive[Sum][Abs[f]^p, domain], 1/p],
      h_[epsilon_, p_, q_] /; FTPrimitiveHeadQ[h, "YoungConstant"] :> Inactive[YoungConstant][epsilon, p, q],
      h_[term_] /; FTPrimitiveHeadQ[h, "BoundaryTerm"] :> Inactive[BoundaryTerm][term],
      h_[u_, v_, domain_] /; FTPrimitiveHeadQ[h, "BoundaryTerm"] :> FTIBPBoundaryTerm[u, v, domain],
      h_[u_, v_, domain_] /; FTPrimitiveHeadQ[h, "IBPIntegral"] :> FTIBPInteriorIntegral[u, v, domain],
      h_[f_, space_] /; FTPrimitiveHeadQ[h, "FunctionSpace"] :> Inactive[FunctionSpace][f, space],
      h_[x_] /; FTPrimitiveHeadQ[h, "RealValued"] :> Inactive[RealValued][x],
      h_[x_] /; FTPrimitiveHeadQ[h, "Nonnegative"] :> x >= 0,
      h_[normalizeExpr_, normalizeFactor_] /; FTPrimitiveHeadQ[h, "NormalizeQuotient"] :> Quiet@Check[Simplify[normalizeExpr/normalizeFactor], normalizeExpr/normalizeFactor],
      h_[f_, domain_] /; FTPrimitiveHeadQ[h, "Measurable"] :> Inactive[Measurable][f, domain],
      h_[exprs_, domain_] /; FTPrimitiveHeadQ[h, "MeasurableIntegrable"] :> Inactive[MeasurableIntegrable][exprs, domain],
      h_[expr_] /; FTPrimitiveHeadQ[h, "Regularity"] :> Inactive[Regularity][expr],
      h_[expr_, domain_] /; FTPrimitiveHeadQ[h, "BoundaryTrace"] :> Inactive[BoundaryTrace][expr, domain],
      h_[expr_, domain_] /; FTPrimitiveHeadQ[h, "ZeroMean"] :> Inactive[ZeroMean][expr, domain],
      h_[domain_] /; FTPrimitiveHeadQ[h, "BoundedLipschitzDomain"] :> Inactive[BoundedLipschitzDomain][domain],
      h_[p_, domain_] /; FTPrimitiveHeadQ[h, "Lp"] :> Inactive[Lp][p, domain],
      h_[domain_] /; FTPrimitiveHeadQ[h, "L2"] :> Inactive[Lp][2, domain],
      h_[domain_] /; FTPrimitiveHeadQ[h, "RegularEnoughForIBP"] :> Inactive[RegularEnoughForIBP][domain]
    }
  ] &,
  expr
];

FTEvaluateTemplate[template_String, bindings_Association] := Module[
  {keys, text = template, tempRules = {}, directRules = {}, symbol, expr, primitiveNames},
  keys = Reverse@SortBy[Keys[bindings], StringLength[ToString[#]] &];
  Do[
    symbol = Unique["ftTemplate$" <> ToString[key] <> "$"];
    text = StringReplace[text, "$" <> ToString[key] -> SymbolName[symbol]];
    AppendTo[tempRules, symbol -> Lookup[bindings, key]];
    If[MemberQ[{"p", "q", "epsilon"}, ToString[key]],
      AppendTo[directRules, Symbol[ToString[key]] -> Lookup[bindings, key]]
    ],
    {key, keys}
  ];
  primitiveNames = {
    "Product", "Integral", "Sum", "NormIntegral", "NormSum", "YoungConstant",
    "BoundaryTerm", "IBPIntegral", "FunctionSpace", "RealValued",
    "Nonnegative", "Measurable", "MeasurableIntegrable", "Regularity", "BoundaryTrace", "ZeroMean", "BoundedLipschitzDomain", "Lp", "L2", "RegularEnoughForIBP", "D",
    "NormalizeQuotient", "NormalizationFactorNonzero", "Norm", "Grad", "Lq"
  };
  Do[
    text = StringReplace[text, RegularExpression["\\b" <> primitive <> "\\["] -> "FTTemplate" <> primitive <> "["],
    {primitive, primitiveNames}
  ];
  expr = Quiet@Check[ToExpression[text, InputForm], $Failed];
  If[expr === $Failed, Return[$Failed]];
  FTPrimitiveEvaluate[expr /. tempRules /. directRules]
];

FTEvaluateTemplate[template_Association, bindings_Association] := Module[
  {predicate, kind, args, evalArgs},
  predicate = Lookup[template, "predicate"];
  kind = Lookup[template, "kind"];
  If[MissingQ[predicate] && MissingQ[kind], Return[template]];
  args = Lookup[template, "arguments", Lookup[template, "args", {}]];
  evalArgs = FTEvaluateTemplate[#, bindings] & /@ args;
  
  If[!MissingQ[predicate],
    Which[
      predicate === "BoundaryTerm", Inactive[BoundaryTerm] @@ evalArgs,
      predicate === "IBPIntegral", Inactive[IBPIntegral] @@ evalArgs,
      predicate === "FunctionSpace",
        If[Length[evalArgs] >= 2,
          Inactive[FunctionSpace][evalArgs[[1]], evalArgs[[2]]],
          template
        ],
      True, template
    ],
    Which[
      kind === "Lp", Inactive[Lp] @@ evalArgs,
      kind === "L2", Inactive[Lp][2, evalArgs[[1]]],
      kind === "RegularEnoughForIBP", Inactive[RegularEnoughForIBP] @@ evalArgs,
      kind === "BoundaryTerm", Inactive[BoundaryTerm] @@ evalArgs,
      kind === "IBPIntegral", Inactive[IBPIntegral] @@ evalArgs,
      True, template
    ]
  ]
];

FTEvaluateTemplate[list_List, bindings_Association] := FTEvaluateTemplate[#, bindings] & /@ list;

FTEvaluateTemplate[value_, bindings_Association] := value;

FTApplyGenericStructuralTransform[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], bindings, derived, orientations, orientation, relationHead, lhs, rhs, relation, conditionTemplates, conditions, discharged, state2, trace2, normalized, reduced, boundaryTerm},
  bindings = FTGenericMatcherBindings[compiled, selected, parameters];
  If[bindings === $Failed,
    Return[FTFailure["Inapplicable", name <> " generic structural matcher did not match the selected expression.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  derived = Lookup[compiled, "DerivedBindings", <||>];
  If[AssociationQ[derived],
    Do[
      bindings = Join[bindings, <|key -> FTEvaluateTemplate[Lookup[derived, key], bindings]|>],
      {key, Keys[derived]}
    ]
  ];
  orientations = Select[
    Lookup[compiled, "Orientations", {}],
    Lookup[#, "direction", "Equal"] === "Equal" || Lookup[#, "direction", "Equal"] === "Auto" &
  ];
  If[orientations === {},
    Return[FTFailure["DirectionUnavailable", "No JSON structural orientation is available for rule " <> name <> ".", <|"Trace" -> trace, "State" -> state|>]]
  ];
  orientation = First[orientations];
  relationHead = Lookup[orientation, "relation", "Equal"];
  If[relationHead =!= "Equal",
    Return[FTFailure["CompilerPrimitiveMissing", "Structural JSON orientations currently support relation=Equal only.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  lhs = FTEvaluateTemplate[Lookup[orientation, "lhs", "$selected"], bindings];
  rhs = FTEvaluateTemplate[Lookup[orientation, "rhs", "$selected"], bindings];
  relation = Equal[lhs, rhs];
  normalized = Lookup[bindings, "normalized", Missing["NotApplicable"]];
  reduced = Lookup[bindings, "reduced", Missing["NotApplicable"]];
  boundaryTerm = Lookup[bindings, "boundaryTerm", Missing["NotApplicable"]];
  trace2 = FTAppendTrace[trace, "ApplyGenericStructuralTransform", <|"Rule" -> name, "Matcher" -> Lookup[bindings, "Matcher", ""], "Orientation" -> Lookup[orientation, "name", ""]|>];
  conditionTemplates = Join[Lookup[compiled, "Conditions", {}], Lookup[orientation, "conditions", {}]];
  conditions = Join[
    {FTRegularityCondition[selected, name]},
    FTCompiledCondition[#, bindings, name] & /@ conditionTemplates
  ];
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, <||>, contextText];
  If[Length[Lookup[discharged, "Contradicted", {}]] > 0,
    Return[FTFailure["AssumptionContradiction", "Assumptions contradict a generated structural transform condition.", <|"Conditions" -> discharged, "Trace" -> trace2, "State" -> state|>]]
  ];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Kind" -> "FormulaTransform",
    "RegistryKind" -> "StructuralTransform",
    "Runtime" -> "GenericStructural",
    "Rule" -> name,
    "Direction" -> "Equal",
    "Original" -> selected,
    "Selected" -> selected,
    "Relation" -> relation,
    "RelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "RelationLatex" -> Quiet@Check[ToString[TeXForm[relation], PageWidth -> Infinity], ""],
    "NormalizedExpression" -> normalized,
    "ReducedExpression" -> reduced,
    "BoundaryTerm" -> boundaryTerm,
    "Trace" -> FTAppendTrace[trace2, "BuildRelation", <|"Direction" -> "Equal"|>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTPlanStructuralTransform[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {runtime},
  If[direction =!= "Auto" && direction =!= "Equal",
    Return[FTFailure["DirectionUnavailable", "Structural transforms are equality transforms; use direction=Equal or Auto.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  runtime = Lookup[compiled, "Runtime", Lookup[compiled, "Name", ""]];
  Switch[runtime,
    "GenericStructural",
      Return[FTApplyGenericStructuralTransform[compiled, selected, direction, parameters, assumptions, assumptionsText, contextText, state, trace]],
    _,
      Return[FTFailure["CompilerPrimitiveMissing", "No structural transform runtime exists for: " <> runtime, <|"Trace" -> trace, "State" -> state|>]]
  ];
  FTFailure["CompilerPrimitiveMissing", "No structural transform runtime exists for: " <> runtime, <|"Trace" -> trace, "State" -> state|>]
];

FTPrepareParameterExpressionBindings[compiled_Association, base_Association] := Module[
  {keys = Lookup[compiled, "ParameterExpressions", {}], result = base, key, value, parsed},
  If[! ListQ[keys], Return[$Failed]];
  Do[
    If[KeyExistsQ[result, key],
      value = Lookup[result, key];
      If[StringQ[value],
        parsed = FTParseMaybeExpression[value];
        If[parsed === $Failed, Return[$Failed]];
        result = Join[result, <|key -> parsed|>]
      ]
    ],
    {key, keys}
  ];
  result
];

FTGenericMatcherBindings[compiled_Association, selected_, parameters_Association] := Module[
  {matchers, defaults, base, matcher, body, kind, slots, parts, factors, operator, domainSlot, varSlot, result = $Failed, integrand, derivU, var, companion, terms, first, second},
  matchers = Lookup[compiled, "Matchers", {}];
  defaults = Lookup[compiled, "ParameterDefaults", <||>];
  base = Join[defaults, parameters, <|"selected" -> selected|>];
  base = FTPrepareParameterExpressionBindings[compiled, base];
  If[base === $Failed, Return[$Failed]];
  Do[
    body = Lookup[matcher, "body", <||>];
    kind = Lookup[body, "kind", ""];
    slots = Lookup[body, "slots", {}];
    operator = Lookup[matcher, "operator", ""];
    domainSlot = Lookup[matcher, "domainSlot", "domain"];
    varSlot = Lookup[matcher, "varSlot", "var"];
    Which[
      (kind === "Whole" || kind === "Selected") && Length[slots] === 0,
        result = Join[base, <|"Matcher" -> Lookup[matcher, "name", kind]|>],
      kind === "Product" && operator === "" && Length[slots] === 2,
        factors = FTProductFactors[selected];
        If[factors =!= $Failed,
          result = Join[base, AssociationThread[slots -> factors], <|"Matcher" -> Lookup[matcher, "name", "Product"]|>]
        ],
      kind === "Product" && (operator === "Integral" || operator === "Sum") && Length[slots] === 2,
        parts = If[operator === "Integral", FTIntegralParts[selected], FTSumParts[selected]];
        If[parts =!= $Failed,
          factors = FTProductFactors[First[parts]];
          If[factors =!= $Failed,
            result = Join[base, AssociationThread[slots -> factors], <|domainSlot -> parts[[2]], "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", operator <> "Product"]|>]
          ]
        ],
      kind === "DerivativeProduct" && operator === "Integral" && Length[slots] === 2,
        parts = FTIntegralParts[selected];
        If[parts =!= $Failed,
          integrand = First[parts];
          If[MatchQ[integrand, Derivative[1][_][_] * _],
            integrand /. Derivative[1][uu_][xx_] * vv_ :> (derivU = uu; var = xx; companion = vv);
            result = Join[
              base,
              AssociationThread[slots -> {derivU, companion}],
              <|domainSlot -> parts[[2]], "DerivativeVariable" -> var, "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", "DerivativeProduct"]|>
            ]
          ]
        ],
      kind === "DerivativeProduct" && operator === "PointwiseDerivative" && Length[slots] === 2,
        If[MatchQ[selected, Inactive[D][_, _]],
          {integrand, var} = List @@ selected;
          factors = FTProductFactors[integrand];
          If[factors =!= $Failed,
            result = Join[
              base,
              AssociationThread[slots -> factors],
              <|varSlot -> var, "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", "PointwiseDerivativeProduct"]|>
            ]
          ]
        ],
      kind === "DerivativeCommutator" && operator === "PointwiseDerivativeCommutator" && Length[slots] === 2,
        terms = FTTerms[selected];
        If[Length[terms] === 2,
          first = SelectFirst[terms, MatchQ[#, Inactive[D][_, _]] &, Missing["NoDerivative"]];
          second = SelectFirst[terms, MatchQ[#, Times[-1, __] | -_] &, Missing["NoSubtractedTerm"]];
          If[MatchQ[first, Inactive[D][_, _]] && ! MatchQ[second, Missing[_]],
            {integrand, var} = List @@ first;
            factors = FTProductFactors[integrand];
            If[factors =!= $Failed,
              Which[
                TrueQ[Quiet@Check[Simplify[second == -factors[[1]] * Inactive[D][factors[[2]], var]], False]],
                  result = Join[
                    base,
                    AssociationThread[slots -> {factors[[1]], factors[[2]]}],
                    <|varSlot -> var, "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", "PointwiseDerivativeCommutator"]|>
                  ],
                TrueQ[Quiet@Check[Simplify[second == -factors[[2]] * Inactive[D][factors[[1]], var]], False]],
                  result = Join[
                    base,
                    AssociationThread[slots -> {factors[[2]], factors[[1]]}],
                    <|varSlot -> var, "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", "PointwiseDerivativeCommutator"]|>
                  ],
                True,
                  Null
              ]
            ]
          ]
        ],
      True,
        Null
    ];
    If[result =!= $Failed, Break[]],
    {matcher, matchers}
  ];
  result
];

FTHeuristicMatcherBindings[heuristic_Association, selected_] := Module[
  {matchers, matcher, operator, bodySlot, domainSlot, parts, result = $Failed},
  matchers = Lookup[heuristic, "Matchers", {}];
  Do[
    operator = Lookup[matcher, "operator", ""];
    bodySlot = Lookup[matcher, "bodySlot", "h"];
    domainSlot = Lookup[matcher, "domainSlot", "domain"];
    Which[
      operator === "Integral",
        parts = FTIntegralParts[selected];
        If[parts =!= $Failed,
          result = <|bodySlot -> parts[[1]], domainSlot -> parts[[2]], "Operator" -> "Integral", "Matcher" -> Lookup[matcher, "name", "IntegralSingleBody"]|>
        ],
      operator === "Sum",
        parts = FTSumParts[selected];
        If[parts =!= $Failed,
          result = <|bodySlot -> parts[[1]], domainSlot -> parts[[2]], "Operator" -> "Sum", "Matcher" -> Lookup[matcher, "name", "SumSingleBody"]|>
        ],
      True,
        Null
    ];
    If[result =!= $Failed, Break[]],
    {matcher, matchers}
  ];
  result
];

FTApplyHeuristicRewrite[heuristic_Association, selected_] := Module[
  {bindings, rewrite, template, rewritten, conditions, name = Lookup[heuristic, "Name", "Heuristic"]},
  bindings = FTHeuristicMatcherBindings[heuristic, selected];
  If[bindings === $Failed, Return[$Failed]];
  rewrite = Lookup[heuristic, "Rewrite", <||>];
  template = Lookup[rewrite, "template", ""];
  If[! StringQ[template] || StringTrim[template] === "", Return[$Failed]];
  rewritten = FTEvaluateTemplate[template, bindings];
  If[rewritten === $Failed, Return[$Failed]];
  conditions = FTCompiledCondition[#, bindings, name] & /@ Lookup[heuristic, "Conditions", {}];
  <|
    "Heuristic" -> name,
    "Status" -> "Applied",
    "Runtime" -> "JSONHeuristic",
    "Matcher" -> Lookup[bindings, "Matcher", ""],
    "Original" -> selected,
    "Rewritten" -> rewritten,
    "Conditions" -> conditions,
    "GeneratedCondition" -> If[conditions === {}, True, Lookup[First[conditions], "Expr", True]]
  |>
];

FTApplyCompatibleHeuristic[compiled_Association, selected_] := Module[
  {ruleName = Lookup[compiled, "Name", ""], compatible, names, heuristic, result = $Failed},
  compatible = Lookup[compiled, "CompatibleHeuristics", {}];
  names = If[compatible === {}, Keys[$FTHeuristicRegistry], compatible];
  Do[
    heuristic = Lookup[$FTHeuristicRegistry, name, Missing["NotFound"]];
    If[AssociationQ[heuristic] && (Lookup[heuristic, "AppliesTo", {}] === {} || MemberQ[Lookup[heuristic, "AppliesTo", {}], ruleName] || MemberQ[Lookup[heuristic, "AppliesTo", {}], "Holder"]),
      result = FTApplyHeuristicRewrite[heuristic, selected];
      If[AssociationQ[result], Break[]]
    ],
    {name, names}
  ];
  result
];

FTHeuristicNames[compiled_Association, parameters_Association] := Module[
  {allowed = Lookup[parameters, "allowedHeuristics", {}], compatible},
  compatible = DeleteCases[Lookup[compiled, "CompatibleHeuristics", {}], "ExplicitProduct"];
  Which[
    ListQ[allowed] && allowed =!= {},
      Select[allowed, MemberQ[compatible, #] || compatible === {} &],
    compatible =!= {},
      compatible,
    True,
      Keys[$FTHeuristicRegistry]
  ]
];

FTHeuristicGoalQ[compiled_Association, expr_, parameters_Association] :=
  AssociationQ[FTGenericMatcherBindings[compiled, expr, parameters]];

FTHeuristicSearch[compiled_Association, selected_, parameters_Association] := Module[
  {maxDepth, names, queue, visited, node, expr, depth, pipeline, key, parts, heuristic, rewrite, rewritten, rewriteKey, counts, maxApplications, searchTree = {}, nodeId = 0, currentId},
  maxDepth = Lookup[parameters, "maxSearchDepth", 1];
  If[! IntegerQ[maxDepth] || maxDepth < 0, maxDepth = 1];
  names = FTHeuristicNames[compiled, parameters];
  queue = {<|"Expr" -> selected, "Depth" -> 0, "Pipeline" -> {}|>};
  visited = <||>;
  While[queue =!= {},
    node = First[queue];
    queue = Rest[queue];
    expr = Lookup[node, "Expr"];
    depth = Lookup[node, "Depth", 0];
    pipeline = Lookup[node, "Pipeline", {}];
    key = ToString[expr, InputForm, PageWidth -> Infinity];
    If[KeyExistsQ[visited, key], Continue[]];
    visited[key] = True;
    nodeId++;
    currentId = nodeId;
    searchTree = Append[searchTree, <|"Node" -> currentId, "Depth" -> depth, "Expression" -> expr, "ExpressionInputForm" -> key, "Pipeline" -> Lookup[#, "Heuristic", ""] & /@ pipeline, "Status" -> "Visited"|>];
    If[depth > 0 && FTHeuristicGoalQ[compiled, expr, parameters],
      parts = FTIntegralParts[expr];
      If[parts === $Failed, parts = FTSumParts[expr]];
      Return[<|
        "Status" -> "Success",
        "Runtime" -> "HeuristicSearch",
        "Original" -> selected,
        "Rewritten" -> expr,
        "Depth" -> depth,
        "VisitedCount" -> Length[Keys[visited]],
        "SearchTree" -> Append[searchTree, <|"Node" -> currentId, "Depth" -> depth, "Expression" -> expr, "ExpressionInputForm" -> key, "Status" -> "GoalMatched"|>],
        "HeuristicPipeline" -> pipeline,
        "Operator" -> If[parts === $Failed, Missing["Unknown"], parts[[3]]]
      |>]
    ];
    If[depth >= maxDepth, Continue[]];
    Do[
      heuristic = Lookup[$FTHeuristicRegistry, name, Missing["NotFound"]];
      If[AssociationQ[heuristic],
        counts = Counts[Lookup[#, "Heuristic", ""] & /@ pipeline];
        maxApplications = Lookup[heuristic, "MaxApplications", 1];
        If[Lookup[counts, name, 0] < maxApplications,
          rewrite = FTApplyHeuristicRewrite[heuristic, expr];
          If[AssociationQ[rewrite],
            rewritten = Lookup[rewrite, "Rewritten"];
            rewriteKey = ToString[rewritten, InputForm, PageWidth -> Infinity];
            If[! KeyExistsQ[visited, rewriteKey],
              searchTree = Append[searchTree, <|"From" -> currentId, "Depth" -> depth + 1, "Heuristic" -> name, "Status" -> "Queued", "Expression" -> rewritten, "ExpressionInputForm" -> rewriteKey|>];
              queue = Append[queue, <|"Expr" -> rewritten, "Depth" -> depth + 1, "Pipeline" -> Append[pipeline, rewrite]|>],
              searchTree = Append[searchTree, <|"From" -> currentId, "Depth" -> depth + 1, "Heuristic" -> name, "Status" -> "AlreadyVisited", "Expression" -> rewritten, "ExpressionInputForm" -> rewriteKey|>]
            ]
            ,
            searchTree = Append[searchTree, <|"From" -> currentId, "Depth" -> depth + 1, "Heuristic" -> name, "Status" -> "NotApplicable"|>]
          ]
        ]
      ],
      {name, names}
    ]
  ];
  <|
    "Status" -> "Failure",
    "Runtime" -> "HeuristicSearch",
    "Original" -> selected,
    "MaxDepth" -> maxDepth,
    "VisitedCount" -> Length[Keys[visited]],
    "SearchTree" -> searchTree,
    "HeuristicNames" -> names
  |>
];

FTCompiledCondition[template_Association, bindings_Association, source_String] := Module[
  {predicate, args, evalArgs, expr, kind, machine, space, spaceExpr},
  predicate = Lookup[template, "predicate"];
  args = Lookup[template, "arguments", {}];
  evalArgs = FTEvaluateTemplate[#, bindings] & /@ args;
  
  expr = Which[
    predicate === "FunctionSpace",
      space = If[Length[evalArgs] >= 2, ToString[evalArgs[[2]]], ""];
      spaceExpr = Which[
        space === "Lp", Inactive[Lp][evalArgs[[3]], evalArgs[[4]]],
        space === "L2", Inactive[Lp][2, evalArgs[[3]]],
        space === "RegularEnoughForIBP", Inactive[RegularEnoughForIBP][evalArgs[[3]]],
        True, If[Length[evalArgs] >= 2, evalArgs[[2]], ""]
      ];
      Inactive[FunctionSpace][evalArgs[[1]], spaceExpr],
    predicate === "Measurable",
      Inactive[Measurable][evalArgs[[1]], evalArgs[[2]]],
    predicate === "RealValued",
      Inactive[RealValued][evalArgs[[1]]],
    predicate === "Regularity",
      Inactive[Regularity][evalArgs[[1]]],
    predicate === "BoundaryCondition" || predicate === "BoundaryTerm",
      Inactive[BoundaryTerm] @@ evalArgs,
    predicate === "ExponentConjugacy",
      1/evalArgs[[1]] + 1/evalArgs[[2]] == 1,
    predicate === "MeasurableIntegrable",
      Inactive[MeasurableIntegrable][evalArgs[[1]], evalArgs[[2]]],
    predicate === "Greater" || predicate === "GreaterThan",
      evalArgs[[1]] > evalArgs[[2]],
    True,
      $Failed
  ];
  
  If[expr === $Failed, Return[FTCondition["TemplateCondition", ToString[template], source, False]]];
  
  kind = Which[
    predicate === "RealValued", "RealValued",
    predicate === "FunctionSpace", "FunctionSpaceMembership",
    predicate === "Measurable", "Measurability",
    predicate === "MeasurableIntegrable", "MeasurabilityIntegrability",
    predicate === "Regularity", "Regularity",
    predicate === "BoundaryCondition" || predicate === "BoundaryTerm", "BoundaryCondition",
    predicate === "ExponentConjugacy", "ExponentConjugacy",
    True, "TemplateCondition"
  ];
  
  machine = kind =!= "BoundaryCondition" && FreeQ[expr, Inactive[RealValued] | Inactive[FunctionSpace] | Inactive[Measurable] | Inactive[BoundaryTerm] | Inactive[RegularEnoughForIBP]];
  FTCondition[kind, expr, source, machine]
];

FTCompiledCondition[template_String, bindings_Association, source_String] := Module[{expr, kind, machine},
  If[StringStartsQ[StringTrim[template], "NormalizationFactorNonzero["],
    expr = FTEvaluateTemplate[StringReplace[StringTrim[template], "NormalizationFactorNonzero[" ~~ rest__ ~~ "]" :> rest], bindings];
    If[expr === $Failed, Return[FTCondition["NormalizationFactorNonzero", template, source, False]]];
    Return[FTCondition["NormalizationFactorNonzero", expr != 0, source]]
  ];
  expr = FTEvaluateTemplate[template, bindings];
  If[expr === $Failed, Return[FTCondition["TemplateCondition", template, source, False]]];
  kind = Which[
    MatchQ[expr, Inactive[RealValued][_]], "RealValued",
    MatchQ[expr, Inactive[FunctionSpace][_, _]], "FunctionSpaceMembership",
    MatchQ[expr, Inactive[Measurable][_, _]], "Measurability",
    MatchQ[expr, Inactive[MeasurableIntegrable][_, _]], "MeasurabilityIntegrability",
    MatchQ[expr, Inactive[Regularity][_]], "Regularity",
    MatchQ[expr, Inactive[BoundaryTrace][__]], "BoundaryCondition",
    MatchQ[expr, Inactive[ZeroMean][__]], "NormalizationCondition",
    MatchQ[expr, Inactive[BoundaryTerm][__]], "BoundaryCondition",
    StringStartsQ[StringTrim[template], "BoundaryTerm["], "BoundaryCondition",
    StringStartsQ[StringTrim[template], "Nonnegative["], "Nonnegativity",
    MatchQ[expr, _String], template,
    True, "TemplateCondition"
  ];
  machine = kind =!= "BoundaryCondition" && FreeQ[expr, Inactive[RealValued] | Inactive[FunctionSpace] | Inactive[Measurable] | Inactive[BoundaryTerm] | Inactive[RegularEnoughForIBP]];
  FTCondition[kind, expr, source, machine]
];

FTApplyGenericTemplateRule[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], bindings, derived, orientations, orientation, relationHead, lhs, rhs, terms, relation, conditionTemplates, conditions, discharged, state2, trace2},
  bindings = FTGenericMatcherBindings[compiled, selected, parameters];
  If[bindings === $Failed,
    Return[FTFailure["Inapplicable", name <> " generic template matcher did not match the selected formula.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  derived = Lookup[compiled, "DerivedBindings", <||>];
  If[AssociationQ[derived],
    Do[
      bindings = Join[bindings, <|key -> FTEvaluateTemplate[Lookup[derived, key], bindings]|>],
      {key, Keys[derived]}
    ]
  ];
  orientations = Select[
    Lookup[compiled, "Orientations", {}],
    Lookup[#, "direction", "Auto"] === direction ||
      direction === "Auto" && MemberQ[{"Auto", "Equal"}, Lookup[#, "direction", "Auto"]] &
  ];
  If[orientations === {},
    Return[FTFailure["DirectionUnavailable", "No JSON orientation is available for direction=" <> direction <> " in rule " <> name <> ".", <|"Trace" -> trace, "State" -> state|>]]
  ];
  orientation = First[orientations];
  relationHead = Lookup[orientation, "relation", "LessEqual"];
  relation = Switch[relationHead,
    "LessEqual",
      lhs = FTEvaluateTemplate[Lookup[orientation, "lhs", "$selected"], bindings];
      rhs = FTEvaluateTemplate[Lookup[orientation, "rhs", "$selected"], bindings];
      LessEqual[lhs, rhs],
    "LessEqualChain",
      terms = FTEvaluateTemplate[#, bindings] & /@ Lookup[orientation, "terms", {}];
      Apply[LessEqual, terms],
    "Equal",
      lhs = FTEvaluateTemplate[Lookup[orientation, "lhs", "$selected"], bindings];
      rhs = FTEvaluateTemplate[Lookup[orientation, "rhs", "$selected"], bindings];
      Equal[lhs, rhs],
    _,
      Return[FTFailure["CompilerPrimitiveMissing", "Unsupported JSON orientation relation: " <> relationHead, <|"Trace" -> trace, "State" -> state|>]]
  ];
  conditionTemplates = Join[Lookup[compiled, "Conditions", {}], Lookup[orientation, "conditions", {}]];
  conditions = FTCompiledCondition[#, bindings, name] & /@ conditionTemplates;
  trace2 = FTAppendTrace[trace, "ApplyGenericTemplateRule", <|"Rule" -> name, "Matcher" -> Lookup[bindings, "Matcher", ""], "Orientation" -> Lookup[orientation, "name", ""]|>];
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, context, contextText];
  If[Length[Lookup[discharged, "Contradicted", {}]] > 0,
    Return[FTFailure["AssumptionContradiction", "Assumptions contradict a generated transform condition.", <|"Conditions" -> discharged, "Trace" -> trace2, "State" -> state|>]]
  ];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Rule" -> name,
    "Runtime" -> "GenericTemplate",
    "Direction" -> If[direction === "Auto", Lookup[orientation, "direction", "Auto"], direction],
    "Original" -> selected,
    "Selected" -> selected,
    "Relation" -> relation,
    "RelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "RelationLatex" -> Quiet@Check[ToString[TeXForm[relation], PageWidth -> Infinity], ""],
    "Trace" -> FTAppendTrace[trace2, "BuildRelationFromJSON", <|"Relation" -> relationHead|>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTPlanGenericTemplateRule[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] :=
  FTApplyGenericTemplateRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace];

FTPlanYoungGeneric[compiled_, selected_, direction_, parameters_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", "Young"], factors, a, b, p, q, bound, relation},
  factors = FTProductFactors[selected];
  If[factors === $Failed,
    Return[FTFailure["Inapplicable", "Young target planning applies to pointwise product formulas.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  {a, b} = factors;
  p = Lookup[parameters, "p", 2];
  q = Lookup[parameters, "q", 2];
  bound = Abs[a]^p/p + Abs[b]^q/q;
  relation = FTBuildOrientedRelation[selected, bound, direction];
  If[AssociationQ[relation] && Lookup[relation, "Status", ""] === "Failure", Return[Join[relation, <|"Trace" -> trace, "State" -> state|>]]];
  FTSuccess[<|
    "Kind" -> "FormulaTransformPlan",
    "Rule" -> name,
    "Direction" -> direction,
    "Original" -> selected,
    "Selected" -> selected,
    "TargetGuided" -> False,
    "RegistryMutation" -> False,
    "PlanStatus" -> "GenericCanonical",
    "PlannedRelation" -> relation,
    "PlannedRelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "ParameterSynthesis" -> <|"Method" -> "CanonicalYoung", "p" -> p, "q" -> q|>,
    "ProposedApplyParameters" -> parameters,
    "Trace" -> FTAppendTrace[trace, "PlanGenericYoung", <|"Rule" -> name|>],
    "Conditions" -> <|"Discovered" -> {}, "Discharged" -> {}, "Deferred" -> {}, "Contradicted" -> {}|>,
    "Obligations" -> {},
    "State" -> state
  |>]
];

FTPlanYoungTarget[compiled_, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {
    name = Lookup[compiled, "Name", "Young"], targetText, targetData, target, lhs, rhs, productData,
    allCandidates, terms, absorbData, absorb, other, coeff, theta, residualData, residualTarget, residualRequired,
    bound, relation, conditions, discharged, state2, trace2, absorbParam, planner, requiredPrimitives, primitiveAudit, primitiveCheck
  },
  targetText = FTTargetRelationText[parameters];
  If[targetText === "", Return[FTPlanYoungGeneric[compiled, selected, direction, parameters, state, trace]]];
  planner = FTFindTargetPlanner[compiled, "YoungAbsorption"];
  If[! AssociationQ[planner],
    Return[FTFailure["CompilerPrimitiveMissing", "No registered TargetPlanner descriptor is available for YoungAbsorption.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  requiredPrimitives = {
    "ParseTargetRelation", "MatchTargetLHS", "ExtractProductFactors",
    "InferAbsorbedQuadraticFactor", "InferResidualFactor",
    "ComputeProductCoefficient", "BuildResidualCoefficientCondition"
  };
  primitiveCheck = FTRequirePlannerPrimitives[planner, requiredPrimitives, trace, state];
  If[AssociationQ[primitiveCheck], Return[primitiveCheck]];
  If[direction =!= "Upper" && direction =!= "Auto",
    Return[FTFailure["DirectionUnavailable", "Target-guided Young planning currently supports direction=Upper or Auto.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  targetData = FTYoungParseTargetRelation[targetText];
  If[! AssociationQ[targetData],
    Return[FTFailure["InvalidRequest", "targetRelation/targetPattern for Young must parse as lhs <= rhs.", <|"Trace" -> trace, "State" -> state, "Target" -> targetText|>]]
  ];
  target = Lookup[targetData, "Target"];
  lhs = Lookup[targetData, "LHS"];
  rhs = Lookup[targetData, "RHS"];
  If[! FTYoungMatchTargetLHS[targetData, selected],
    Return[FTFailure["Inapplicable", "Target lhs does not match the selected formula.", <|"Trace" -> trace, "State" -> state, "TargetLHS" -> lhs, "Selected" -> selected|>]]
  ];
  productData = FTYoungExtractProductFactors[selected];
  If[! AssociationQ[productData],
    Return[FTFailure["Inapplicable", "Young target planning applies to pointwise product formulas.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  absorbParam = FTParseMaybeExpression[Lookup[parameters, "absorbFactor", ""]];
  absorbData = FTYoungInferAbsorbedQuadraticFactor[rhs, Lookup[productData, "FlatFactors"], absorbParam];
  If[! AssociationQ[absorbData],
    Return[FTFailure["Inapplicable", "Could not infer an absorbed quadratic factor from the target relation.", <|"Trace" -> trace, "State" -> state, "Target" -> targetText|>]]
  ];
  absorb = Lookup[absorbData, "Factor"];
  theta = Lookup[absorbData, "Coefficient"];
  allCandidates = Lookup[absorbData, "AllCandidates"];
  terms = Lookup[absorbData, "Terms"];
  other = FTYoungInferResidualFactor[selected, Lookup[productData, "FlatFactors"], allCandidates, absorb];
  coeff = FTYoungComputeProductCoefficient[selected, absorb, other];
  If[MatchQ[coeff, Missing[_]],
    Return[FTFailure["Inapplicable", "Could not factor the selected product into absorbed and residual factors.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  residualData = FTYoungBuildResidualCoefficientCondition[terms, other, coeff, theta];
  residualTarget = Lookup[residualData, "ResidualTarget"];
  residualRequired = Lookup[residualData, "ResidualRequired"];
  primitiveAudit = FTPlannerPrimitiveAudit[planner, requiredPrimitives];
  bound = rhs;
  relation = LessEqual[selected, bound];
  trace2 = FTAppendTrace[trace, "PlanTargetYoung", <|"TargetRelation" -> targetText, "TargetPlanner" -> Lookup[planner, "Name"], "PlannerPrimitives" -> Lookup[planner, "Primitives", {}], "PrimitiveAudit" -> primitiveAudit, "AbsorbFactor" -> absorb, "ResidualFactor" -> other|>];
  conditions = {
    FTCondition["TargetCoefficientPositive", theta > 0, name],
    FTCondition["YoungResidualCoefficient", Lookup[residualData, "Condition"], name],
    FTRealValuedCondition[selected, name]
  };
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, context, contextText];
  If[Length[Lookup[discharged, "Contradicted", {}]] > 0,
    Return[FTFailure["AssumptionContradiction", "Assumptions contradict a generated target-guided Young condition.", <|"Conditions" -> discharged, "Trace" -> trace2, "State" -> state|>]]
  ];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Kind" -> "FormulaTransformPlan",
    "Rule" -> name,
    "Direction" -> If[direction === "Auto", "Upper", direction],
    "Original" -> selected,
    "Selected" -> selected,
    "TargetGuided" -> True,
    "TargetPlanner" -> Lookup[planner, "Name"],
    "TargetPlannerRuntime" -> Lookup[planner, "Runtime"],
    "TargetPlannerPrimitives" -> Lookup[planner, "Primitives", {}],
    "TargetPlannerPrimitiveAudit" -> primitiveAudit,
    "RegistryMutation" -> False,
    "PlanStatus" -> "TargetMatched",
    "TargetRelation" -> target,
    "TargetRelationInputForm" -> ToString[target, InputForm, PageWidth -> Infinity],
    "PlannedRelation" -> relation,
    "PlannedRelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "PlannedBound" -> bound,
    "ParameterSynthesis" -> <|
      "Method" -> "YoungAbsorption",
      "AbsorbFactor" -> absorb,
      "ResidualFactor" -> other,
      "ProductCoefficient" -> coeff,
      "AbsorbCoefficient" -> theta,
      "ResidualCoefficientRequired" -> residualRequired,
      "ResidualCoefficientTarget" -> If[residualTarget === {}, Missing["NotSpecified"], First[residualTarget]]
    |>,
    "ProposedApplyParameters" -> Join[parameters, <|"SynthesizedBy" -> "TargetGuidedYoung", "AbsorbFactor" -> ToString[absorb, InputForm, PageWidth -> Infinity]|>],
    "Trace" -> FTAppendTrace[trace2, "PlanBuildRelation", <|"Direction" -> "Upper"|>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTPlanHolderGeneric[compiled_, selected_, direction_, parameters_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", "Holder"], defaults, p, q, parts, operator, body, domain, factors, f, g, bound, relation},
  defaults = Lookup[compiled, "ParameterDefaults", <||>];
  p = Lookup[parameters, "p", Lookup[defaults, "p", 2]];
  q = Lookup[parameters, "q", Lookup[defaults, "q", 2]];
  parts = FTIntegralParts[selected];
  If[parts === $Failed, parts = FTSumParts[selected]];
  If[parts === $Failed,
    Return[FTFailure["Inapplicable", name <> " target planning applies to integral or sum product formulas.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  {body, domain, operator} = parts;
  factors = FTProductFactors[body];
  If[factors === $Failed,
    Return[FTFailure["Inapplicable", name <> " target planning currently requires an explicit product body.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  {f, g} = factors;
  bound = FTLpBound[f, g, p, q, domain, operator];
  relation = FTBuildOrientedRelation[selected, bound, direction];
  If[AssociationQ[relation] && Lookup[relation, "Status", ""] === "Failure", Return[Join[relation, <|"Trace" -> trace, "State" -> state|>]]];
  FTSuccess[<|
    "Kind" -> "FormulaTransformPlan",
    "Rule" -> name,
    "Direction" -> direction,
    "Original" -> selected,
    "Selected" -> selected,
    "TargetGuided" -> False,
    "RegistryMutation" -> False,
    "PlanStatus" -> "GenericCanonical",
    "PlannedRelation" -> relation,
    "PlannedRelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "ParameterSynthesis" -> <|"Method" -> "CanonicalHolder", "p" -> p, "q" -> q|>,
    "HeuristicPipeline" -> {},
    "ProposedApplyParameters" -> parameters,
    "Trace" -> FTAppendTrace[trace, "PlanGenericHolder", <|"Rule" -> name|>],
    "Conditions" -> <|"Discovered" -> {}, "Discharged" -> {}, "Deferred" -> {}, "Contradicted" -> {}|>,
    "Obligations" -> {},
    "State" -> state
  |>]
];

FTWeightedHolderBound[f_, g_, p_, q_, weight_, domain_, operator_] := Module[{op, left, right},
  op = If[operator === "Sum", Inactive[Sum], Inactive[Integrate]];
  left = f * Inactive[Power][weight, 1/p];
  right = g * Inactive[Power][weight, -1/p];
  {
    Inactive[Power][op[Abs[left]^p, domain], 1/p] *
      Inactive[Power][op[Abs[right]^q, domain], 1/q],
    left,
    right
  }
];

FTNormPowerParts[expr_, operator_] := Module[{result},
  result = Which[
    operator === "Integral" && MatchQ[expr, Inactive[Power][Inactive[Integrate][Power[Abs[_], _], _], _]],
      expr /. Inactive[Power][Inactive[Integrate][Power[Abs[h_], exp_], dom_], inv_] :> <|"Argument" -> h, "Exponent" -> exp, "Domain" -> dom, "OuterExponent" -> inv, "Operator" -> "Integral"|>,
    operator === "Sum" && MatchQ[expr, Inactive[Power][Inactive[Sum][Power[Abs[_], _], _], _]],
      expr /. Inactive[Power][Inactive[Sum][Power[Abs[h_], exp_], dom_], inv_] :> <|"Argument" -> h, "Exponent" -> exp, "Domain" -> dom, "OuterExponent" -> inv, "Operator" -> "Sum"|>,
    True,
      $Failed
  ];
  result
];

FTInferHolderWeightFromNormPair[firstNorm_, secondNorm_, f_, g_, p_, q_, domain_, operator_] := Module[
  {first, second, firstWeight, secondWeight, firstOk, secondOk},
  first = FTNormPowerParts[firstNorm, operator];
  second = FTNormPowerParts[secondNorm, operator];
  If[first === $Failed || second === $Failed, Return[Missing["NoNormPair"]]];
  firstOk = TrueQ[Quiet@Check[
    Simplify[Lookup[first, "Domain"] == domain && Lookup[first, "Exponent"] == p && Lookup[first, "OuterExponent"] == 1/p],
    False
  ]];
  secondOk = TrueQ[Quiet@Check[
    Simplify[Lookup[second, "Domain"] == domain && Lookup[second, "Exponent"] == q && Lookup[second, "OuterExponent"] == 1/q],
    False
  ]];
  If[! firstOk || ! secondOk, Return[Missing["NormShapeMismatch"]]];
  firstWeight = Quiet@Check[Simplify[(Lookup[first, "Argument"]/f)^p], $Failed];
  secondWeight = Quiet@Check[Simplify[(Lookup[second, "Argument"]/g)^(-p)], $Failed];
  If[firstWeight === $Failed || secondWeight === $Failed, Return[Missing["WeightInferenceFailed"]]];
  If[! FreeQ[firstWeight, f] || ! FreeQ[firstWeight, g] || ! FreeQ[secondWeight, f] || ! FreeQ[secondWeight, g],
    Return[Missing["WeightDependsOnProductFactor"]]
  ];
  If[TrueQ[Quiet@Check[Simplify[firstWeight == secondWeight], False]],
    <|"Weight" -> firstWeight, "FirstNorm" -> first, "SecondNorm" -> second, "Inference" -> "BothNormFactors"|>,
    Missing["InconsistentWeights"]
  ]
];

FTInferHolderWeightFromTarget[target_, selected_, f_, g_, p_, q_, domain_, operator_] := Module[
  {lhs, rhs, rhsFactors, direct, swapped},
  If[! MatchQ[target, LessEqual[_, _]], Return[Missing["NoTargetRelation"]]];
  {lhs, rhs} = List @@ target;
  If[! TrueQ[Quiet@Check[Simplify[lhs == selected], False]], Return[Missing["TargetLHSMismatch"]]];
  rhsFactors = FTProductFactors[rhs];
  If[rhsFactors === $Failed, Return[Missing["TargetBoundNotProduct"]]];
  direct = FTInferHolderWeightFromNormPair[rhsFactors[[1]], rhsFactors[[2]], f, g, p, q, domain, operator];
  If[AssociationQ[direct], Return[direct]];
  swapped = FTInferHolderWeightFromNormPair[rhsFactors[[2]], rhsFactors[[1]], f, g, p, q, domain, operator];
  If[AssociationQ[swapped],
    Join[swapped, <|"Inference" -> "SwappedNormFactors"|>],
    Missing["NoConsistentWeight"]
  ]
];

FTWeightedHolderParseIntegralOrSumProduct[selected_] := Module[{parts, body, domain, operator, factors},
  parts = FTIntegralParts[selected];
  If[parts === $Failed, parts = FTSumParts[selected]];
  If[parts === $Failed, Return[Missing["NoIntegralOrSumProduct"]]];
  {body, domain, operator} = parts;
  factors = FTProductFactors[body];
  If[factors === $Failed, Return[Missing["NoProductBody"]]];
  <|"Body" -> body, "Domain" -> domain, "Operator" -> operator, "Factors" -> factors, "FirstFactor" -> factors[[1]], "SecondFactor" -> factors[[2]]|>
];

FTWeightedHolderParseWeightParameter[weightText_String] := Module[{weight},
  If[StringTrim[weightText] === "", Return[Missing["NoExplicitWeight"]]];
  weight = FTParseMaybeExpression[weightText];
  If[weight === $Failed, Missing["InvalidWeightParameter"], weight]
];

FTWeightedHolderInferWeight[targetText_String, selected_, f_, g_, p_, q_, domain_, operator_] := Module[
  {target, inferredWeight},
  target = If[targetText === "", $Failed, FTParseMaybeExpression[targetText]];
  If[target === $Failed, Return[Missing["NoParseableTargetRelation"]]];
  inferredWeight = FTInferHolderWeightFromTarget[target, selected, f, g, p, q, domain, operator];
  If[AssociationQ[inferredWeight],
    Join[inferredWeight, <|"Target" -> target|>],
    inferredWeight
  ]
];

FTWeightedHolderBuildBound[f_, g_, p_, q_, weight_, domain_, operator_] := Module[
  {weighted},
  weighted = FTWeightedHolderBound[f, g, p, q, weight, domain, operator];
  <|"Bound" -> weighted[[1]], "WeightedFirstFactor" -> weighted[[2]], "WeightedSecondFactor" -> weighted[[3]]|>
];

FTWeightedHolderBuildConditions[name_, p_, q_, weight_, domain_, direction_, left_, right_, selected_] := Module[{conditions},
  conditions = {
    FTCondition["ExponentConstraint", p > 1, name],
    FTCondition["ExponentConstraint", q > 1, name],
    FTCondition["ExponentConjugacy", 1/p + 1/q == 1, name],
    FTCondition["WeightPositive", weight > 0, name],
    FTFunctionSpaceCondition[left, Inactive[Lp][p, domain], name],
    FTFunctionSpaceCondition[right, Inactive[Lp][q, domain], name],
    FTMeasurableIntegrableCondition[{left, right}, domain, name]
  };
  If[MemberQ[{"Upper", "Lower", "TwoSided"}, direction],
    conditions = Append[conditions, FTRealValuedCondition[selected, name]]
  ];
  conditions
];

FTPlanHolderTarget[compiled_, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {
    name = Lookup[compiled, "Name", "Holder"], defaults, p, q, parts, operator, body, domain,
    factors, f, g, weightText, weight, weighted, bound, left, right, relation, targetText,
    target, inferredWeight, weightInferenceMethod, conditions, discharged, state2, trace2, planner, requiredPrimitives, primitiveAudit, primitiveCheck,
    productData, weightParse, boundData
  },
  weightText = FTReadString[Lookup[parameters, "weight", ""]];
  targetText = FTTargetRelationText[parameters];
  If[weightText === "" && targetText === "", Return[FTPlanHolderGeneric[compiled, selected, direction, parameters, state, trace]]];
  planner = FTFindTargetPlanner[compiled, "WeightedHolder"];
  If[! AssociationQ[planner],
    Return[FTFailure["CompilerPrimitiveMissing", "No registered TargetPlanner descriptor is available for WeightedHolder.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  requiredPrimitives = {
    "ParseIntegralOrSumProduct", "ExtractProductFactors", "ParseWeightParameter",
    "InferWeightFromNormPair", "BuildWeightedHolderBound",
    "BuildWeightPositiveCondition", "BuildFunctionSpaceObligations"
  };
  primitiveCheck = FTRequirePlannerPrimitives[planner, requiredPrimitives, trace, state];
  If[AssociationQ[primitiveCheck], Return[primitiveCheck]];
  defaults = Lookup[compiled, "ParameterDefaults", <||>];
  p = Lookup[parameters, "p", Lookup[defaults, "p", 2]];
  q = Lookup[parameters, "q", Lookup[defaults, "q", 2]];
  productData = FTWeightedHolderParseIntegralOrSumProduct[selected];
  If[! AssociationQ[productData],
    Return[FTFailure["Inapplicable", name <> " weighted target planning applies to integral or sum product formulas.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  body = Lookup[productData, "Body"];
  domain = Lookup[productData, "Domain"];
  operator = Lookup[productData, "Operator"];
  factors = Lookup[productData, "Factors"];
  f = Lookup[productData, "FirstFactor"];
  g = Lookup[productData, "SecondFactor"];
  If[weightText === "",
    inferredWeight = FTWeightedHolderInferWeight[targetText, selected, f, g, p, q, domain, operator];
    If[! AssociationQ[inferredWeight],
      If[MatchQ[inferredWeight, Missing["NoParseableTargetRelation"]],
        Return[FTFailure["InvalidRequest", "Weighted Holder target planning requires parameters.weight or a parseable parameters.targetRelation.", <|"Trace" -> trace, "State" -> state|>]],
        Return[FTFailure["Inapplicable", "Could not infer a request-time Holder weight from the target relation. Pass parameters.weight explicitly.", <|"Trace" -> trace, "State" -> state, "TargetRelation" -> targetText, "InferenceFailure" -> inferredWeight|>]]
      ]
    ];
    weight = Lookup[inferredWeight, "Weight"];
    target = Lookup[inferredWeight, "Target", $Failed];
    weightInferenceMethod = Lookup[inferredWeight, "Inference", "TargetRelation"],
    weightParse = FTWeightedHolderParseWeightParameter[weightText];
    If[MatchQ[weightParse, Missing["InvalidWeightParameter"]], Return[FTFailure["InvalidRequest", "parameters.weight must parse as a Wolfram expression.", <|"Trace" -> trace, "State" -> state|>]]];
    weight = weightParse;
    target = If[targetText === "", $Failed, FTParseMaybeExpression[targetText]];
    weightInferenceMethod = "ExplicitParameter"
  ];
  boundData = FTWeightedHolderBuildBound[f, g, p, q, weight, domain, operator];
  bound = Lookup[boundData, "Bound"];
  left = Lookup[boundData, "WeightedFirstFactor"];
  right = Lookup[boundData, "WeightedSecondFactor"];
  relation = If[MatchQ[target, LessEqual[_, _]] && TrueQ[Quiet@Check[Simplify[First[List @@ target] == selected], False]],
    target,
    FTBuildOrientedRelation[selected, bound, direction]
  ];
  If[AssociationQ[relation] && Lookup[relation, "Status", ""] === "Failure", Return[Join[relation, <|"Trace" -> trace, "State" -> state|>]]];
  primitiveAudit = FTPlannerPrimitiveAudit[planner, requiredPrimitives];
  trace2 = FTAppendTrace[trace, "PlanTargetHolder", <|"TargetRelation" -> targetText, "TargetPlanner" -> Lookup[planner, "Name"], "PlannerPrimitives" -> Lookup[planner, "Primitives", {}], "PrimitiveAudit" -> primitiveAudit, "Heuristic" -> "MultiplyByOneWeight", "Weight" -> weight, "WeightInference" -> weightInferenceMethod|>];
  conditions = FTWeightedHolderBuildConditions[name, p, q, weight, domain, direction, left, right, selected];
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, context, contextText];
  If[Length[Lookup[discharged, "Contradicted", {}]] > 0,
    Return[FTFailure["AssumptionContradiction", "Assumptions contradict a generated target-guided Holder condition.", <|"Conditions" -> discharged, "Trace" -> trace2, "State" -> state|>]]
  ];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Kind" -> "FormulaTransformPlan",
    "Rule" -> name,
    "Direction" -> direction,
    "Original" -> selected,
    "Selected" -> selected,
    "TargetGuided" -> True,
    "TargetPlanner" -> Lookup[planner, "Name"],
    "TargetPlannerRuntime" -> Lookup[planner, "Runtime"],
    "TargetPlannerPrimitives" -> Lookup[planner, "Primitives", {}],
    "TargetPlannerPrimitiveAudit" -> primitiveAudit,
    "RegistryMutation" -> False,
    "PlanStatus" -> "TargetMatched",
    "PlannedRelation" -> relation,
    "PlannedRelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "PlannedBound" -> bound,
    "ParameterSynthesis" -> <|
      "Method" -> "WeightedHolder",
      "p" -> p,
      "q" -> q,
      "Weight" -> weight,
      "WeightInference" -> weightInferenceMethod,
      "FirstFactor" -> f,
      "SecondFactor" -> g,
      "WeightedFirstFactor" -> left,
      "WeightedSecondFactor" -> right
    |>,
    "HeuristicPipeline" -> {
      <|"Heuristic" -> "MultiplyByOneWeight", "Status" -> "Planned", "Identity" -> weight^(1/p) * weight^(-1/p), "GeneratedCondition" -> weight > 0|>
    },
    "ProposedApplyParameters" -> Join[parameters, <|"SynthesizedBy" -> "TargetGuidedHolder"|>],
    "Trace" -> FTAppendTrace[trace2, "PlanBuildRelation", <|"Direction" -> direction|>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTEstimateSeedTextTemplate[text_String, bindings_Association] := Module[{result = text, keys},
  keys = Reverse@SortBy[Keys[bindings], StringLength[ToString[#]] &];
  Do[
    result = StringReplace[result, "$" <> ToString[key] -> ToString[Lookup[bindings, key], InputForm, PageWidth -> Infinity]],
    {key, keys}
  ];
  result
];

FTEstimateSeedCondition[condition_Association, bindings_Association, source_String] /; KeyExistsQ[condition, "predicate"] :=
  FTCompiledCondition[condition, bindings, source];

FTEstimateSeedCondition[condition_Association, bindings_Association, source_String] := Module[
  {kind, exprTemplate, machine, expr},
  kind = FTReadString[Lookup[condition, "kind", "TemplateCondition"]];
  exprTemplate = Lookup[condition, "expr", ""];
  machine = TrueQ[Lookup[condition, "machineCheckable", False]];
  expr = If[machine && StringQ[exprTemplate],
    FTEvaluateTemplate[exprTemplate, bindings],
    If[StringQ[exprTemplate], FTEstimateSeedTextTemplate[exprTemplate, bindings], exprTemplate]
  ];
  If[expr === $Failed, expr = exprTemplate; machine = False];
  FTCondition[kind, expr, source, machine]
];

FTEstimateSeedCondition[condition_String, bindings_Association, source_String] :=
  FTCompiledCondition[condition, bindings, source];

FTEstimateSeedCondition[_, _, source_String] :=
  FTCondition["TemplateCondition", "invalid estimate seed condition", source, False];

FTPlanEstimateSeed[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], relation, conditions, discharged, state2, trace2, bindings, template},
  If[direction =!= "Auto" && direction =!= "Upper",
    Return[FTFailure["DirectionUnavailable", "EstimateSeed currently supports direction=Auto or Upper.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  bindings = Join[Lookup[compiled, "ParameterDefaults", <||>], parameters, <|"selected" -> selected, "u" -> selected|>];
  bindings = FTPrepareParameterExpressionBindings[compiled, bindings];
  If[bindings === $Failed,
    Return[FTFailure["InvalidRequest", "EstimateSeed parameters could not be parsed as declared expression parameters.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  template = Lookup[Lookup[compiled, "Template", <||>], "relation", ""];
  If[! StringQ[template] || StringTrim[template] === "",
    Return[FTFailure["InvalidRuleJSON", "EstimateSeed JSON must provide template.relation.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  relation = FTEvaluateTemplate[template, bindings];
  If[relation === $Failed,
    Return[FTFailure["InvalidRuleJSON", "EstimateSeed relation template could not be evaluated.", <|"Trace" -> trace, "State" -> state, "Template" -> template|>]]
  ];
  trace2 = FTAppendTrace[trace, "PlanEstimateSeed", <|"EstimateSeed" -> name, "RegistryKind" -> "EstimateSeed"|>];
  conditions = FTEstimateSeedCondition[#, bindings, name] & /@ Lookup[compiled, "Conditions", {}];
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, context, contextText];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Kind" -> "FormulaTransformPlan",
    "Rule" -> name,
    "RegistryKind" -> "EstimateSeed",
    "Direction" -> If[direction === "Auto", "Upper", direction],
    "Original" -> selected,
    "Selected" -> selected,
    "TargetGuided" -> False,
    "RegistryMutation" -> False,
    "PlanStatus" -> "EstimateSeedInstantiated",
    "Relation" -> relation,
    "RelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "RelationLatex" -> Quiet@Check[ToString[TeXForm[relation], PageWidth -> Infinity], ""],
    "Trace" -> FTAppendTrace[trace2, "BuildEstimateRelation", <|"Direction" -> "Upper"|>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTIntegralQ[expr_] := MatchQ[Unevaluated[expr], _Integrate | _Inactive];
FTSumQ[expr_] := MatchQ[Unevaluated[expr], _Sum | _Inactive];

FTIntegralParts[Inactive[Integrate][body_, domain_]] := {body, domain, "Integral"};
FTIntegralParts[Integrate[body_, domain_]] := {body, domain, "Integral"};
FTIntegralParts[_] := $Failed;

FTSumParts[Inactive[Sum][body_, domain_]] := {body, domain, "Sum"};
FTSumParts[Sum[body_, domain_]] := {body, domain, "Sum"};
FTSumParts[_] := $Failed;

FTProductFactors[body_Times] := Module[{factors = List @@ body},
  {First[factors], Times @@ Rest[factors]}
];
FTProductFactors[Inactive[Times][a_, b_]] := {a, b};
FTProductFactors[_] := $Failed;

FTLpBound[f_, g_, p_, q_, domain_, operator_] := Module[{op},
  op = If[operator === "Sum", Inactive[Sum], Inactive[Integrate]];
  Inactive[Power][op[Abs[f]^p, domain], 1/p] *
    Inactive[Power][op[Abs[g]^q, domain], 1/q]
];

FTBuildOrientedRelation[selected_, bound_, direction_String] := Switch[direction,
  "Upper", LessEqual[selected, bound],
  "Lower", LessEqual[-bound, selected],
  "TwoSided", LessEqual[-bound, selected, bound],
  "Equal", FTFailure["DirectionUnavailable", "Inequality rules cannot be used with direction=Equal."],
  _, LessEqual[Abs[selected], bound]
];

FTApplyHolderLike[compiled_, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", "Holder"], defaults, p, q, parts, operator, body, domain, factors, f, g, bound, relation, conditions, discharged, state2, trace2, heuristicTrace = {}, heuristicResult, plan, targetText, weightText, genericResult},
  defaults = Lookup[compiled, "ParameterDefaults", <||>];
  p = Lookup[parameters, "p", Lookup[defaults, "p", 2]];
  q = Lookup[parameters, "q", Lookup[defaults, "q", 2]];
  targetText = FTTargetRelationText[parameters];
  weightText = FTReadString[Lookup[parameters, "weight", ""]];
  If[Lookup[compiled, "Runtime", ""] === "GenericTemplate" && targetText === "" && weightText === "",
    genericResult = FTApplyGenericTemplateRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace];
    If[AssociationQ[genericResult] && Lookup[genericResult, "Status", ""] === "Success", Return[genericResult]];
    If[!(AssociationQ[genericResult] && Lookup[genericResult, "FailureType", ""] === "Inapplicable"), Return[genericResult]]
  ];
  plan = If[targetText =!= "" || weightText =!= "", FTPlanHolderTarget[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace], <||>];
  If[AssociationQ[plan] && Lookup[plan, "Status", ""] === "Failure", Return[plan]];
  parts = FTIntegralParts[selected];
  If[parts === $Failed, parts = FTSumParts[selected]];
  If[parts === $Failed, Return[FTFailure["Inapplicable", name <> " currently applies to integral or sum product formulas.", <|"Trace" -> trace, "State" -> state|>]]];
  {body, domain, operator} = parts;
  factors = FTProductFactors[body];
  If[factors === $Failed,
    heuristicResult = FTHeuristicSearch[compiled, selected, parameters];
    If[AssociationQ[heuristicResult] && Lookup[heuristicResult, "Status", ""] === "Success",
      heuristicTrace = Lookup[heuristicResult, "HeuristicPipeline", {}];
      parts = FTIntegralParts[Lookup[heuristicResult, "Rewritten"]];
      If[parts === $Failed, parts = FTSumParts[Lookup[heuristicResult, "Rewritten"]]];
      If[parts =!= $Failed,
        {body, domain, operator} = parts;
        factors = FTProductFactors[body]
      ]
    ];
    If[factors === $Failed,
      Return[FTFailure["Inapplicable", name <> " could not rewrite the selected formula into a product form using compatible heuristics.", <|"Trace" -> trace, "State" -> state, "HeuristicSearch" -> heuristicResult|>]]
    ]
  ];
  {f, g} = factors;
  bound = If[AssociationQ[plan] && KeyExistsQ[plan, "PlannedBound"], Lookup[plan, "PlannedBound"], FTLpBound[f, g, p, q, domain, operator]];
  relation = If[AssociationQ[plan] && KeyExistsQ[plan, "PlannedRelation"],
    Lookup[plan, "PlannedRelation"],
    FTBuildOrientedRelation[selected, bound, direction]
  ];
  If[AssociationQ[relation] && Lookup[relation, "Status", ""] === "Failure", Return[Join[relation, <|"Trace" -> trace, "State" -> state|>]]];
  trace2 = FTAppendTrace[trace, "MatchRule", <|"Rule" -> name, "Operator" -> operator, "Heuristics" -> heuristicTrace, "HeuristicDepth" -> Length[heuristicTrace]|>];
  conditions = FTBuildConditions[name, direction, {f, g}, {p, q}, domain, heuristicTrace, selected];
  If[AssociationQ[plan] && KeyExistsQ[plan, "Conditions"],
    conditions = Join[conditions, Lookup[Lookup[plan, "Conditions"], "Discovered", {}]]
  ];
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, context, contextText];
  If[Length[Lookup[discharged, "Contradicted", {}]] > 0,
    Return[FTFailure["AssumptionContradiction", "Assumptions contradict a generated transform condition.", <|"Conditions" -> discharged, "Trace" -> trace2, "State" -> state|>]]
  ];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Rule" -> name,
    "Direction" -> direction,
    "Part" -> "Whole",
    "Original" -> selected,
    "Selected" -> selected,
    "Relation" -> relation,
    "RelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "RelationLatex" -> Quiet@Check[ToString[TeXForm[relation], PageWidth -> Infinity], ""],
    "Trace" -> FTAppendTrace[trace2, "BuildRelation", <|"Direction" -> direction|>],
    "Plan" -> If[AssociationQ[plan] && KeyExistsQ[plan, "PlanStatus"], KeyDrop[plan, {"State"}], <||>],
    "HeuristicSearch" -> If[AssociationQ[heuristicResult], KeyDrop[heuristicResult, {"Original", "Rewritten"}], <||>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTBuildConditions[name_, direction_, factors_, exponents_, domain_, heuristicTrace_, selected_] := Module[
  {f = factors[[1]], g = factors[[2]], p = exponents[[1]], q = exponents[[2]], conditions},
  conditions = {
    FTCondition["ExponentConstraint", p > 1, name],
    FTCondition["ExponentConstraint", q > 1, name],
    FTCondition["ExponentConjugacy", 1/p + 1/q == 1, name],
    FTFunctionSpaceCondition[f, Inactive[Lp][p, domain], name],
    FTFunctionSpaceCondition[g, Inactive[Lp][q, domain], name],
    FTMeasurableIntegrableCondition[{f, g}, domain, name]
  };
  If[MemberQ[{"Upper", "Lower", "TwoSided"}, direction],
    conditions = Append[conditions, FTRealValuedCondition[selected, name]]
  ];
  If[Length[heuristicTrace] > 0,
    conditions = Append[conditions, FTCondition["Nonnegativity", Lookup[First[heuristicTrace], "GeneratedCondition", "heuristic side condition"], name]]
  ];
  conditions
];

FTApplyYoung[compiled_, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", "Young"], body = selected, factors, a, b, p, q, bound, relation, conditions, discharged, state2, trace2, plan, targetText},
  If[Head[Unevaluated[body]] === Abs, body = First[List @@ body]];
  factors = FTProductFactors[body];
  If[factors === $Failed, Return[FTFailure["Inapplicable", "Young applies to pointwise product formulas.", <|"Trace" -> trace, "State" -> state|>]]];
  {a, b} = factors;
  p = Lookup[parameters, "p", 2];
  q = Lookup[parameters, "q", 2];
  targetText = FTTargetRelationText[parameters];
  plan = If[targetText =!= "", FTPlanYoungTarget[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace], <||>];
  If[AssociationQ[plan] && Lookup[plan, "Status", ""] === "Failure", Return[plan]];
  bound = If[AssociationQ[plan] && KeyExistsQ[plan, "PlannedBound"], Lookup[plan, "PlannedBound"], Abs[a]^p/p + Abs[b]^q/q];
  relation = If[AssociationQ[plan] && KeyExistsQ[plan, "PlannedRelation"],
    Lookup[plan, "PlannedRelation"],
    FTBuildOrientedRelation[selected, bound, direction]
  ];
  If[AssociationQ[relation] && Lookup[relation, "Status", ""] === "Failure", Return[Join[relation, <|"Trace" -> trace, "State" -> state|>]]];
  trace2 = FTAppendTrace[trace, "MatchRule", <|"Rule" -> name, "Operator" -> "PointwiseProduct"|>];
  conditions = {
    FTCondition["ExponentConstraint", p > 1, name],
    FTCondition["ExponentConstraint", q > 1, name],
    FTCondition["ExponentConjugacy", 1/p + 1/q == 1, name]
  };
  If[AssociationQ[plan] && KeyExistsQ[plan, "Conditions"],
    conditions = Join[conditions, Lookup[Lookup[plan, "Conditions"], "Discovered", {}]]
  ];
  If[MemberQ[{"Upper", "Lower", "TwoSided"}, direction],
    conditions = Append[conditions, FTRealValuedCondition[selected, name]]
  ];
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, context, contextText];
  If[Length[Lookup[discharged, "Contradicted", {}]] > 0,
    Return[FTFailure["AssumptionContradiction", "Assumptions contradict a generated transform condition.", <|"Conditions" -> discharged, "Trace" -> trace2, "State" -> state|>]]
  ];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Rule" -> name,
    "Direction" -> direction,
    "Part" -> "Whole",
    "Original" -> selected,
    "Selected" -> selected,
    "Relation" -> relation,
    "RelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "RelationLatex" -> Quiet@Check[ToString[TeXForm[relation], PageWidth -> Infinity], ""],
    "Trace" -> FTAppendTrace[trace2, "BuildRelation", <|"Direction" -> direction|>],
    "Plan" -> If[AssociationQ[plan] && KeyExistsQ[plan, "PlanStatus"], KeyDrop[plan, {"State"}], <||>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTApplyIntegrationByParts[compiled_, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", "IntegrationByParts"], x, a, b, u, v, integrand, boundary, interior, relation, conditions, discharged, state2, trace2},
  If[direction =!= "Auto" && direction =!= "Equal",
    Return[FTFailure["DirectionUnavailable", "IntegrationByParts is an equality transform; use direction=Equal or Auto.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  Which[
    MatchQ[selected, Inactive[Integrate][Derivative[1][_][_] * _, {_, _, _}]],
      {integrand, {x, a, b}} = List @@ selected,
    MatchQ[selected, Integrate[Derivative[1][_][_] * _, {_, _, _}]],
      {integrand, {x, a, b}} = List @@ selected,
    True,
      Return[FTFailure["Inapplicable", "IntegrationByParts currently matches one-dimensional integrals of u'[x] v.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  integrand /. Derivative[1][uu_][xx_] * vv_ :> (u = uu; v = vv);
  boundary = u[b] * (v /. x -> b) - u[a] * (v /. x -> a);
  interior = -Inactive[Integrate][u[x] * D[v, x], {x, a, b}];
  relation = Equal[selected, boundary + interior];
  trace2 = FTAppendTrace[trace, "MatchRule", <|"Rule" -> name, "Operator" -> "OneDimensionalIntegral"|>];
  conditions = {
    FTBoundaryCondition[boundary, name],
    FTFunctionSpaceCondition[u, Inactive[RegularEnoughForIBP][{x, a, b}], name],
    FTFunctionSpaceCondition[v, Inactive[RegularEnoughForIBP][{x, a, b}], name],
    FTMeasurableIntegrableCondition[{boundary, interior}, {x, a, b}, name]
  };
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, context, contextText];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Rule" -> name,
    "Direction" -> "Equal",
    "Part" -> "Whole",
    "Original" -> selected,
    "Selected" -> selected,
    "Relation" -> relation,
    "RelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "RelationLatex" -> Quiet@Check[ToString[TeXForm[relation], PageWidth -> Infinity], ""],
    "Trace" -> FTAppendTrace[trace2, "BuildRelation", <|"Direction" -> "Equal"|>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTConditionDischargedByTextQ[condition_Association, assumptionsText_String, contextText_String] := Module[
  {expr = Lookup[condition, "Expr", ""], exprText, haystack},
  exprText = ToLowerCase[If[StringQ[expr], expr, ToString[expr, InputForm]]];
  haystack = ToLowerCase[assumptionsText <> "\n" <> contextText];
  exprText =!= "" && StringContainsQ[haystack, exprText]
];

FTMachineConditionDischargedQ[expr_, assumptions_] := Or[
  TrueQ[Quiet@Check[Simplify[expr, assumptions], False]],
  TrueQ[Quiet@Check[Reduce[assumptions && Not[expr]] === False, False]]
];

FTMachineConditionContradictedQ[expr_, assumptions_] := Or[
  TrueQ[Quiet@Check[Simplify[Not[expr], assumptions], False]],
  TrueQ[Quiet@Check[Reduce[assumptions && expr] === False, False]]
];

FTDischargeConditions[conditions_List, assumptions_, assumptionsText_String, context_Association, contextText_String] := Module[
  {discharged = {}, deferred = {}, contradicted = {}, status, expr, machine, discharger, evidence},
  Do[
    expr = Lookup[condition, "Expr", True];
    machine = TrueQ[Lookup[condition, "MachineCheckable", True]];
    discharger = Missing["NoDischarger"];
    evidence = Missing["NoEvidence"];
    Do[
      If[FTDischargerAppliesQ[candidate, condition],
        evidence = FTDischargerEvidenceMatch[candidate, condition, assumptionsText, contextText];
        If[AssociationQ[evidence],
          discharger = candidate;
          Break[]
        ]
      ],
      {candidate, Values[$FTDischargerRegistry]}
    ];
    status = Which[
      machine && FTMachineConditionDischargedQ[expr, assumptions],
        "DischargedByAssumptions",
      machine && FTMachineConditionContradictedQ[expr, assumptions],
        "Contradicted",
      ! machine && FTConditionDischargedByTextQ[condition, assumptionsText, contextText],
        "AssumedFromContext",
      AssociationQ[discharger],
        "DischargedBy" <> Lookup[discharger, "Name", "Discharger"],
      True,
        "Deferred"
    ];
    Switch[status,
      "DischargedByAssumptions" | "AssumedFromContext",
        AppendTo[discharged, Join[condition, <|"Status" -> status|>]],
      "Contradicted",
        AppendTo[contradicted, Join[condition, <|"Status" -> status|>]],
      _,
        If[StringStartsQ[status, "DischargedBy"],
          AppendTo[
            discharged,
            Join[
              condition,
              <|"Status" -> status|>,
              If[AssociationQ[discharger], <|"Discharger" -> Lookup[discharger, "Name", ""], "Evidence" -> evidence|>, <||>]
            ]
          ],
          AppendTo[deferred, Join[condition, <|"Status" -> "Deferred"|>]]
        ]
    ],
    {condition, conditions}
  ];
  <|"Discovered" -> conditions, "Discharged" -> discharged, "Deferred" -> deferred, "Contradicted" -> contradicted|>
];

FTAddObligations[state_Association, new_List, trace_List] := Module[
  {existing = Lookup[state, "Obligations", {}], ids, merged},
  ids = Lookup[#, "Id", ToString[Hash[#]]] & /@ existing;
  merged = Join[
    existing,
    Select[new, ! MemberQ[ids, Lookup[#, "Id", ToString[Hash[#]]]] &]
  ];
  Join[state, <|"Head" -> "FormulaTransformState", "Obligations" -> merged, "Trace" -> trace|>]
];

FTDischargerAppliesQ[discharger_Association, obligation_Association] := Module[{kind},
  kind = Lookup[obligation, "Kind", ""];
  MemberQ[Lookup[discharger, "MatchesObligation", {}], kind]
];

FTDischargerEvidenceRuleMatchQ[rule_Association, obligation_Association, assumptionsText_String, contextText_String] := Module[
  {source, haystack, any, all, obligationKinds, kind},
  obligationKinds = Lookup[rule, "ObligationKinds", {}];
  kind = Lookup[obligation, "Kind", ""];
  If[obligationKinds =!= {} && ! MemberQ[obligationKinds, kind], Return[False]];
  source = Lookup[rule, "Source", "any"];
  haystack = ToLowerCase@Switch[
    source,
    "assumptions", assumptionsText,
    "context", contextText,
    _, assumptionsText <> "\n" <> contextText
  ];
  any = Lookup[rule, "ContainsAny", {}];
  all = Lookup[rule, "ContainsAll", {}];
  (any === {} || AnyTrue[any, StringContainsQ[haystack, #] &]) &&
    (all === {} || AllTrue[all, StringContainsQ[haystack, #] &])
];

FTDischargerEvidenceMatch[discharger_Association, obligation_Association, assumptionsText_String, contextText_String] := Module[
  {rule},
  rule = SelectFirst[
    Lookup[discharger, "EvidenceRules", {}],
    FTDischargerEvidenceRuleMatchQ[#, obligation, assumptionsText, contextText] &,
    Missing["NoEvidence"]
  ];
  If[AssociationQ[rule],
    <|
      "Discharger" -> Lookup[discharger, "Name", ""],
      "Label" -> Lookup[rule, "Label", ""],
      "Source" -> Lookup[rule, "Source", "any"],
      "ObligationKinds" -> Lookup[rule, "ObligationKinds", {}],
      "ContainsAny" -> Lookup[rule, "ContainsAny", {}],
      "ContainsAll" -> Lookup[rule, "ContainsAll", {}]
    |>,
    Missing["NoEvidence"]
  ]
];

FTUpdateStateAfterDischarge[state_Association, discharged_List, remaining_List, trace_List] := Module[
  {previous = Lookup[state, "DischargedObligations", {}]},
  Join[
    state,
    <|
      "Head" -> "FormulaTransformState",
      "Obligations" -> remaining,
      "DischargedObligations" -> Join[previous, discharged],
      "Trace" -> trace
    |>
  ]
];

FTDischargeObligation[state_Association, parameters_Association, assumptions_, assumptionsText_String, contextText_String] := Module[
  {obligations, targetId, selected, remaining, discharged = {}, unresolved = {}, trace, status, expr, machine, discharger, evidence},
  obligations = Lookup[state, "Obligations", {}];
  targetId = FTReadString[Lookup[parameters, "obligationId", Lookup[parameters, "id", ""]]];
  selected = If[targetId === "", obligations, Select[obligations, FTReadString[Lookup[#, "Id", ""]] === targetId &]];
  If[targetId =!= "" && selected === {},
    Return[FTFailure["InvalidRequest", "No matching obligation exists in state.", <|"ObligationId" -> targetId, "State" -> state|>]]
  ];
  trace = FTAppendTrace[Lookup[state, "Trace", {}], "DischargeObligation", <|"ObligationId" -> If[targetId === "", "All", targetId]|>];
  Do[
    expr = Lookup[obligation, "Expr", True];
    machine = TrueQ[Lookup[obligation, "MachineCheckable", True]];
    discharger = Missing["NoDischarger"];
    evidence = Missing["NoEvidence"];
    Do[
      If[FTDischargerAppliesQ[candidate, obligation],
        evidence = FTDischargerEvidenceMatch[candidate, obligation, assumptionsText, contextText];
        If[AssociationQ[evidence],
          discharger = candidate;
          Break[]
        ]
      ],
      {candidate, Values[$FTDischargerRegistry]}
    ];
    status = Which[
      machine && FTMachineConditionDischargedQ[expr, assumptions],
        "DischargedByAssumptions",
      ! machine && FTConditionDischargedByTextQ[obligation, assumptionsText, contextText],
        "AssumedFromContext",
      AssociationQ[discharger],
        "DischargedBy" <> Lookup[discharger, "Name", "Discharger"],
      True,
        "Deferred"
    ];
    If[status === "Deferred",
      AppendTo[unresolved, Join[obligation, <|"Status" -> "Deferred"|>]],
      AppendTo[
        discharged,
        Join[
          obligation,
          <|"Status" -> status|>,
          If[AssociationQ[discharger], <|"Discharger" -> Lookup[discharger, "Name", ""], "Evidence" -> evidence|>, <||>]
        ]
      ]
    ],
    {obligation, selected}
  ];
  remaining = If[targetId === "",
    unresolved,
    Join[Select[obligations, FTReadString[Lookup[#, "Id", ""]] =!= targetId &], unresolved]
  ];
  <|
    "Status" -> "Success",
    "Kind" -> "FormulaTransformObligationDischarge",
    "Requested" -> If[targetId === "", "All", targetId],
    "Discharged" -> discharged,
    "Deferred" -> unresolved,
    "RemainingObligations" -> remaining,
    "State" -> FTUpdateStateAfterDischarge[state, discharged, remaining, trace]
  |>
];

GetFormulaTransformObligations[state_Association] := <|
  "Status" -> "Success",
  "Kind" -> "FormulaTransformObligations",
  "Obligations" -> Lookup[state, "Obligations", {}],
  "Count" -> Length[Lookup[state, "Obligations", {}]]
|>;

FTLoadBuiltInRegistry[];

End[];

EndPackage[];
