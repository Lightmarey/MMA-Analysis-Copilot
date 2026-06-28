$HistoryLength = 0;

Get[FileNameJoin[{DirectoryName[$InputFileName], "ProofPatternEngine.wl"}]];
Get[FileNameJoin[{DirectoryName[$InputFileName], "FormulaTransformEngine.wl"}]];

ClearAll[
  WMASafeString, WMASafeTeX, WMAParseInput, WMAParseAssumptions,
  WMAParseInteger, WMAElapsedMs, WMAWithTime, WMAJsonValue, WMAFormatResult, WMAFormatFormulaTransformResult,
  WMAHandleRequest
];

WMASafeString[expr_] := Quiet@Check[ToString[expr, InputForm, PageWidth -> Infinity], ToString[Unevaluated[expr], InputForm]];
WMASafeTeX[expr_] := Quiet@Check[ToString[TeXForm[expr], PageWidth -> Infinity], ""];

WMAParseInput[s_String] := Module[{trimmed},
  trimmed = StringTrim[s];
  If[trimmed === "", Return[$Failed]];
  Quiet@Check[ToExpression[trimmed, InputForm], $Failed]
];
WMAParseInput[expr_] := expr;

WMAParseAssumptions[s_String] := Module[{trimmed, parsed},
  trimmed = StringTrim[s];
  If[trimmed === "", Return[True]];
  parsed = WMAParseInput[trimmed];
  If[parsed === $Failed, True, parsed]
];
WMAParseAssumptions[_] := True;

WMAParseInteger[value_, default_Integer] := Module[{parsed},
  parsed = Quiet@Check[If[IntegerQ[value], value, ToExpression[ToString[value], InputForm]], default];
  If[IntegerQ[parsed], parsed, default]
];

WMAElapsedMs[start_] := Round[1000.0 (AbsoluteTime[] - start)];

WMAWithTime[expr_, timeoutMs_Integer] := Module[{seconds},
  seconds = Max[1, timeoutMs/1000.0];
  TimeConstrained[Quiet@Check[expr, $Failed], seconds, $TimedOut]
];

