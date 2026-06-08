PPNow[] := DateString[{"ISODate", "T", "Time"}];

PPReadString[value_] := If[StringQ[value], StringTrim[value], ""];

PPParseInput[value_] := Module[{text},
  text = PPReadString[value];
  If[text === "", Return[Missing["EmptyInput"]]];
  Quiet@Check[ToExpression[text, InputForm], text]
];

PPParseContext[value_] := Module[{text, parsed},
  text = PPReadString[value];
  If[text === "", Return[<||>]];
  parsed = Quiet@Check[ToExpression[text, InputForm], $Failed];
  Which[
    AssociationQ[parsed], parsed,
    ListQ[parsed], <|"Assumptions" -> parsed|>,
    True, <|"Raw" -> text|>
  ]
];

PPParsePayload[value_] := PPParseContext[value];

PPStateQ[state_] := AssociationQ[state] && Lookup[state, "Head", ""] === "PPState";
PPGoal[state_Association] := Lookup[state, "Goal", Missing["NoGoal"]];
PPContext[state_Association] := Lookup[state, "Context", <||>];
PPKnown[state_Association] := Lookup[state, "Known", {}];
PPTrace[state_Association] := Lookup[state, "Trace", {}];

PPNormalize[input_, context_: <||>, known_: {}] := <|
  "Head" -> "PPState",
  "Version" -> 2,
  "Goal" -> input,
  "Known" -> If[ListQ[known], known, {known}],
  "Context" -> If[AssociationQ[context], context, <|"Raw" -> context|>],
  "Trace" -> {
    <|
      "Kind" -> "normalize",
      "Message" -> "Created proof-pattern state.",
      "Time" -> PPNow[]
    |>
  }
|>;

PPConditionStatus[kind_, status_, data_: <||>] := Join[
  <|"Kind" -> kind, "Status" -> status|>,
  If[AssociationQ[data], data, <|"Data" -> data|>]
];

PPGoalText[goal_] := ToLowerCase[ToString[Unevaluated[goal], InputForm]];

PPContextValues[context_Association] := Flatten[Normal[context] /. Rule -> List, Infinity];
PPContextValues[_] := {};

PPContextHasText[state_Association?PPStateQ, pattern_String] := Module[
  {needle = ToLowerCase[pattern], goalText, contextText},
  goalText = PPGoalText[PPGoal[state]];
  contextText = ToLowerCase[ToString[PPContextValues[PPContext[state]], InputForm]];
  StringContainsQ[goalText, needle] || StringContainsQ[contextText, needle]
];

PPContextStatus[state_Association?PPStateQ, key_String, kind_String] := Module[
  {context = PPContext[state], value},
  value = Lookup[context, key, Missing["NotProvided"]];
  If[value === Missing["NotProvided"] || value === "" || value === {},
    PPConditionStatus[kind, "NeedsUser"],
    PPConditionStatus[kind, "AssumedFromContext", <|"Value" -> value|>]
  ]
];

PPParameterChoice[direction_, parameter_, condition_, dependencies_: {}] := Module[
  {dir = ToLowerCase[ToString[direction]], status},
  status = If[MemberQ[{"small", "large"}, dir], "GeneratedByParameterChoice", "NeedsUser"];
  <|
    "Kind" -> "ParameterChoice",
    "Direction" -> dir,
    "Parameter" -> parameter,
    "Condition" -> condition,
    "Dependencies" -> If[ListQ[dependencies], dependencies, {dependencies}],
    "Status" -> status
  |>
];

PPRegisteredHeuristicMoves[state_Association?PPStateQ] := Module[
  {goal = PPGoal[state], entries},
  entries = Values[$PPHeuristicRegistry];
  Flatten[
    Map[
      Function[entry,
        Quiet@Check[Lookup[entry, "Function"][goal, state], {}]
      ],
      entries
    ],
    1
  ]
];

PPSuggest[state_Association?PPStateQ, OptionsPattern[]] := Module[{moves},
  moves = PPRegisteredHeuristicMoves[state];
  If[moves === {},
    {
      <|
        "MoveId" -> "no_move",
        "Rule" -> "None",
        "Status" -> "NoCandidate",
        "Message" -> "No registered proof-pattern heuristic matched. Propose a restricted schema with Rule/Transforms/MissingConditions for compile, ask for a decomposition, or register a validated transform; do not inject executable Wolfram code.",
        "RequiredConditions" -> {},
        "Transforms" -> {}
      |>
    },
    moves
  ]
];

PPSuggest[input_, OptionsPattern[]] := PPSuggest[PPNormalize[input]];

