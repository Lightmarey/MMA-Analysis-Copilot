If[!TrueQ[ValueQ[$ScriptCommandLine]], $ScriptCommandLine = {}];
$HistoryLength = 0;

ClearAll[jsonWrite, safeString, parseInput, elapsedMs, withTime, formatResult, handleRequest];

jsonWrite[assoc_Association] := Module[{line},
  line = ExportString[assoc, "RawJSON", "Compact" -> True];
  WriteString[$Output, line <> "\n"];
  Flush[$Output];
];

safeString[expr_] := Quiet@Check[ToString[expr, InputForm, PageWidth -> Infinity], ToString[Unevaluated[expr], InputForm]];
safeTeX[expr_] := Quiet@Check[ToString[TeXForm[expr], PageWidth -> Infinity], ""];

parseInput[s_String] := Quiet@Check[ToExpression[s, InputForm], $Failed];
parseInput[_] := $Failed;

elapsedMs[start_] := Round[1000.0 (AbsoluteTime[] - start)];

withTime[expr_, timeoutMs_Integer] := Module[{seconds},
  seconds = Max[1, timeoutMs/1000.0];
  TimeConstrained[Quiet@Check[expr, $Failed], seconds, $TimedOut]
];

formatResult[id_, title_, start_, result_] := Which[
  result === $TimedOut,
    <|"id" -> id, "ok" -> False, "title" -> title, "error" -> "Wolfram evaluation timed out", "elapsedMs" -> elapsedMs[start]|>,
  result === $Failed,
    <|"id" -> id, "ok" -> False, "title" -> title, "error" -> "Wolfram evaluation failed", "elapsedMs" -> elapsedMs[start]|>,
  True,
    <|"id" -> id, "ok" -> True, "title" -> title, "output" -> safeString[result], "latex" -> safeTeX[result], "elapsedMs" -> elapsedMs[start]|>
];

handleRequest[req_Association] := Module[
  {id, tool, args, timeoutMs, start, expr, var, lower, upper, assumptions, operation, point, direction, method, result},
  id = Lookup[req, "id", Null];
  tool = Lookup[req, "tool", ""];
  args = Lookup[req, "args", <||>];
  timeoutMs = Round@Lookup[req, "timeoutMs", 120000];
  start = AbsoluteTime[];

  Switch[tool,
    "wolfram_eval",
      Module[{},
      result = withTime[ToExpression[Lookup[args, "code", ""], InputForm], timeoutMs];
      formatResult[id, "Wolfram evaluation", start, result]
      ],

    "wolfram_simplify",
      Module[{},
      expr = parseInput[Lookup[args, "expr", ""]];
      assumptions = parseInput[Lookup[args, "assumptions", "True"]];
      operation = Lookup[args, "operation", "FullSimplify"];
      result = withTime[
        Switch[operation,
          "Simplify", Simplify[expr, assumptions],
          "Refine", Refine[expr, assumptions],
          "PowerExpand", PowerExpand[expr],
          _, FullSimplify[expr, assumptions]
        ],
        timeoutMs
      ];
      formatResult[id, operation, start, result]
      ],

    "wolfram_integrate",
      Module[{},
      expr = parseInput[Lookup[args, "expr", ""]];
      var = parseInput[Lookup[args, "variable", "x"]];
      lower = Lookup[args, "lower", ""];
      upper = Lookup[args, "upper", ""];
      assumptions = parseInput[Lookup[args, "assumptions", "True"]];
      result = withTime[
        Assuming[assumptions,
          If[StringLength[StringTrim[lower]] > 0 && StringLength[StringTrim[upper]] > 0,
            Integrate[expr, {var, parseInput[lower], parseInput[upper]}, GenerateConditions -> True],
            Integrate[expr, var, GenerateConditions -> True]
          ]
        ],
        timeoutMs
      ];
      formatResult[id, "Integrate", start, result]
      ],

    "wolfram_limit",
      Module[{},
      expr = parseInput[Lookup[args, "expr", ""]];
      var = parseInput[Lookup[args, "variable", "x"]];
      point = parseInput[Lookup[args, "point", "0"]];
      assumptions = parseInput[Lookup[args, "assumptions", "True"]];
      direction = Lookup[args, "direction", ""];
      result = withTime[
        Assuming[assumptions,
          Switch[direction,
            "FromAbove", Limit[expr, var -> point, Direction -> -1],
            "FromBelow", Limit[expr, var -> point, Direction -> 1],
            _, Limit[expr, var -> point]
          ]
        ],
        timeoutMs
      ];
      formatResult[id, "Limit", start, result]
      ],

    "wolfram_solve",
      Module[{},
      expr = parseInput[Lookup[args, "equations", ""]];
      var = parseInput[Lookup[args, "variables", ""]];
      method = Lookup[args, "method", "Solve"];
      assumptions = parseInput[Lookup[args, "assumptions", "True"]];
      result = withTime[
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
      formatResult[id, method, start, result]
      ],

    _,
      <|"id" -> id, "ok" -> False, "error" -> "Unknown tool: " <> ToString[tool], "elapsedMs" -> elapsedMs[start]|>
  ]
];

inputStream = If[TrueQ[ValueQ[Global`$WMAStdin]], Global`$WMAStdin, $Input];
jsonWrite[<|"id" -> "__worker_ready__", "ok" -> True, "title" -> "Wolfram worker ready"|>];

While[True,
  line = Quiet@Check[ReadLine[inputStream], EndOfFile];
  If[line === EndOfFile, Break[]];
  If[!StringQ[line] || StringLength[StringTrim[line]] == 0, Continue[]];
  req = Quiet@Check[ImportString[line, "RawJSON"], $Failed];
  If[AssociationQ[req],
    jsonWrite[handleRequest[req]],
    jsonWrite[<|"id" -> Null, "ok" -> False, "error" -> "Invalid JSON request"|>]
  ];
];
