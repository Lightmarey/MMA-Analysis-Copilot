If[! ValueQ[$PPRuleRegistry] || ! AssociationQ[$PPRuleRegistry],
  $PPRuleRegistry = <||>
];

If[! ValueQ[$PPTransformRegistry] || ! AssociationQ[$PPTransformRegistry],
  $PPTransformRegistry = <||>
];

If[! ValueQ[$PPHeuristicRegistry] || ! AssociationQ[$PPHeuristicRegistry],
  $PPHeuristicRegistry = <||>
];

PPDataDirectory[] := FileNameJoin[{$PPPackageDirectory, "Data"}];

PPValidateStringField[payload_Association, key_] := StringQ[Lookup[payload, key, ""]] && StringTrim[Lookup[payload, key, ""]] =!= "";

PPValidateStringListField[payload_Association, key_] := Module[{value = Lookup[payload, key, {}]},
  ListQ[value] && AllTrue[value, StringQ[#] && StringTrim[#] =!= "" &]
];

ValidatePPRule[rule_Association] := Module[{issues = {}},
  If[! PPValidateStringField[rule, "Name"], AppendTo[issues, "Name must be a non-empty string."]];
  If[! PPValidateStringField[rule, "Family"], AppendTo[issues, "Family must be a non-empty string."]];
  If[! PPValidateStringField[rule, "CanonicalForm"], AppendTo[issues, "CanonicalForm must be a non-empty string."]];
  If[! PPValidateStringListField[rule, "Conditions"], AppendTo[issues, "Conditions must be a string list."]];
  If[KeyExistsQ[rule, "Transforms"] && ! PPValidateStringListField[rule, "Transforms"], AppendTo[issues, "Transforms must be a string list when present."]];
  <|"Valid" -> issues === {}, "Issues" -> issues|>
];

ValidatePPRule[_] := <|"Valid" -> False, "Issues" -> {"Rule schema must be an Association."}|>;

ValidatePPTransform[transform_Association] := Module[{issues = {}},
  If[! PPValidateStringField[transform, "Name"], AppendTo[issues, "Name must be a non-empty string."]];
  If[! PPValidateStringField[transform, "Description"], AppendTo[issues, "Description must be a non-empty string."]];
  If[KeyExistsQ[transform, "Cost"] && ! NumericQ[Lookup[transform, "Cost"]], AppendTo[issues, "Cost must be numeric when present."]];
  <|"Valid" -> issues === {}, "Issues" -> issues|>
];

ValidatePPTransform[_] := <|"Valid" -> False, "Issues" -> {"Transform schema must be an Association."}|>;

PPRuleQ[rule_] := TrueQ[Lookup[ValidatePPRule[rule], "Valid", False]];
PPTransformQ[transform_] := TrueQ[Lookup[ValidatePPTransform[transform], "Valid", False]];

RegisterPPRule[rule_Association] := Module[{name = Lookup[rule, "Name", ""], validation},
  validation = ValidatePPRule[rule];
  If[! TrueQ[Lookup[validation, "Valid", False]], Return[Join[<|"Status" -> "Rejected"|>, validation]]];
  $PPRuleRegistry[StringTrim[name]] = rule;
  <|"Status" -> "Registered", "Kind" -> "Rule", "Name" -> StringTrim[name], "Rule" -> rule|>
];

RegisterPPRule[rule_] := Join[<|"Status" -> "Rejected"|>, ValidatePPRule[rule]];

RegisterPPTransform[transform_Association] := Module[{name = Lookup[transform, "Name", ""], validation},
  validation = ValidatePPTransform[transform];
  If[! TrueQ[Lookup[validation, "Valid", False]], Return[Join[<|"Status" -> "Rejected"|>, validation]]];
  $PPTransformRegistry[StringTrim[name]] = transform;
  <|"Status" -> "Registered", "Kind" -> "Transform", "Name" -> StringTrim[name], "Transform" -> transform|>
];

RegisterPPTransform[transform_] := Join[<|"Status" -> "Rejected"|>, ValidatePPTransform[transform]];

RegisterPPHeuristic[name_String, fn_] := Module[{trimmed = StringTrim[name]},
  If[trimmed === "", Return[<|"Status" -> "Rejected", "Issues" -> {"Heuristic name must be non-empty."}|>]];
  $PPHeuristicRegistry[trimmed] = <|"Name" -> trimmed, "Function" -> fn|>;
  <|"Status" -> "Registered", "Kind" -> "Heuristic", "Name" -> trimmed|>
];

RegisterPPHeuristic[_, _] := <|"Status" -> "Rejected", "Issues" -> {"Heuristic registration requires a name and function."}|>;

PPImportJSONAssociation[file_] := Module[{data},
  data = Quiet@Check[Import[file, "RawJSON"], $Failed];
  If[AssociationQ[data], data, <|"__InvalidFile" -> file|>]
];

PPLoadDataFiles[subdir_String, register_] := Module[{dir, files, results},
  dir = FileNameJoin[{PPDataDirectory[], subdir}];
  files = Sort@FileNames["*.json", dir];
  results = register /@ (PPImportJSONAssociation /@ files);
  <|"Directory" -> dir, "Files" -> files, "Results" -> results|>
];

PPLoadBuiltInRegistry[] := Module[{},
  $PPRuleRegistry = <||>;
  $PPTransformRegistry = <||>;
  <|
    "Rules" -> PPLoadDataFiles["Rules", RegisterPPRule],
    "Transforms" -> PPLoadDataFiles["Transforms", RegisterPPTransform]
  |>
];

PPLoadBuiltInHeuristics[] := Module[{},
  $PPHeuristicRegistry = <||>;
  RegisterProductIntegralHeuristics[];
  RegisterSumProductHeuristics[];
  RegisterProductPointwiseHeuristics[];
  RegisterIntegrationByPartsHeuristics[];
  RegisterFunctionSpaceHeuristics[];
  <|"Heuristics" -> Keys[$PPHeuristicRegistry]|>
];

RegistrySummary[] := <|
  "Package" -> "ProofPatternEngine",
  "CompatibilityAliases" -> {"inequality_engine", "InequalityEngine"},
  "Rules" -> Keys[$PPRuleRegistry],
  "Transforms" -> Keys[$PPTransformRegistry],
  "Heuristics" -> Keys[$PPHeuristicRegistry],
  "RuleCount" -> Length[$PPRuleRegistry],
  "TransformCount" -> Length[$PPTransformRegistry],
  "HeuristicCount" -> Length[$PPHeuristicRegistry],
  "LLMMoveSchema" -> PPCompilerSchemaSummary[]
|>;
