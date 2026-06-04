IneqCompilerSchemaSummary[] := <|
  "Operation" -> "compile",
  "RequiredKeys" -> {"Rule", "Transforms", "Bindings", "MissingConditions"},
  "AcceptedAliases" -> <|
    "Rule" -> {"rule"},
    "Transforms" -> {"transforms"},
    "Bindings" -> {"bindings"},
    "MissingConditions" -> {"missingConditions", "missing_conditions"}
  |>,
  "OutputKind" -> "RulePlan",
  "Safety" -> "Bindings are retained as inert strings; compile never evaluates LLM-proposed Wolfram code."
|>;

IneqLookupSchemaField[payload_Association, key_String, default_: Missing["NotProvided"]] := Module[
  {aliases},
  aliases = Switch[key,
    "Rule", {"Rule", "rule"},
    "Transforms", {"Transforms", "transforms"},
    "Bindings", {"Bindings", "bindings"},
    "MissingConditions", {"MissingConditions", "missingConditions", "missing_conditions"},
    _, {key}
  ];
  FirstCase[aliases, alias_ /; KeyExistsQ[payload, alias] :> Lookup[payload, alias], default]
];

IneqNormalizeStringList[value_] := Module[{trimmed},
  If[! ListQ[value], Return[$Failed]];
  If[! AllTrue[value, StringQ], Return[$Failed]];
  trimmed = StringTrim /@ value;
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

IneqValidateBindingSchema[bindings_Association] := Module[{rules = Normal[bindings]},
  AllTrue[rules, StringQ[First[#]] && StringTrim[First[#]] =!= "" && StringQ[Last[#]] &]
];

IneqValidateBindingSchema[_] := False;

ValidateIneqMoveSchema[schema_Association] := Module[
  {issues = {}, ruleRaw, rule, transformsRaw, transforms, bindings, missingRaw, missing, unknownTransforms},
  ruleRaw = IneqLookupSchemaField[schema, "Rule", ""];
  transformsRaw = IneqLookupSchemaField[schema, "Transforms", {}];
  bindings = IneqLookupSchemaField[schema, "Bindings", <||>];
  missingRaw = IneqLookupSchemaField[schema, "MissingConditions", {}];

  If[! StringQ[ruleRaw] || StringTrim[ruleRaw] === "",
    AppendTo[issues, "Rule must be a non-empty string."];
    rule = Missing["InvalidRule"],
    rule = IneqCanonicalRegistryName[$IneqRuleRegistry, ruleRaw];
    If[! StringQ[rule], AppendTo[issues, "Unknown rule: " <> StringTrim[ruleRaw]]]
  ];

  transforms = IneqNormalizeStringList[transformsRaw];
  If[transforms === $Failed,
    AppendTo[issues, "Transforms must be a string list."];
    transforms = {},
    transforms = IneqCanonicalRegistryName[$IneqTransformRegistry, #] & /@ transforms;
    unknownTransforms = Select[transforms, ! StringQ[#] &];
    If[unknownTransforms =!= {},
      AppendTo[issues, "Every transform must already be registered."]
    ]
  ];

  If[! IneqValidateBindingSchema[bindings],
    AppendTo[issues, "Bindings must be an Association of non-empty string keys to inert string values."]
  ];

  missing = IneqNormalizeStringList[missingRaw];
  If[missing === $Failed,
    AppendTo[issues, "MissingConditions must be a string list."];
    missing = {}
  ];

  <|
    "Valid" -> issues === {},
    "Issues" -> issues,
    "Normalized" -> <|
      "Rule" -> rule,
      "Transforms" -> DeleteDuplicates[Select[transforms, StringQ]],
      "Bindings" -> If[AssociationQ[bindings], Association @ KeyValueMap[#1 -> StringTrim[#2] &, bindings], <||>],
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
    "Transforms" -> Lookup[normalized, "Transforms", {}],
    "Bindings" -> Lookup[normalized, "Bindings", <||>],
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
