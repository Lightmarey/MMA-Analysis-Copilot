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