PPApply[state_Association?PPStateQ, move_Association] := Module[
  {trace = PPTrace[state], entry},
  entry = <|
    "Kind" -> "apply",
    "MoveId" -> Lookup[move, "MoveId", "unknown"],
    "Rule" -> Lookup[move, "Rule", "unknown"],
    "Conclusion" -> Lookup[move, "Conclusion", Missing["NoConclusion"]],
    "RequiredConditions" -> Lookup[move, "RequiredConditions", {}],
    "ConditionStatus" -> Lookup[move, "ConditionStatus", <||>],
    "Transforms" -> Lookup[move, "Transforms", {}],
    "Time" -> PPNow[]
  |>;
  Join[state, <|
    "LastMove" -> move,
    "Trace" -> Append[trace, entry]
  |>]
];

PPApply[state_Association?PPStateQ, moveId_String] := Module[{move},
  move = MoveById[PPSuggest[state], moveId];
  If[AssociationQ[move], PPApply[state, move], AppendTrace[state, <|"Kind" -> "error", "Message" -> "Move not found: " <> moveId|>]]
];

MoveById[moves_, moveId_] := SelectFirst[moves, Lookup[#, "MoveId", ""] === moveId &, Missing["NotFound"]];

AppendTrace[state_Association?PPStateQ, entry_Association] := Join[
  state,
  <|"Trace" -> Append[PPTrace[state], Join[entry, <|"Time" -> PPNow[]|>]]|>
];

StateSummary[state_Association?PPStateQ] := <|
  "Head" -> "PPState",
  "Version" -> Lookup[state, "Version", 2],
  "Goal" -> PPGoal[state],
  "KnownCount" -> Length[PPKnown[state]],
  "ContextKeys" -> Keys[PPContext[state]],
  "TraceLength" -> Length[PPTrace[state]],
  "LastMove" -> Lookup[Lookup[state, "LastMove", <||>], "MoveId", ""]
|>;

ReadMoveId[args_Association] := Module[{moveId = PPReadString[Lookup[args, "moveId", ""]]},
  If[moveId === "", PPReadString[Lookup[args, "move_id", ""]], moveId]
];

PPRegisterPayload[payload_Association] := Module[{kind = ToLowerCase[PPReadString[Lookup[payload, "Type", Lookup[payload, "type", "Rule"]]]]},
  Switch[kind,
    "transform", RegisterPPTransform[payload],
    "rule", RegisterPPRule[payload],
    _, <|"Status" -> "Rejected", "Issues" -> {"Type must be Rule or Transform. Use operation -> compile for LLM move schemas."}|>
  ]
];

PPRegisterPayload[_] := <|"Status" -> "Rejected", "Issues" -> {"Payload must be an Association."}|>;

PPHandleRequest[args_Association] := Module[
  {operation, goal, context, known, stateText, state, moves, moveId, payload},
  operation = ToLowerCase[PPReadString[Lookup[args, "operation", "suggest"]]];
  goal = PPParseInput[Lookup[args, "goal", ""]];
  context = PPParseContext[Lookup[args, "context", ""]];
  known = PPParseInput[Lookup[args, "known", ""]];
  payload = PPParsePayload[Lookup[args, "payload", ""]];
  known = If[known === Missing["EmptyInput"], {}, If[ListQ[known], known, {known}]];
  stateText = PPReadString[Lookup[args, "state", ""]];
  state = If[stateText === "",
    PPNormalize[goal, context, known],
    Quiet@Check[ToExpression[stateText, InputForm], PPNormalize[goal, context, known]]
  ];
  If[! PPStateQ[state], state = PPNormalize[goal, context, known]];

  Switch[operation,
    "normalize",
      StateSummary[state],
    "suggest",
      PPSuggest[state],
    "apply",
      moves = PPSuggest[state];
      moveId = ReadMoveId[args];
      If[moveId === "" && Length[moves] > 0, moveId = Lookup[First[moves], "MoveId", ""]];
      PPApply[state, moveId],
    "trace",
      PPTrace[state],
    "registry",
      RegistrySummary[],
    "parameter",
      PPParameterChoice[
        Lookup[payload, "Direction", Lookup[payload, "direction", "small"]],
        Lookup[payload, "Parameter", Lookup[payload, "parameter", eps]],
        Lookup[payload, "Condition", Lookup[payload, "condition", Missing["NoCondition"]]],
        Lookup[payload, "Dependencies", Lookup[payload, "dependencies", {}]]
      ],
    "compile",
      CompilePPMoveSchema[payload],
    "register",
      PPRegisterPayload[payload],
    _,
      <|"Status" -> "Error", "Message" -> "Unknown operation: " <> operation|>
  ]
];