WMAJsonValue[assoc_Association] := Association@KeyValueMap[#1 -> WMAJsonValue[#2] &, assoc];
WMAJsonValue[list_List] := WMAJsonValue /@ list;
WMAJsonValue[value_String] := value;
WMAJsonValue[value_?BooleanQ] := value;
WMAJsonValue[value_Integer] := value;
WMAJsonValue[value_Real] := value;
WMAJsonValue[Null] := Null;
WMAJsonValue[value_] := WMASafeString[value];

WMAFormatResult[id_, title_, start_, result_] := Module[{value, condition},
  Which[
    result === $TimedOut,
      <|"id" -> id, "ok" -> False, "title" -> title, "error" -> "Wolfram evaluation timed out", "elapsedMs" -> WMAElapsedMs[start]|>,
    result === $Failed,
      <|"id" -> id, "ok" -> False, "title" -> title, "error" -> "Wolfram evaluation failed", "elapsedMs" -> WMAElapsedMs[start]|>,
    MatchQ[result, ConditionalExpression[_, _]],
      value = result[[1]];
      condition = result[[2]];
      <|
        "id" -> id,
        "ok" -> True,
        "title" -> title,
        "output" -> WMASafeString[value],
        "latex" -> WMASafeTeX[value],
        "conditions" -> WMASafeString[condition],
        "conditionLatex" -> WMASafeTeX[condition],
        "rawOutput" -> WMASafeString[result],
        "rawLatex" -> WMASafeTeX[result],
        "elapsedMs" -> WMAElapsedMs[start]
      |>,
    True,
      <|"id" -> id, "ok" -> True, "title" -> title, "output" -> WMASafeString[result], "latex" -> WMASafeTeX[result], "elapsedMs" -> WMAElapsedMs[start]|>
  ]
];

WMAFormatFormulaTransformResult[id_, title_, start_, result_] := Module[{formatted},
  formatted = WMAFormatResult[id, title, start, result];
  If[TrueQ[Lookup[formatted, "ok", False]] && AssociationQ[result],
    Join[formatted, <|"json" -> WMAJsonValue[result]|>],
    formatted
  ]
];

WMAHandleRequest[req_Association] := Module[
  {
    id, tool, args, timeoutMs, start, expr, var, lower, upper, assumptions,
    operation, point, direction, method, result, order, funcs, transform,
    targetVar, matrix, lhs, rhs, expected, series, normal, difference,
    coefficientRules, residual
  },
  id = Lookup[req, "id", Null];
  tool = Lookup[req, "tool", ""];
  args = Lookup[req, "args", <||>];
  timeoutMs = Round@Lookup[req, "timeoutMs", 120000];
  start = AbsoluteTime[];

  If[tool === "wolfram_eval",
    result = WMAWithTime[ToExpression[Lookup[args, "code", ""], InputForm], timeoutMs];
    Return[WMAFormatResult[id, "Wolfram evaluation", start, result]];
  ];

  If[tool === "proof_pattern_engine" || tool === "inequality_engine",
    result = WMAWithTime[ProofPatternEngine`PPHandleRequest[args], timeoutMs];
    Return[WMAFormatResult[id, "Proof pattern engine", start, result]];
  ];

  If[tool === "formula_transform",
    result = WMAWithTime[FormulaTransformEngine`FormulaTransformHandleRequest[args], timeoutMs];
    Return[WMAFormatFormulaTransformResult[id, "Formula transform", start, result]];
  ];

  If[tool === "wolfram_simplify",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    operation = Lookup[args, "operation", "FullSimplify"];
    result = WMAWithTime[
      Switch[operation,
        "Simplify", Simplify[expr, assumptions],
        "Refine", Refine[expr, assumptions],
        "PowerExpand", PowerExpand[expr],
        _, FullSimplify[expr, assumptions]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, operation, start, result]];
  ];

  If[tool === "wolfram_equivalence_check",
    lhs = WMAParseInput[Lookup[args, "lhs", ""]];
    rhs = WMAParseInput[Lookup[args, "rhs", ""]];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    method = Lookup[args, "mode", "auto"];
    result = WMAWithTime[
      Assuming[assumptions,
        Switch[method,
          "difference_zero",
            FullSimplify[lhs - rhs == 0, assumptions],
          "equivalent",
            FullSimplify[Equivalent[lhs, rhs], assumptions],
          "reduce_equivalence",
            FullSimplify[Reduce[Implies[assumptions, Equivalent[lhs, rhs]]], assumptions],
          _,
            <|
              "DifferenceZero" -> FullSimplify[lhs - rhs == 0, assumptions],
              "Equivalent" -> FullSimplify[Equivalent[lhs, rhs], assumptions]
            |>
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Equivalence check", start, result]];
  ];

  If[tool === "wolfram_integrate",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "x"]];
    lower = Lookup[args, "lower", ""];
    upper = Lookup[args, "upper", ""];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        If[StringLength[StringTrim[lower]] > 0 && StringLength[StringTrim[upper]] > 0,
          With[{v = var, lo = WMAParseInput[lower], hi = WMAParseInput[upper]},
            Integrate[expr, {v, lo, hi}, GenerateConditions -> True]
          ],
          With[{v = var},
            Integrate[expr, v, GenerateConditions -> True]
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Integrate", start, result]];
  ];

  If[tool === "wolfram_differentiate",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "x"]];
    order = WMAParseInteger[Lookup[args, "order", 1], 1];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, ord = Max[1, order]},
          D[expr, {v, ord}]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Differentiate", start, result]];
  ];

  If[tool === "wolfram_limit",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "x"]];
    point = WMAParseInput[Lookup[args, "point", "0"]];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    direction = Lookup[args, "direction", ""];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, pt = point},
          Switch[direction,
            "FromAbove", Limit[expr, v -> pt, Direction -> -1],
            "FromBelow", Limit[expr, v -> pt, Direction -> 1],
            _, Limit[expr, v -> pt]
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Limit", start, result]];
  ];

  If[tool === "wolfram_solve",
    expr = WMAParseInput[Lookup[args, "equations", ""]];
    var = WMAParseInput[Lookup[args, "variables", ""]];
    method = Lookup[args, "method", "Solve"];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var},
          Switch[method,
            "Reduce", Reduce[expr, v],
            "NSolve", NSolve[expr, v],
            "FindInstance", FindInstance[expr, v],
            _, Solve[expr, v]
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, method, start, result]];
  ];

  If[tool === "wolfram_algebra",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    operation = Lookup[args, "operation", "Factor"];
    var = WMAParseInput[Lookup[args, "variable", ""]];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        Switch[operation,
          "Expand", Expand[expr],
          "Apart", Apart[expr],
          "Together", Together[expr],
          "Cancel", Cancel[expr],
          "Collect", If[var === $Failed, Collect[expr, Variables[expr]], With[{v = var}, Collect[expr, v]]],
          _, Factor[expr]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, operation, start, result]];
  ];

  If[tool === "wolfram_matrix",
    matrix = WMAParseInput[Lookup[args, "matrix", ""]];
    operation = Lookup[args, "operation", "Det"];
    var = WMAParseInput[Lookup[args, "variable", "lambda"]];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{m = matrix, v = If[var === $Failed, Symbol["lambda"], var]},
          Switch[operation,
            "Inverse", Inverse[m],
            "Eigenvalues", Eigenvalues[m],
            "Eigensystem", Eigensystem[m],
            "CharacteristicPolynomial", CharacteristicPolynomial[m, v],
            "RowReduce", RowReduce[m],
            "MatrixRank", MatrixRank[m],
            "Tr", Tr[m],
            _, Det[m]
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, operation, start, result]];
  ];

  If[tool === "wolfram_series",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "x"]];
    point = WMAParseInput[Lookup[args, "point", "0"]];
    order = WMAParseInteger[Lookup[args, "order", 5], 5];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, pt = point, ord = order},
          Normal@Series[expr, {v, pt, ord}]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Series", start, result]];
  ];

  If[tool === "series_coefficient_check",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "x"]];
    point = WMAParseInput[Lookup[args, "point", "0"]];
    order = WMAParseInteger[Lookup[args, "order", 5], 5];
    expected = WMAParseInput[Lookup[args, "expected", ""]];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, pt = point, ord = order, exp = expected},
          series = Series[expr, {v, pt, ord}];
          normal = Normal[series];
          coefficientRules = Table[
            (v - pt)^k -> FullSimplify[SeriesCoefficient[expr, {v, pt, k}], assumptions],
            {k, 0, ord}
          ];
          If[exp === $Failed,
            <|
              "Series" -> series,
              "Normal" -> normal,
              "CoefficientRules" -> coefficientRules
            |>,
            difference = FullSimplify[normal - exp, assumptions];
            residual = Quiet@Check[Series[expr - exp, {v, pt, ord}], $Failed];
            <|
              "Series" -> series,
              "Normal" -> normal,
              "Expected" -> exp,
              "DifferenceZero" -> FullSimplify[difference == 0, assumptions],
              "Difference" -> difference,
              "ResidualSeries" -> residual,
              "CoefficientRules" -> coefficientRules
            |>
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Series coefficient check", start, result]];
  ];

  If[tool === "wolfram_sum",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "k"]];
    lower = Lookup[args, "lower", ""];
    upper = Lookup[args, "upper", ""];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, lo = WMAParseInput[lower], hi = WMAParseInput[upper]},
          Which[
            StringLength[StringTrim[lower]] > 0 && StringLength[StringTrim[upper]] > 0,
              Sum[expr, {v, lo, hi}, GenerateConditions -> True],
            StringLength[StringTrim[upper]] > 0,
              Sum[expr, {v, hi}, GenerateConditions -> True],
            True,
              Sum[expr, {v}, GenerateConditions -> True]
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Sum", start, result]];
  ];

  If[tool === "wolfram_convergence",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "k"]];
    lower = Lookup[args, "lower", ""];
    upper = Lookup[args, "upper", ""];
    operation = Lookup[args, "operation", "SumConvergence"];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, lo = WMAParseInput[lower], hi = WMAParseInput[upper]},
          Switch[operation,
            "IntegralConditions",
              If[StringLength[StringTrim[lower]] > 0 && StringLength[StringTrim[upper]] > 0,
                Integrate[expr, {v, lo, hi}, GenerateConditions -> True],
                $Failed
              ],
            _,
              Which[
                StringLength[StringTrim[lower]] > 0 && StringLength[StringTrim[upper]] > 0,
                  SumConvergence[expr, {v, lo, hi}],
                StringLength[StringTrim[upper]] > 0,
                  SumConvergence[expr, {v, hi}],
                True,
                  SumConvergence[expr, v]
              ]
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, operation, start, result]];
  ];

  If[tool === "wolfram_dsolve",
    expr = WMAParseInput[Lookup[args, "equations", ""]];
    funcs = WMAParseInput[Lookup[args, "functions", ""]];
    var = WMAParseInput[Lookup[args, "variable", "x"]];
    method = Lookup[args, "method", "DSolve"];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, f = funcs},
          Switch[method,
            "DSolveValue", DSolveValue[expr, f, v],
            "NDSolve", NDSolve[expr, f, v],
            _, DSolve[expr, f, v]
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, method, start, result]];
  ];

  If[tool === "wolfram_transform",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "t"]];
    targetVar = WMAParseInput[Lookup[args, "targetVariable", "s"]];
    transform = Lookup[args, "transform", "LaplaceTransform"];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, tv = targetVar},
          Switch[transform,
            "InverseLaplaceTransform", InverseLaplaceTransform[expr, tv, v],
            "FourierTransform", FourierTransform[expr, v, tv],
            "InverseFourierTransform", InverseFourierTransform[expr, tv, v],
            "MellinTransform", MellinTransform[expr, v, tv],
            "InverseMellinTransform", InverseMellinTransform[expr, tv, v],
            "ZTransform", ZTransform[expr, v, tv],
            "InverseZTransform", InverseZTransform[expr, tv, v],
            _, LaplaceTransform[expr, v, tv]
          ]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, transform, start, result]];
  ];

  If[tool === "wolfram_residue",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "z"]];
    point = WMAParseInput[Lookup[args, "point", "0"]];
    assumptions = WMAParseAssumptions[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        With[{v = var, pt = point},
          Residue[expr, {v, pt}]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Residue", start, result]];
  ];

  <|"id" -> id, "ok" -> False, "error" -> "Unknown tool: " <> ToString[tool], "elapsedMs" -> WMAElapsedMs[start]|>
];
