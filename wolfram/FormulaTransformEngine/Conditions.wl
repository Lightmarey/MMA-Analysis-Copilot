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


FTInstantiateObligations[obligationsTemplate_List, bindings_Association, source_String] := Module[
  {bindingRules, conds = {}},
  bindingRules = Normal[KeyMap[FTParseMaybeExpression, bindings]];
  Do[
    With[{pred = Lookup[t, "predicate"], args = Lookup[t, "arguments", {}]},
      AppendTo[conds, FTConditionStructure[pred, Inactive[Evaluate[Symbol[pred]]] @@ Map[ReplaceAll[FTParseMaybeExpression[#], bindingRules]&, args]]]
    ],
    {t, obligationsTemplate}
  ];
  conds
];

(* ----------------------------------------------------------------------- *)


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


