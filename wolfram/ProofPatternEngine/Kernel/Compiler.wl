PPCompilerSchemaSummary[] := <|
  "Operation" -> "compile",
  "RequiredKeys" -> {"RuleIntent"},
  "OptionalKeys" -> {"TransformIntents", "ConditionIntents", "MissingConditionIntents"},
  "AcceptedAliases" -> <|
    "RuleIntent" -> {"Rule", "rule", "RuleIntent", "ruleIntent", "TransformIntent", "transformIntent", "SuppliedTransform", "suppliedTransform", "MoveName", "moveName", "MoveLabel", "moveLabel", "SuppliedMove", "suppliedMove", "Name", "name", "Label", "label"},
    "TransformIntents" -> {"Transforms", "transforms", "TransformIntents", "transformIntents", "Steps", "steps", "TransformSteps", "transformSteps", "TransformationSteps", "transformationSteps", "Transformation", "transformation", "Transform", "transform"},
    "ConditionIntents" -> {"ConditionIntents", "conditionIntents", "SideConditionIntents", "sideConditionIntents", "SideConditions", "sideConditions", "side_conditions", "RequiredConditions", "requiredConditions"},
    "MissingConditionIntents" -> {"MissingConditionIntents", "missingConditionIntents", "MissingConditions", "missingConditions", "missing_conditions", "MissingSideConditions", "missingSideConditions", "MissingAnalyticAssumptions", "missingAnalyticAssumptions", "MissingAssumptions", "missingAssumptions"}
  |>,
  "OutputKind" -> "RulePlan",
  "Safety" -> "Compile records only proof-move intent. Do not include concrete formulas, bindings, parameter values, or problem-specific side conditions."
|>;

PPLookupSchemaField[payload_Association, key_String, default_: Missing["NotProvided"]] := Module[
  {aliases},
  aliases = Switch[key,
    "RuleIntent", {"Rule", "rule", "RuleIntent", "ruleIntent", "TransformIntent", "transformIntent", "SuppliedTransform", "suppliedTransform", "MoveName", "moveName", "MoveLabel", "moveLabel", "SuppliedMove", "suppliedMove", "Name", "name", "Label", "label"},
    "TransformIntents", {"Transforms", "transforms", "TransformIntents", "transformIntents", "Steps", "steps", "TransformSteps", "transformSteps", "TransformationSteps", "transformationSteps", "Transformation", "transformation", "Transform", "transform"},
    "ConditionIntents", {"ConditionIntents", "conditionIntents", "SideConditionIntents", "sideConditionIntents", "SideConditions", "sideConditions", "side_conditions", "RequiredConditions", "requiredConditions"},
    "MissingConditionIntents", {"MissingConditionIntents", "missingConditionIntents", "MissingConditions", "missingConditions", "missing_conditions", "MissingSideConditions", "missingSideConditions", "MissingAnalyticAssumptions", "missingAnalyticAssumptions", "MissingAssumptions", "missingAssumptions"},
    _, {key}
  ];
  FirstCase[aliases, alias_ /; KeyExistsQ[payload, alias] :> Lookup[payload, alias], default]
];

PPInertString[value_] := If[StringQ[value], StringTrim[value], StringTrim[ToString[value, InputForm]]];

