FTHeuristicMatcherBindings[heuristic_Association, selected_] := Module[
  {matchers, matcher, operator, bodySlot, domainSlot, parts, result = $Failed},
  matchers = Lookup[heuristic, "Matchers", {}];
  Do[
    operator = Lookup[matcher, "operator", ""];
    bodySlot = Lookup[matcher, "bodySlot", "h"];
    domainSlot = Lookup[matcher, "domainSlot", "domain"];
    Which[
      operator === "Integral",
        parts = FTIntegralParts[selected];
        If[parts =!= $Failed,
          result = <|bodySlot -> parts[[1]], domainSlot -> parts[[2]], "Operator" -> "Integral", "Matcher" -> Lookup[matcher, "name", "IntegralSingleBody"]|>
        ],
      operator === "Sum",
        parts = FTSumParts[selected];
        If[parts =!= $Failed,
          result = <|bodySlot -> parts[[1]], domainSlot -> parts[[2]], "Operator" -> "Sum", "Matcher" -> Lookup[matcher, "name", "SumSingleBody"]|>
        ],
      True,
        Null
    ];
    If[result =!= $Failed, Break[]],
    {matcher, matchers}
  ];
  result
];

FTApplyHeuristicRewrite[heuristic_Association, selected_] := Module[
  {bindings, rewrite, template, rewritten, conditions, name = Lookup[heuristic, "Name", "Heuristic"]},
  bindings = FTHeuristicMatcherBindings[heuristic, selected];
  If[bindings === $Failed, Return[$Failed]];
  rewrite = Lookup[heuristic, "Rewrite", <||>];
  template = Lookup[rewrite, "template", ""];
  If[! StringQ[template] || StringTrim[template] === "", Return[$Failed]];
  rewritten = FTEvaluateTemplate[template, bindings];
  If[rewritten === $Failed, Return[$Failed]];
  conditions = FTCompiledCondition[#, bindings, name] & /@ Lookup[heuristic, "Conditions", {}];
  <|
    "Heuristic" -> name,
    "Status" -> "Applied",
    "Runtime" -> "JSONHeuristic",
    "Matcher" -> Lookup[bindings, "Matcher", ""],
    "Original" -> selected,
    "Rewritten" -> rewritten,
    "Conditions" -> conditions,
    "GeneratedCondition" -> If[conditions === {}, True, Lookup[First[conditions], "Expr", True]]
  |>
];

FTApplyCompatibleHeuristic[compiled_Association, selected_] := Module[
  {ruleName = Lookup[compiled, "Name", ""], compatible, names, heuristic, result = $Failed},
  compatible = Lookup[compiled, "CompatibleHeuristics", {}];
  names = If[compatible === {}, Keys[$FTHeuristicRegistry], compatible];
  Do[
    heuristic = Lookup[$FTHeuristicRegistry, name, Missing["NotFound"]];
    If[AssociationQ[heuristic] && (Lookup[heuristic, "AppliesTo", {}] === {} || MemberQ[Lookup[heuristic, "AppliesTo", {}], ruleName] || MemberQ[Lookup[heuristic, "AppliesTo", {}], "Holder"]),
      result = FTApplyHeuristicRewrite[heuristic, selected];
      If[AssociationQ[result], Break[]]
    ],
    {name, names}
  ];
  result
];

FTHeuristicNames[compiled_Association, parameters_Association] := Module[
  {allowed = Lookup[parameters, "allowedHeuristics", {}], compatible},
  compatible = DeleteCases[Lookup[compiled, "CompatibleHeuristics", {}], "ExplicitProduct"];
  Which[
    ListQ[allowed] && allowed =!= {},
      Select[allowed, MemberQ[compatible, #] || compatible === {} &],
    compatible =!= {},
      compatible,
    True,
      Keys[$FTHeuristicRegistry]
  ]
];

FTHeuristicGoalQ[compiled_Association, expr_, parameters_Association] :=
  AssociationQ[FTGenericMatcherBindings[compiled, expr, parameters]];

FTHeuristicSearch[compiled_Association, selected_, parameters_Association] := Module[
  {maxDepth, names, queue, visited, node, expr, depth, pipeline, key, parts, heuristic, rewrite, rewritten, rewriteKey, counts, maxApplications, searchTree = {}, nodeId = 0, currentId},
  maxDepth = Lookup[parameters, "maxSearchDepth", 1];
  If[! IntegerQ[maxDepth] || maxDepth < 0, maxDepth = 1];
  names = FTHeuristicNames[compiled, parameters];
  queue = {<|"Expr" -> selected, "Depth" -> 0, "Pipeline" -> {}|>};
  visited = <||>;
  While[queue =!= {},
    node = First[queue];
    queue = Rest[queue];
    expr = Lookup[node, "Expr"];
    depth = Lookup[node, "Depth", 0];
    pipeline = Lookup[node, "Pipeline", {}];
    key = ToString[expr, InputForm, PageWidth -> Infinity];
    If[KeyExistsQ[visited, key], Continue[]];
    visited[key] = True;
    nodeId++;
    currentId = nodeId;
    searchTree = Append[searchTree, <|"Node" -> currentId, "Depth" -> depth, "Expression" -> expr, "ExpressionInputForm" -> key, "Pipeline" -> Lookup[#, "Heuristic", ""] & /@ pipeline, "Status" -> "Visited"|>];
    If[depth > 0 && FTHeuristicGoalQ[compiled, expr, parameters],
      parts = FTIntegralParts[expr];
      If[parts === $Failed, parts = FTSumParts[expr]];
      Return[<|
        "Status" -> "Success",
        "Runtime" -> "HeuristicSearch",
        "Original" -> selected,
        "Rewritten" -> expr,
        "Depth" -> depth,
        "VisitedCount" -> Length[Keys[visited]],
        "SearchTree" -> Append[searchTree, <|"Node" -> currentId, "Depth" -> depth, "Expression" -> expr, "ExpressionInputForm" -> key, "Status" -> "GoalMatched"|>],
        "HeuristicPipeline" -> pipeline,
        "Operator" -> If[parts === $Failed, Missing["Unknown"], parts[[3]]]
      |>]
    ];
    If[depth >= maxDepth, Continue[]];
    Do[
      heuristic = Lookup[$FTHeuristicRegistry, name, Missing["NotFound"]];
      If[AssociationQ[heuristic],
        counts = Counts[Lookup[#, "Heuristic", ""] & /@ pipeline];
        maxApplications = Lookup[heuristic, "MaxApplications", 1];
        If[Lookup[counts, name, 0] < maxApplications,
          rewrite = FTApplyHeuristicRewrite[heuristic, expr];
          If[AssociationQ[rewrite],
            rewritten = Lookup[rewrite, "Rewritten"];
            rewriteKey = ToString[rewritten, InputForm, PageWidth -> Infinity];
            If[! KeyExistsQ[visited, rewriteKey],
              searchTree = Append[searchTree, <|"From" -> currentId, "Depth" -> depth + 1, "Heuristic" -> name, "Status" -> "Queued", "Expression" -> rewritten, "ExpressionInputForm" -> rewriteKey|>];
              queue = Append[queue, <|"Expr" -> rewritten, "Depth" -> depth + 1, "Pipeline" -> Append[pipeline, rewrite]|>],
              searchTree = Append[searchTree, <|"From" -> currentId, "Depth" -> depth + 1, "Heuristic" -> name, "Status" -> "AlreadyVisited", "Expression" -> rewritten, "ExpressionInputForm" -> rewriteKey|>]
            ]
            ,
            searchTree = Append[searchTree, <|"From" -> currentId, "Depth" -> depth + 1, "Heuristic" -> name, "Status" -> "NotApplicable"|>]
          ]
        ]
      ],
      {name, names}
    ]
  ];
  <|
    "Status" -> "Failure",
    "Runtime" -> "HeuristicSearch",
    "Original" -> selected,
    "MaxDepth" -> maxDepth,
    "VisitedCount" -> Length[Keys[visited]],
    "SearchTree" -> searchTree,
    "HeuristicNames" -> names
  |>
];


