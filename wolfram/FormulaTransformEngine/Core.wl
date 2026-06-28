
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


FTFailure[type_String, message_String, extra_: <||>] := Join[
  <|"Status" -> "Failure", "Kind" -> "FormulaTransform", "FailureType" -> type, "Message" -> message|>,
  If[AssociationQ[extra], extra, <||>]
];

FTSuccess[assoc_Association] := Join[<|"Status" -> "Success", "Kind" -> "FormulaTransform"|>, assoc];

FTAppendTrace[trace_List, step_String, data_: <||>] := Append[
  trace,
  Join[<|"Step" -> step, "Time" -> FTNow[]|>, If[AssociationQ[data], data, <|"Data" -> data|>]]
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


