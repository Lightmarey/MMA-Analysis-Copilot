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
  {slots = {"selected"}, parameters, defaults, expressions, matchers, derived, plannerTemplates, unknownParameters},
  parameters = Lookup[assoc, "parameters", {}];
  defaults = Lookup[assoc, "parameterDefaults", <||>];
  expressions = Lookup[assoc, "parameterExpressions", {}];
  matchers = Cases[Lookup[assoc, "matchers", {}], _Association, Infinity];
  derived = Lookup[assoc, "derivedBindings", <||>];
  plannerTemplates = <|
    "selectedTemplate" -> Lookup[assoc, "selectedTemplate", ""],
    "targetTemplate" -> Lookup[assoc, "targetTemplate", ""]
  |>;
  unknownParameters = Lookup[assoc, "unknownParameters", {}];
  If[StringQ[unknownParameters], unknownParameters = {unknownParameters}];
  slots = Join[
    slots,
    If[ListQ[parameters], Cases[parameters, p_Association :> Lookup[p, "name", Nothing]], {}],
    If[AssociationQ[defaults], Keys[defaults], {}],
    If[ListQ[expressions], Select[expressions, StringQ], {}],
    Cases[matchers, a_Association /; KeyExistsQ[a, "slots"] :> Lookup[a, "slots"], Infinity] // Flatten,
    Cases[matchers, a_Association /; KeyExistsQ[a, "domainSlot"] :> Lookup[a, "domainSlot"], Infinity],
    Cases[matchers, a_Association /; KeyExistsQ[a, "bodySlot"] :> Lookup[a, "bodySlot"], Infinity],
    Cases[matchers, a_Association /; KeyExistsQ[a, "varSlot"] :> Lookup[a, "varSlot"], Infinity],
    If[Lookup[assoc, "kind", ""] === "TargetPlanner", FTTemplateSlotRefs[plannerTemplates], {}],
    If[ListQ[unknownParameters], StringTrim[StringReplace[Select[unknownParameters, StringQ], StartOfString ~~ "$" -> ""]], {}],
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
    "Norm", "Grad", "Inactive"
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
  {issues = {}, name, rules, family, runtime, objective, primitives, allowedPrimitives,
   selectedTemplate, targetTemplate, unknowns, equations, obligationsTemplate,
   orientations, conditions, derivedBindings, parameterDefaults},
  If[! FTValidateName[planner], AppendTo[issues, "name must be a non-empty string."]];
  name = StringTrim[Lookup[planner, "name", ""]];
  rules = Lookup[planner, "rules", {}];
  If[StringQ[rules], rules = {rules}];
  family = Lookup[planner, "families", {}];
  If[StringQ[family], family = {family}];
  runtime = FTReadString[Lookup[planner, "runtime", ""]];
  objective = FTReadString[Lookup[planner, "objective", ""]];
  
  selectedTemplate = Lookup[planner, "selectedTemplate", ""];
  targetTemplate = Lookup[planner, "targetTemplate", ""];
  unknowns = Lookup[planner, "unknownParameters", {}];
  equations = Lookup[planner, "equations", {}];
  obligationsTemplate = Lookup[planner, "obligationsTemplate", {}];
  orientations = Lookup[planner, "orientations", {}];
  conditions = Lookup[planner, "conditions", {}];
  derivedBindings = Lookup[planner, "derivedBindings", <||>];
  parameterDefaults = Lookup[planner, "parameterDefaults", <||>];

  primitives = Lookup[planner, "primitives", {}];
  If[StringQ[primitives], primitives = {primitives}];
  allowedPrimitives = {
    "ParseTargetRelation", "MatchTargetLHS", "ExtractProductFactors",
    "InferAbsorbedQuadraticFactor", "InferResidualFactor",
    "ComputeProductCoefficient", "BuildResidualCoefficientCondition",
    "ParseIntegralOrSumProduct", "ParseWeightParameter",
    "InferWeightFromNormPair", "BuildWeightedHolderBound",
    "BuildWeightPositiveCondition", "BuildFunctionSpaceObligations",
    "MatchAlgebraicStructure", "AlgebraicUnification",
    "InstantiateTemplate", "InstantiateObligations"
  };
  If[! FTValidateStringList[rules] && rules =!= {}, AppendTo[issues, "rules must be a string or string list."]];
  If[! FTValidateStringList[family] && family =!= {}, AppendTo[issues, "families must be a string or string list."]];
  If[! FTValidateStringList[primitives] && primitives =!= {}, AppendTo[issues, "primitives must be a string or string list."]];
  If[ListQ[primitives] && Complement[primitives, allowedPrimitives] =!= {},
    AppendTo[issues, "primitives contains unsupported planner primitives: " <> StringRiffle[Complement[primitives, allowedPrimitives], ", "]]
  ];
  If[runtime === "", AppendTo[issues, "runtime must be a non-empty string."]];
  If[! MemberQ[{"YoungAbsorption", "WeightedHolder", "GenericTargetPlanner"}, runtime],
    AppendTo[issues, "runtime must be one of: YoungAbsorption, WeightedHolder, GenericTargetPlanner."]
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
    "selectedTemplate" -> selectedTemplate,
    "SelectedTemplate" -> selectedTemplate,
    "targetTemplate" -> targetTemplate,
    "TargetTemplate" -> targetTemplate,
    "unknownParameters" -> unknowns,
    "UnknownParameters" -> unknowns,
    "equations" -> equations,
    "Equations" -> equations,
    "Orientations" -> orientations,
    "Conditions" -> conditions,
    "DerivedBindings" -> derivedBindings,
    "ParameterDefaults" -> parameterDefaults,
    "ObligationsTemplate" -> obligationsTemplate,
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


FTLoadBuiltInRegistry[];


