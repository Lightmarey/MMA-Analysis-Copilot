$HistoryLength = 0;

ClearAll[WMASafeString, WMASafeTeX, WMAParseInput, WMAElapsedMs, WMAWithTime, WMAFormatResult, WMAHandleRequest];

WMASafeString[expr_] := Quiet@Check[ToString[expr, InputForm, PageWidth -> Infinity], ToString[Unevaluated[expr], InputForm]];
WMASafeTeX[expr_] := Quiet@Check[ToString[TeXForm[expr], PageWidth -> Infinity], ""];

WMAParseInput[s_String] := Quiet@Check[ToExpression[s, InputForm], $Failed];
WMAParseInput[_] := $Failed;

WMAElapsedMs[start_] := Round[1000.0 (AbsoluteTime[] - start)];

WMAWithTime[expr_, timeoutMs_Integer] := Module[{seconds},
  seconds = Max[1, timeoutMs/1000.0];
  TimeConstrained[Quiet@Check[expr, $Failed], seconds, $TimedOut]
];

WMAFormatResult[id_, title_, start_, result_] := Which[
  result === $TimedOut,
    <|"id" -> id, "ok" -> False, "title" -> title, "error" -> "Wolfram evaluation timed out", "elapsedMs" -> WMAElapsedMs[start]|>,
  result === $Failed,
    <|"id" -> id, "ok" -> False, "title" -> title, "error" -> "Wolfram evaluation failed", "elapsedMs" -> WMAElapsedMs[start]|>,
  True,
    <|"id" -> id, "ok" -> True, "title" -> title, "output" -> WMASafeString[result], "latex" -> WMASafeTeX[result], "elapsedMs" -> WMAElapsedMs[start]|>
];

WMAHandleRequest[req_Association] := Module[
  {id, tool, args, timeoutMs, start, expr, var, lower, upper, assumptions, operation, point, direction, method, result},
  id = Lookup[req, "id", Null];
  tool = Lookup[req, "tool", ""];
  args = Lookup[req, "args", <||>];
  timeoutMs = Round@Lookup[req, "timeoutMs", 120000];
  start = AbsoluteTime[];

  If[tool === "wolfram_eval",
    result = WMAWithTime[ToExpression[Lookup[args, "code", ""], InputForm], timeoutMs];
    Return[WMAFormatResult[id, "Wolfram evaluation", start, result]];
  ];

  If[tool === "wolfram_simplify",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    assumptions = WMAParseInput[Lookup[args, "assumptions", "True"]];
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

  If[tool === "wolfram_integrate",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "x"]];
    lower = Lookup[args, "lower", ""];
    upper = Lookup[args, "upper", ""];
    assumptions = WMAParseInput[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        If[StringLength[StringTrim[lower]] > 0 && StringLength[StringTrim[upper]] > 0,
          Integrate[expr, {var, WMAParseInput[lower], WMAParseInput[upper]}, GenerateConditions -> True],
          Integrate[expr, var, GenerateConditions -> True]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, "Integrate", start, result]];
  ];

  If[tool === "wolfram_limit",
    expr = WMAParseInput[Lookup[args, "expr", ""]];
    var = WMAParseInput[Lookup[args, "variable", "x"]];
    point = WMAParseInput[Lookup[args, "point", "0"]];
    assumptions = WMAParseInput[Lookup[args, "assumptions", "True"]];
    direction = Lookup[args, "direction", ""];
    result = WMAWithTime[
      Assuming[assumptions,
        Switch[direction,
          "FromAbove", Limit[expr, var -> point, Direction -> -1],
          "FromBelow", Limit[expr, var -> point, Direction -> 1],
          _, Limit[expr, var -> point]
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
    assumptions = WMAParseInput[Lookup[args, "assumptions", "True"]];
    result = WMAWithTime[
      Assuming[assumptions,
        Switch[method,
          "Reduce", Reduce[expr, var],
          "NSolve", NSolve[expr, var],
          "FindInstance", FindInstance[expr, var],
          _, Solve[expr, var]
        ]
      ],
      timeoutMs
    ];
    Return[WMAFormatResult[id, method, start, result]];
  ];

  <|"id" -> id, "ok" -> False, "error" -> "Unknown tool: " <> ToString[tool], "elapsedMs" -> WMAElapsedMs[start]|>
];
