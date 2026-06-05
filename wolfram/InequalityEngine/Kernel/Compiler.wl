IneqCompilerSchemaSummary[] := <|
  "Operation" -> "compile",
  "RequiredKeys" -> {"Rule", "Transforms", "Bindings", "MissingConditions"},
  "AcceptedAliases" -> <|
    "Rule" -> {"rule", "RuleIntent", "ruleIntent", "TransformIntent", "transformIntent", "SuppliedTransform", "suppliedTransform", "MoveName", "moveName"},
    "Transforms" -> {"transforms", "Steps", "steps", "TransformSteps", "transformSteps"},
    "Bindings" -> {"bindings", "BindingMap", "bindingMap"},
    "MissingConditions" -> {"missingConditions", "missing_conditions", "MissingSideConditions", "missingSideConditions", "MissingAnalyticAssumptions", "missingAnalyticAssumptions"},
    "SideConditions" -> {"sideConditions", "side_conditions", "RequiredConditions", "requiredConditions"}
  |>,
  "OutputKind" -> "RulePlan",
  "Safety" -> "Bindings are retained as inert strings; compile never evaluates LLM-proposed Wolfram code."
|>;

IneqLookupSchemaField[payload_Association, key_String, default_: Missing["NotProvided"]] := Module[
  {aliases},
  aliases = Switch[key,
    "Rule", {"Rule", "rule", "RuleIntent", "ruleIntent", "TransformIntent", "transformIntent", "SuppliedTransform", "suppliedTransform", "MoveName", "moveName"},
    "Transforms", {"Transforms", "transforms", "Steps", "steps", "TransformSteps", "transformSteps"},
    "Bindings", {"Bindings", "bindings", "BindingMap", "bindingMap"},
    "MissingConditions", {"MissingConditions", "missingConditions", "missing_conditions", "MissingSideConditions", "missingSideConditions", "MissingAnalyticAssumptions", "missingAnalyticAssumptions"},
    "SideConditions", {"SideConditions", "sideConditions", "side_conditions", "RequiredConditions", "requiredConditions"},
    _, {key}
  ];
  FirstCase[aliases, alias_ /; KeyExistsQ[payload, alias] :> Lookup[payload, alias], default]
];

IneqInertString[value_] := If[StringQ[value], StringTrim[value], StringTrim[ToString[value, InputForm]]];

