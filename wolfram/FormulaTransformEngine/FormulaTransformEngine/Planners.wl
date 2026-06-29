FTTargetPlannerMatchesQ[planner_Association, compiled_Association, runtime_String] := Module[
  {name, family, rules, families},
  If[Lookup[planner, "Runtime", ""] =!= runtime, Return[False]];
  name = ToLowerCase@Lookup[compiled, "Name", ""];
  family = ToLowerCase@Lookup[compiled, "Family", ""];
  rules = ToLowerCase /@ Lookup[planner, "Rules", {}];
  families = ToLowerCase /@ Lookup[planner, "Families", {}];
  (rules === {} || MemberQ[rules, name]) ||
    (family =!= "" && AnyTrue[families, StringContainsQ[family, #] || StringContainsQ[#, family] &])
];

FTFindTargetPlanner[compiled_Association, runtime_String] := Module[{matches},
  matches = Select[Values[$FTTargetPlannerRegistry], FTTargetPlannerMatchesQ[#, compiled, runtime] &];
  If[matches === {}, Missing["NoTargetPlanner", runtime], Last[matches]]
];

FTPlannerPrimitiveAudit[planner_Association, executed_List] := Module[{declared = Lookup[planner, "Primitives", {}]},
  <|
    "Declared" -> declared,
    "Executed" -> (<|"Primitive" -> #, "Status" -> If[MemberQ[declared, #], "Executed", "UndeclaredExecution"]|> & /@ executed),
    "MissingRequired" -> Complement[executed, declared],
    "UnusedDeclared" -> Complement[declared, executed]
  |>
];

FTRequirePlannerPrimitives[planner_Association, required_List, trace_, state_] := Module[
  {missing = Complement[required, Lookup[planner, "Primitives", {}]]},
  If[missing === {},
    Null,
    FTFailure[
      "CompilerPrimitiveMissing",
      "TargetPlanner descriptor is missing required planner primitives: " <> StringRiffle[missing, ", "],
      <|"Trace" -> trace, "State" -> state, "TargetPlanner" -> Lookup[planner, "Name"], "MissingPrimitives" -> missing|>
    ]
  ]
];