PPNormalizeStringList[value_] := Module[{trimmed},
  If[StringQ[value],
    trimmed = StringTrim[value];
    Return[If[trimmed === "" || ToLowerCase[trimmed] === "none", {}, {trimmed}]]
  ];
  If[AssociationQ[value],
    Return[KeyValueMap[
      PPInertString[#1] <> ": " <> PPInertString[#2] &,
      value
    ]]
  ];
  If[! ListQ[value], Return[$Failed]];
  trimmed = PPInertString /@ value;
  If[! AllTrue[trimmed, # =!= "" &], Return[$Failed]];
  trimmed
];

PPProblemSpecificIntentStringQ[value_String] := StringContainsQ[
  value,
  RegularExpression["(\\[|\\]|->|==|<=|>=|!=|\\$|\\\\|\\{|\\}|\\(|\\)|\\^|[A-Za-z]\\s*[<>=])"]
];

PPValidateIntentStrings[label_String, values_List] := Module[{bad},
  bad = Select[values, PPProblemSpecificIntentStringQ];
  If[bad === {},
    {},
    {label <> " must contain only generic proof intent labels, not concrete formulas, bindings, parameter values, or problem-specific side conditions."}
  ]
];

PPSchemaHasAnyKey[payload_Association, keys_List] := AnyTrue[keys, KeyExistsQ[payload, #] &];

PPCanonicalRegistryName[registry_Association, name_String] := Module[
  {trimmed = StringTrim[name], folded, dashed},
  folded = ToLowerCase[trimmed];
  dashed = StringReplace[folded, "_" -> "-"];
  Which[
    KeyExistsQ[registry, trimmed], trimmed,
    True,
      SelectFirst[
        Keys[registry],
        ToLowerCase[#] === folded || ToLowerCase[#] === dashed || StringReplace[ToLowerCase[#], "_" -> "-"] === dashed &,
        Missing["UnknownName"]
      ]
  ]
];

PPKnownRuleNameQ[name_String] := StringQ[PPCanonicalRegistryName[$PPRuleRegistry, name]];
PPKnownTransformNameQ[name_String] := StringQ[PPCanonicalRegistryName[$PPTransformRegistry, name]];

ValidatePPMoveSchema[schema_Association] := Module[
  {issues = {}, ruleRaw, rule, ruleKnown = False, transformsRaw, transforms, registeredTransforms, adHocTransforms, missingRaw, missing, sideRaw, side},
  ruleRaw = PPLookupSchemaField[schema, "RuleIntent", ""];
  transformsRaw = PPLookupSchemaField[schema, "TransformIntents", {}];
  missingRaw = PPLookupSchemaField[schema, "MissingConditionIntents", {}];
  sideRaw = PPLookupSchemaField[schema, "ConditionIntents", {}];

  If[PPSchemaHasAnyKey[schema, {"Bindings", "bindings", "BindingMap", "bindingMap"}],
    AppendTo[issues, "Compile schema must be intent-only; put concrete formulas and bindings in the proof state or verification tool arguments, not in the schema."]
  ];

  If[! StringQ[ruleRaw] || StringTrim[ruleRaw] === "",
    AppendTo[issues, "RuleIntent must be a non-empty string."];
    rule = Missing["InvalidRule"],
    rule = PPCanonicalRegistryName[$PPRuleRegistry, ruleRaw];
    If[StringQ[rule],
      ruleKnown = True,
      rule = StringTrim[ruleRaw]
    ];
    issues = Join[issues, PPValidateIntentStrings["RuleIntent", {PPInertString[ruleRaw]}]]
  ];

  transforms = PPNormalizeStringList[transformsRaw];
  If[transforms === $Failed,
    AppendTo[issues, "TransformIntents must be a string list."];
    transforms = {};
    registeredTransforms = {};
    adHocTransforms = {},
    registeredTransforms = DeleteDuplicates[Select[PPCanonicalRegistryName[$PPTransformRegistry, #] & /@ transforms, StringQ]];
    adHocTransforms = DeleteDuplicates @ Select[
      transforms,
      ! StringQ[PPCanonicalRegistryName[$PPTransformRegistry, #]] &
    ];
    issues = Join[issues, PPValidateIntentStrings["TransformIntents", transforms]]
  ];

  missing = PPNormalizeStringList[missingRaw];
  If[missing === $Failed,
    AppendTo[issues, "MissingConditionIntents must be a string list."];
    missing = {},
    issues = Join[issues, PPValidateIntentStrings["MissingConditionIntents", missing]]
  ];

  side = PPNormalizeStringList[sideRaw];
  If[side === $Failed,
    AppendTo[issues, "ConditionIntents must be a string list."];
    side = {},
    issues = Join[issues, PPValidateIntentStrings["ConditionIntents", side]]
  ];

  <|
    "Valid" -> issues === {},
    "Issues" -> issues,
    "Normalized" -> <|
      "RuleIntent" -> rule,
      "RuleSource" -> If[ruleKnown, "Registered", "AdHocRuleIntent"],
      "TransformIntents" -> DeleteDuplicates[registeredTransforms],
      "AdHocTransformIntents" -> DeleteDuplicates[adHocTransforms],
      "ConditionIntents" -> side,
      "MissingConditionIntents" -> missing
    |>
  |>
];

ValidatePPMoveSchema[_] := <|
  "Valid" -> False,
  "Issues" -> {"Move schema must be an Association."},
  "Normalized" -> <||>
|>;

CompilePPMoveSchema[schema_Association] := Module[
  {validation, normalized, missing},
  validation = ValidatePPMoveSchema[schema];
  If[! TrueQ[Lookup[validation, "Valid", False]],
    Return[<|
      "Status" -> "Rejected",
      "Kind" -> "RulePlan",
      "Issues" -> Lookup[validation, "Issues", {}],
      "AllowedRules" -> Keys[$PPRuleRegistry],
      "AllowedTransforms" -> Keys[$PPTransformRegistry],
      "Safety" -> "No LLM-proposed Wolfram code was evaluated. Compile accepts only generic proof intent labels."
    |>]
  ];

  normalized = Lookup[validation, "Normalized", <||>];
  missing = Lookup[normalized, "MissingConditionIntents", {}];
  <|
    "Status" -> "Compiled",
    "Kind" -> "RulePlan",
    "RuleIntent" -> Lookup[normalized, "RuleIntent", ""],
    "RuleSource" -> Lookup[normalized, "RuleSource", "AdHocRuleIntent"],
    "TransformIntents" -> Lookup[normalized, "TransformIntents", {}],
    "AdHocTransformIntents" -> Lookup[normalized, "AdHocTransformIntents", {}],
    "ConditionIntents" -> Lookup[normalized, "ConditionIntents", {}],
    "MissingConditionIntents" -> missing,
    "ConditionStatus" -> Map[
      PPConditionStatus["MissingCondition", "NeedsUser", <|"Condition" -> #|>] &,
      missing
    ],
    "Safety" -> "Compile records only proof-move intent. Concrete formulas must be checked by structured Wolfram tools."
  |>
];

CompilePPMoveSchema[_] := <|
  "Status" -> "Rejected",
  "Kind" -> "RulePlan",
  "Issues" -> {"Move schema must be an Association."},
  "Safety" -> "No LLM-proposed Wolfram code was evaluated. Compile accepts only generic proof intent labels."
|>;