IneqNormalizeStringList[value_] := Module[{trimmed},
  If[AssociationQ[value],
    Return[KeyValueMap[
      IneqInertString[#1] <> ": " <> IneqInertString[#2] &,
      value
    ]]
  ];
  If[! ListQ[value], Return[$Failed]];
  trimmed = IneqInertString /@ value;
  If[! AllTrue[trimmed, # =!= "" &], Return[$Failed]];
  trimmed
];

IneqCanonicalRegistryName[registry_Association, name_String] := Module[
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

IneqKnownRuleNameQ[name_String] := StringQ[IneqCanonicalRegistryName[$IneqRuleRegistry, name]];
IneqKnownTransformNameQ[name_String] := StringQ[IneqCanonicalRegistryName[$IneqTransformRegistry, name]];

IneqNormalizeBindings[bindings_Association] := Module[{rules = Normal[bindings]},
  If[
    AllTrue[rules, IneqInertString[First[#]] =!= "" &],
    Association @ Map[
      IneqInertString[First[#]] -> IneqInertString[Last[#]] &,
      rules
    ],
    $Failed
  ]
];

IneqNormalizeBindings[bindings_List] := Module[{rules = bindings},
  If[
    AllTrue[rules, MatchQ[#, (_Rule | _RuleDelayed)] &],
    Association @ Map[
      IneqInertString[First[#]] -> IneqInertString[Last[#]] &,
      rules
    ],
    $Failed
  ]
];

IneqNormalizeBindings[_] := $Failed;

ValidateIneqMoveSchema[schema_Association] := Module[
  {issues = {}, ruleRaw, rule, ruleKnown = False, transformsRaw, transforms, registeredTransforms, adHocTransforms, bindings, normalizedBindings, missingRaw, missing, sideRaw, side},
  ruleRaw = IneqLookupSchemaField[schema, "Rule", ""];
  transformsRaw = IneqLookupSchemaField[schema, "Transforms", {}];
  bindings = IneqLookupSchemaField[schema, "Bindings", <||>];
  missingRaw = IneqLookupSchemaField[schema, "MissingConditions", {}];
  sideRaw = IneqLookupSchemaField[schema, "SideConditions", {}];

  If[! StringQ[ruleRaw] || StringTrim[ruleRaw] === "",
    AppendTo[issues, "Rule must be a non-empty string."];
    rule = Missing["InvalidRule"],
    rule = IneqCanonicalRegistryName[$IneqRuleRegistry, ruleRaw];
    If[StringQ[rule],
      ruleKnown = True,
      rule = StringTrim[ruleRaw]
    ]
  ];

  transforms = IneqNormalizeStringList[transformsRaw];
  If[transforms === $Failed,
    AppendTo[issues, "Transforms must be a string list."];
    transforms = {};
    registeredTransforms = {};
    adHocTransforms = {},
    registeredTransforms = DeleteDuplicates[Select[IneqCanonicalRegistryName[$IneqTransformRegistry, #] & /@ transforms, StringQ]];
    adHocTransforms = DeleteDuplicates @ Select[
      transforms,
      ! StringQ[IneqCanonicalRegistryName[$IneqTransformRegistry, #]] &
    ]
  ];

  normalizedBindings = IneqNormalizeBindings[bindings];
  If[normalizedBindings === $Failed,
    AppendTo[issues, "Bindings must be an Association of non-empty string keys to inert string values."]
  ];

  missing = IneqNormalizeStringList[missingRaw];
  If[missing === $Failed,
    AppendTo[issues, "MissingConditions must be a string list."];
    missing = {}
  ];

  side = IneqNormalizeStringList[sideRaw];
  If[side === $Failed,
    AppendTo[issues, "SideConditions must be a string list."];
    side = {}
  ];

  <|
    "Valid" -> issues === {},
    "Issues" -> issues,
    "Normalized" -> <|
      "Rule" -> rule,
      "RuleSource" -> If[ruleKnown, "Registered", "AdHocRuleIntent"],
      "Transforms" -> DeleteDuplicates[registeredTransforms],
      "AdHocTransforms" -> DeleteDuplicates[adHocTransforms],
      "Bindings" -> If[AssociationQ[normalizedBindings], normalizedBindings, <||>],
      "SideConditions" -> side,
      "MissingConditions" -> missing
    |>
  |>
];

ValidateIneqMoveSchema[_] := <|
  "Valid" -> False,
  "Issues" -> {"Move schema must be an Association."},
  "Normalized" -> <||>
|>;

CompileIneqMoveSchema[schema_Association] := Module[
  {validation, normalized, missing},
  validation = ValidateIneqMoveSchema[schema];
  If[! TrueQ[Lookup[validation, "Valid", False]],
    Return[<|
      "Status" -> "Rejected",
      "Kind" -> "RulePlan",
      "Issues" -> Lookup[validation, "Issues", {}],
      "AllowedRules" -> Keys[$IneqRuleRegistry],
      "AllowedTransforms" -> Keys[$IneqTransformRegistry],
      "Safety" -> "No LLM-proposed Wolfram code was evaluated."
    |>]
  ];

  normalized = Lookup[validation, "Normalized", <||>];
  missing = Lookup[normalized, "MissingConditions", {}];
  <|
    "Status" -> "Compiled",
    "Kind" -> "RulePlan",
    "Rule" -> Lookup[normalized, "Rule", ""],
    "RuleSource" -> Lookup[normalized, "RuleSource", "AdHocRuleIntent"],
    "Transforms" -> Lookup[normalized, "Transforms", {}],
    "AdHocTransforms" -> Lookup[normalized, "AdHocTransforms", {}],
    "Bindings" -> Lookup[normalized, "Bindings", <||>],
    "SideConditions" -> Lookup[normalized, "SideConditions", {}],
    "MissingConditions" -> missing,
    "ConditionStatus" -> Map[
      IneqConditionStatus["MissingCondition", "NeedsUser", <|"Condition" -> #|>] &,
      missing
    ],
    "Safety" -> "Bindings are inert strings. Apply/register steps must use validated engine rules and transforms."
  |>
];

CompileIneqMoveSchema[_] := <|
  "Status" -> "Rejected",
  "Kind" -> "RulePlan",
  "Issues" -> {"Move schema must be an Association."},
  "Safety" -> "No LLM-proposed Wolfram code was evaluated."
|>;
