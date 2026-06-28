FTApplyRule[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], family = ToLowerCase[Lookup[compiled, "Family", ""]], effectiveName, runtime, targetText, planner},
  effectiveName = ToLowerCase[name];
  runtime = Lookup[compiled, "Runtime", ""];
  targetText = FTTargetRelationText[parameters];
  Which[
    Lookup[compiled, "RegistryKind", ""] === "EstimateSeed",
      FTPlanEstimateSeed[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    Lookup[compiled, "RegistryKind", ""] === "StructuralTransform",
      FTPlanStructuralTransform[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
      runtime === "GenericTemplate" || runtime === "GenericTargetPlanner",
        If[targetText =!= "" && runtime === "GenericTemplate",
          planner = FTFindTargetPlanner[compiled, "GenericTargetPlanner"];
          If[AssociationQ[planner] && Lookup[planner, "Runtime", ""] === "GenericTargetPlanner",
            FTApplyGenericTemplateRule[planner, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace]
          ,
            Return[FTFailure["CompilerPrimitiveMissing", "No generic target planner is available for rule " <> name <> ".", <|"Trace" -> trace, "State" -> state|>]]
          ]
        ,
          FTApplyGenericTemplateRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace]
        ],
    True,
      FTFailure["CompilerPrimitiveMissing", "No runtime primitive exists for compiled rule family: " <> family, <|"Trace" -> trace, "State" -> state|>]
  ]
];

FTPlanRule[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], family = ToLowerCase[Lookup[compiled, "Family", ""]], effectiveName, runtime, targetText, planner},
  effectiveName = ToLowerCase[name];
  runtime = Lookup[compiled, "Runtime", ""];
  targetText = FTTargetRelationText[parameters];
  Which[
    Lookup[compiled, "RegistryKind", ""] === "EstimateSeed",
      FTPlanEstimateSeed[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    Lookup[compiled, "RegistryKind", ""] === "StructuralTransform",
      FTPlanStructuralTransform[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace],
    runtime === "GenericTemplate" || runtime === "GenericTargetPlanner",
      If[targetText =!= "" && runtime === "GenericTemplate",
        planner = FTFindTargetPlanner[compiled, "GenericTargetPlanner"];
        If[AssociationQ[planner] && Lookup[planner, "Runtime", ""] === "GenericTargetPlanner",
          FTPlanGenericTemplateRule[planner, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace]
        ,
          Return[FTFailure["CompilerPrimitiveMissing", "No generic target planner is available for rule " <> name <> ".", <|"Trace" -> trace, "State" -> state|>]]
        ]
      ,
        FTPlanGenericTemplateRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace]
      ],
    True,
      FTSuccess[<|
        "Kind" -> "FormulaTransformPlan",
        "Rule" -> name,
        "Direction" -> direction,
        "Original" -> selected,
        "Selected" -> selected,
        "TargetGuided" -> False,
        "RegistryMutation" -> False,
        "PlanStatus" -> "NoTargetPlanner",
        "Message" -> "No target-guided planner is implemented for this rule family yet.",
        "Trace" -> FTAppendTrace[trace, "PlanNoTargetPlanner", <|"Rule" -> name|>],
        "Conditions" -> <|"Discovered" -> {}, "Discharged" -> {}, "Deferred" -> {}, "Contradicted" -> {}|>,
        "Obligations" -> {},
        "State" -> state
      |>]
  ]
];


FTPrimitiveHeadQ[head_, name_String] := Module[{symbolName},
  symbolName = Quiet@Check[SymbolName[Unevaluated[head]], ""];
  symbolName === name || symbolName === "FTTemplate" <> name
];

(* --- Generic Mathematical Primitives for Data-Driven Target Planners --- *)

FTMatchAlgebraicStructure[expr_, templateString_String] := Module[
  {templateExpr, syms, patternVars, rule, matches},
  templateExpr = FTParseMaybeExpression[templateString];
  If[templateExpr === $Failed, Return[$Failed]];
  syms = Cases[templateExpr, s_Symbol /; StringStartsQ[SymbolName[s], "$"], Infinity, Heads -> True];
  syms = DeleteDuplicates[syms];
  patternVars = (# -> Pattern[Evaluate[Symbol[StringDrop[SymbolName[#], 1]]], Blank[]]) & /@ syms;
  rule = Rule @@ {templateExpr /. patternVars, Map[Symbol[StringDrop[SymbolName[#], 1]] &, syms]};
  matches = Quiet@Check[ReplaceList[expr, rule], {}];
  If[matches === {}, Return[$Failed]];
  AssociationThread[Map[SymbolName, syms] -> First[matches]]
];

FTSolveParameters[bindings_Association, unknowns_List, eqns_List] := Module[
  {parsedEqns, unkSyms, bindingRules, eqnsSubs, sol, finalBindings},
  parsedEqns = Map[FTParseMaybeExpression, eqns];
  If[MemberQ[parsedEqns, $Failed], Return[$Failed]];
  unkSyms = Map[FTParseMaybeExpression, unknowns];
  bindingRules = Normal[KeyMap[FTParseMaybeExpression, bindings]];
  eqnsSubs = parsedEqns /. bindingRules;
  sol = Quiet@Check[Solve[eqnsSubs, unkSyms], {}];
  If[sol === {}, Return[$Failed]];
  finalBindings = Association[Map[SymbolName[#[[1]]] -> #[[2]] &, sol[[1]]]];
  Join[bindings, finalBindings]
];

FTInstantiateTemplate[templateString_String, bindings_Association] := Module[
  {expr, bindingRules},
  expr = FTParseMaybeExpression[templateString];
  If[expr === $Failed, Return[$Failed]];
  bindingRules = Normal[KeyMap[FTParseMaybeExpression, bindings]];
  expr /. bindingRules
];


FTPrimitiveEvaluate[expr_] := FixedPoint[
  ReplaceAll[
    #,
    {
      FTTemplateNormalizeQuotient[quotientExpr_, quotientFactor_] :> Quiet@Check[Simplify[quotientExpr/quotientFactor], quotientExpr/quotientFactor],
      h_[f_, lp_[p_, domain_]] /; FTPrimitiveHeadQ[h, "Norm"] && FTPrimitiveHeadQ[lp, "Lp"] :> Inactive[Norm][f, "L" <> ToString[p, InputForm], domain],
      h_[f_, lq_[q_, domain_]] /; FTPrimitiveHeadQ[h, "Norm"] && FTPrimitiveHeadQ[lq, "Lq"] :> Inactive[Norm][f, "L" <> ToString[q, InputForm], domain],
      h_[f_] /; FTPrimitiveHeadQ[h, "Grad"] :> Inactive[Grad][f],
      h_[a_, b_] /; FTPrimitiveHeadQ[h, "Product"] :> Inactive[Times][a, b],
      h_[body_, domain_] /; FTPrimitiveHeadQ[h, "Integral"] :> Inactive[Integrate][body, domain],
      h_[body_, domain_] /; FTPrimitiveHeadQ[h, "Sum"] :> Inactive[Sum][body, domain],
      h_[body_, var_] /; FTPrimitiveHeadQ[h, "D"] :> Inactive[D][body, var],
      h_[f_, p_, domain_] /; FTPrimitiveHeadQ[h, "NormIntegral"] :> Inactive[Power][Inactive[Integrate][Abs[f]^p, domain], 1/p],
      h_[f_, p_, domain_] /; FTPrimitiveHeadQ[h, "NormSum"] :> Inactive[Power][Inactive[Sum][Abs[f]^p, domain], 1/p],
      h_[epsilon_, p_, q_] /; FTPrimitiveHeadQ[h, "YoungConstant"] :> Inactive[YoungConstant][epsilon, p, q],
      h_[term_] /; FTPrimitiveHeadQ[h, "BoundaryTerm"] :> Inactive[BoundaryTerm][term],
      h_[u_, v_, domain_] /; FTPrimitiveHeadQ[h, "BoundaryTerm"] :> FTIBPBoundaryTerm[u, v, domain],
      h_[u_, v_, domain_] /; FTPrimitiveHeadQ[h, "IBPIntegral"] :> FTIBPInteriorIntegral[u, v, domain],
      h_[f_, space_] /; FTPrimitiveHeadQ[h, "FunctionSpace"] :> Inactive[FunctionSpace][f, space],
      h_[x_] /; FTPrimitiveHeadQ[h, "RealValued"] :> Inactive[RealValued][x],
      h_[x_] /; FTPrimitiveHeadQ[h, "Nonnegative"] :> x >= 0,
      h_[normalizeExpr_, normalizeFactor_] /; FTPrimitiveHeadQ[h, "NormalizeQuotient"] :> Quiet@Check[Simplify[normalizeExpr/normalizeFactor], normalizeExpr/normalizeFactor],
      h_[f_, domain_] /; FTPrimitiveHeadQ[h, "Measurable"] :> Inactive[Measurable][f, domain],
      h_[exprs_, domain_] /; FTPrimitiveHeadQ[h, "MeasurableIntegrable"] :> Inactive[MeasurableIntegrable][exprs, domain],
      h_[regularityExpr_] /; FTPrimitiveHeadQ[h, "Regularity"] :> Inactive[Regularity][regularityExpr],
      h_[traceExpr_, domain_] /; FTPrimitiveHeadQ[h, "BoundaryTrace"] :> Inactive[BoundaryTrace][traceExpr, domain],
      h_[zeroMeanExpr_, domain_] /; FTPrimitiveHeadQ[h, "ZeroMean"] :> Inactive[ZeroMean][zeroMeanExpr, domain],
      h_[domain_] /; FTPrimitiveHeadQ[h, "BoundedLipschitzDomain"] :> Inactive[BoundedLipschitzDomain][domain],
      h_[p_, domain_] /; FTPrimitiveHeadQ[h, "Lp"] :> Inactive[Lp][p, domain],
      h_[domain_] /; FTPrimitiveHeadQ[h, "L2"] :> Inactive[Lp][2, domain],
      h_[domain_] /; FTPrimitiveHeadQ[h, "RegularEnoughForIBP"] :> Inactive[RegularEnoughForIBP][domain]
    }
  ] &,
  expr
];

FTEvaluateTemplate[template_String, bindings_Association] := Module[
  {keys, text = template, tempRules = {}, directRules = {}, symbol, expr, primitiveNames},
  keys = Reverse@SortBy[Keys[bindings], StringLength[ToString[#]] &];
  Do[
    symbol = Unique["ftTemplate$" <> ToString[key] <> "$"];
    text = StringReplace[text, "$" <> ToString[key] -> SymbolName[symbol]];
    AppendTo[tempRules, symbol -> Lookup[bindings, key]];
    If[MemberQ[{"p", "q", "epsilon"}, ToString[key]],
      AppendTo[directRules, Symbol[ToString[key]] -> Lookup[bindings, key]]
    ],
    {key, keys}
  ];
  primitiveNames = {
    "Product", "Integral", "Sum", "NormIntegral", "NormSum", "YoungConstant",
    "BoundaryTerm", "IBPIntegral", "FunctionSpace", "RealValued",
    "Nonnegative", "Measurable", "MeasurableIntegrable", "Regularity", "BoundaryTrace", "ZeroMean", "BoundedLipschitzDomain", "Lp", "L2", "RegularEnoughForIBP", "D",
    "NormalizeQuotient", "NormalizationFactorNonzero", "Norm", "Grad", "Lq"
  };
  Do[
    text = StringReplace[text, RegularExpression["\\b" <> primitive <> "\\["] -> "FTTemplate" <> primitive <> "["],
    {primitive, primitiveNames}
  ];
  expr = Quiet@Check[ToExpression[text, InputForm], $Failed];
  If[expr === $Failed, Return[$Failed]];
  FTPrimitiveEvaluate[expr /. tempRules /. directRules]
];

FTEvaluateTemplate[template_Association, bindings_Association] := Module[
  {predicate, kind, args, evalArgs},
  predicate = Lookup[template, "predicate"];
  kind = Lookup[template, "kind"];
  If[MissingQ[predicate] && MissingQ[kind], Return[template]];
  args = Lookup[template, "arguments", Lookup[template, "args", {}]];
  evalArgs = FTEvaluateTemplate[#, bindings] & /@ args;
  
  If[!MissingQ[predicate],
    Which[
      predicate === "BoundaryTerm", Inactive[BoundaryTerm] @@ evalArgs,
      predicate === "IBPIntegral", Inactive[IBPIntegral] @@ evalArgs,
      predicate === "FunctionSpace",
        If[Length[evalArgs] >= 2,
          Inactive[FunctionSpace][evalArgs[[1]], evalArgs[[2]]],
          template
        ],
      True, template
    ],
    Which[
      kind === "Lp", Inactive[Lp] @@ evalArgs,
      kind === "L2", Inactive[Lp][2, evalArgs[[1]]],
      kind === "RegularEnoughForIBP", Inactive[RegularEnoughForIBP] @@ evalArgs,
      kind === "BoundaryTerm", Inactive[BoundaryTerm] @@ evalArgs,
      kind === "IBPIntegral", Inactive[IBPIntegral] @@ evalArgs,
      True, template
    ]
  ]
];

FTEvaluateTemplate[list_List, bindings_Association] := FTEvaluateTemplate[#, bindings] & /@ list;

FTEvaluateTemplate[value_, bindings_Association] := value;

FTApplyGenericStructuralTransform[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], bindings, derived, orientations, orientation, relationHead, lhs, rhs, relation, conditionTemplates, conditions, discharged, state2, trace2, normalized, reduced, boundaryTerm},
  bindings = FTGenericMatcherBindings[compiled, selected, parameters];
  If[bindings === $Failed,
    Return[FTFailure["Inapplicable", name <> " generic structural matcher did not match the selected expression.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  derived = Lookup[compiled, "DerivedBindings", <||>];
  If[AssociationQ[derived],
    Do[
      bindings = Join[bindings, <|key -> FTEvaluateTemplate[Lookup[derived, key], bindings]|>],
      {key, Keys[derived]}
    ]
  ];
  orientations = Select[
    Lookup[compiled, "Orientations", {}],
    Lookup[#, "direction", "Equal"] === "Equal" || Lookup[#, "direction", "Equal"] === "Auto" &
  ];
  If[orientations === {},
    Return[FTFailure["DirectionUnavailable", "No JSON structural orientation is available for rule " <> name <> ".", <|"Trace" -> trace, "State" -> state|>]]
  ];
  orientation = First[orientations];
  relationHead = Lookup[orientation, "relation", "Equal"];
  If[relationHead =!= "Equal",
    Return[FTFailure["CompilerPrimitiveMissing", "Structural JSON orientations currently support relation=Equal only.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  lhs = FTEvaluateTemplate[Lookup[orientation, "lhs", "$selected"], bindings];
  rhs = FTEvaluateTemplate[Lookup[orientation, "rhs", "$selected"], bindings];
  relation = Equal[lhs, rhs];
  normalized = Lookup[bindings, "normalized", Missing["NotApplicable"]];
  reduced = Lookup[bindings, "reduced", Missing["NotApplicable"]];
  boundaryTerm = Lookup[bindings, "boundaryTerm", Missing["NotApplicable"]];
  trace2 = FTAppendTrace[trace, "ApplyGenericStructuralTransform", <|"Rule" -> name, "Matcher" -> Lookup[bindings, "Matcher", ""], "Orientation" -> Lookup[orientation, "name", ""]|>];
  conditionTemplates = Join[Lookup[compiled, "Conditions", {}], Lookup[orientation, "conditions", {}]];
  conditions = Join[
    {FTRegularityCondition[selected, name]},
    FTCompiledCondition[#, bindings, name] & /@ conditionTemplates
  ];
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, <||>, contextText];
  If[Length[Lookup[discharged, "Contradicted", {}]] > 0,
    Return[FTFailure["AssumptionContradiction", "Assumptions contradict a generated structural transform condition.", <|"Conditions" -> discharged, "Trace" -> trace2, "State" -> state|>]]
  ];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Kind" -> "FormulaTransform",
    "RegistryKind" -> "StructuralTransform",
    "Runtime" -> "GenericStructural",
    "Rule" -> name,
    "Direction" -> "Equal",
    "Original" -> selected,
    "Selected" -> selected,
    "Relation" -> relation,
    "RelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "RelationLatex" -> Quiet@Check[ToString[TeXForm[relation], PageWidth -> Infinity], ""],
    "NormalizedExpression" -> normalized,
    "ReducedExpression" -> reduced,
    "BoundaryTerm" -> boundaryTerm,
    "Trace" -> FTAppendTrace[trace2, "BuildRelation", <|"Direction" -> "Equal"|>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTPlanStructuralTransform[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {runtime},
  If[direction =!= "Auto" && direction =!= "Equal",
    Return[FTFailure["DirectionUnavailable", "Structural transforms are equality transforms; use direction=Equal or Auto.", <|"Trace" -> trace, "State" -> state|>]]
  ];
  runtime = Lookup[compiled, "Runtime", Lookup[compiled, "Name", ""]];
  Switch[runtime,
    "GenericStructural",
      Return[FTApplyGenericStructuralTransform[compiled, selected, direction, parameters, assumptions, assumptionsText, contextText, state, trace]],
    _,
      Return[FTFailure["CompilerPrimitiveMissing", "No structural transform runtime exists for: " <> runtime, <|"Trace" -> trace, "State" -> state|>]]
  ];
  FTFailure["CompilerPrimitiveMissing", "No structural transform runtime exists for: " <> runtime, <|"Trace" -> trace, "State" -> state|>]
];

FTPrepareParameterExpressionBindings[compiled_Association, base_Association] := Module[
  {keys = Lookup[compiled, "ParameterExpressions", {}], result = base, key, value, parsed},
  If[! ListQ[keys], Return[$Failed]];
  Do[
    If[KeyExistsQ[result, key],
      value = Lookup[result, key];
      If[StringQ[value],
        parsed = FTParseMaybeExpression[value];
        If[parsed === $Failed, Return[$Failed]];
        result = Join[result, <|key -> parsed|>]
      ]
    ],
    {key, keys}
  ];
  result
];

FTGenericMatcherBindings[compiled_Association, selected_, parameters_Association] := Module[
  {matchers, defaults, base, matcher, body, kind, slots, parts, factors, operator, domainSlot, varSlot, result = $Failed, integrand, derivU, var, companion, terms, first, second},
  matchers = Lookup[compiled, "Matchers", {}];
  defaults = Lookup[compiled, "ParameterDefaults", <||>];
  base = Join[defaults, parameters, <|"selected" -> selected|>];
  base = FTPrepareParameterExpressionBindings[compiled, base];
  If[base === $Failed, Return[$Failed]];
  Do[
    body = Lookup[matcher, "body", <||>];
    kind = Lookup[body, "kind", ""];
    slots = Lookup[body, "slots", {}];
    operator = Lookup[matcher, "operator", ""];
    domainSlot = Lookup[matcher, "domainSlot", "domain"];
    varSlot = Lookup[matcher, "varSlot", "var"];
    Which[
      (kind === "Whole" || kind === "Selected") && Length[slots] === 0,
        result = Join[base, <|"Matcher" -> Lookup[matcher, "name", kind]|>],
      kind === "Product" && operator === "" && Length[slots] === 2,
        factors = FTProductFactors[selected];
        If[factors =!= $Failed,
          result = Join[base, AssociationThread[slots -> factors], <|"Matcher" -> Lookup[matcher, "name", "Product"]|>]
        ],
      kind === "Product" && (operator === "Integral" || operator === "Sum") && Length[slots] === 2,
        parts = If[operator === "Integral", FTIntegralParts[selected], FTSumParts[selected]];
        If[parts =!= $Failed,
          factors = FTProductFactors[First[parts]];
          If[factors =!= $Failed,
            result = Join[base, AssociationThread[slots -> factors], <|domainSlot -> parts[[2]], "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", operator <> "Product"]|>]
          ]
        ],
      kind === "DerivativeProduct" && operator === "Integral" && Length[slots] === 2,
        parts = FTIntegralParts[selected];
        If[parts =!= $Failed,
          integrand = First[parts];
          If[MatchQ[integrand, Derivative[1][_][_] * _],
            integrand /. Derivative[1][uu_][xx_] * vv_ :> (derivU = uu; var = xx; companion = vv);
            result = Join[
              base,
              AssociationThread[slots -> {derivU, companion}],
              <|domainSlot -> parts[[2]], "DerivativeVariable" -> var, "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", "DerivativeProduct"]|>
            ]
          ]
        ],
      kind === "DerivativeProduct" && operator === "PointwiseDerivative" && Length[slots] === 2,
        If[MatchQ[selected, Inactive[D][_, _]],
          {integrand, var} = List @@ selected;
          factors = FTProductFactors[integrand];
          If[factors =!= $Failed,
            result = Join[
              base,
              AssociationThread[slots -> factors],
              <|varSlot -> var, "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", "PointwiseDerivativeProduct"]|>
            ]
          ]
        ],
      kind === "DerivativeCommutator" && operator === "PointwiseDerivativeCommutator" && Length[slots] === 2,
        terms = FTTerms[selected];
        If[Length[terms] === 2,
          first = SelectFirst[terms, MatchQ[#, Inactive[D][_, _]] &, Missing["NoDerivative"]];
          second = SelectFirst[terms, MatchQ[#, Times[-1, __] | -_] &, Missing["NoSubtractedTerm"]];
          If[MatchQ[first, Inactive[D][_, _]] && ! MatchQ[second, Missing[_]],
            {integrand, var} = List @@ first;
            factors = FTProductFactors[integrand];
            If[factors =!= $Failed,
              Which[
                TrueQ[Quiet@Check[Simplify[second == -factors[[1]] * Inactive[D][factors[[2]], var]], False]],
                  result = Join[
                    base,
                    AssociationThread[slots -> {factors[[1]], factors[[2]]}],
                    <|varSlot -> var, "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", "PointwiseDerivativeCommutator"]|>
                  ],
                TrueQ[Quiet@Check[Simplify[second == -factors[[2]] * Inactive[D][factors[[1]], var]], False]],
                  result = Join[
                    base,
                    AssociationThread[slots -> {factors[[2]], factors[[1]]}],
                    <|varSlot -> var, "Operator" -> operator, "Matcher" -> Lookup[matcher, "name", "PointwiseDerivativeCommutator"]|>
                  ],
                True,
                  Null
              ]
            ]
          ]
        ],
      True,
        Null
    ];
    If[result =!= $Failed, Break[]],
    {matcher, matchers}
  ];
  result
];


FTCompiledCondition[template_Association, bindings_Association, source_String] := Module[
  {predicate, args, evalArgs, expr, kind, machine, space, spaceExpr},
  predicate = Lookup[template, "predicate"];
  args = Lookup[template, "arguments", {}];
  evalArgs = FTEvaluateTemplate[#, bindings] & /@ args;
  
  expr = Which[
    predicate === "FunctionSpace",
      space = If[Length[evalArgs] >= 2, ToString[evalArgs[[2]]], ""];
      spaceExpr = Which[
        space === "Lp", Inactive[Lp][evalArgs[[3]], evalArgs[[4]]],
        space === "L2", Inactive[Lp][2, evalArgs[[3]]],
        space === "RegularEnoughForIBP", Inactive[RegularEnoughForIBP][evalArgs[[3]]],
        True, If[Length[evalArgs] >= 2, evalArgs[[2]], ""]
      ];
      Inactive[FunctionSpace][evalArgs[[1]], spaceExpr],
    predicate === "Measurable",
      Inactive[Measurable][evalArgs[[1]], evalArgs[[2]]],
    predicate === "RealValued",
      Inactive[RealValued][evalArgs[[1]]],
    predicate === "Regularity",
      Inactive[Regularity][evalArgs[[1]]],
    predicate === "BoundaryCondition" || predicate === "BoundaryTerm",
      Inactive[BoundaryTerm] @@ evalArgs,
    predicate === "ExponentConjugacy",
      1/evalArgs[[1]] + 1/evalArgs[[2]] == 1,
    predicate === "MeasurableIntegrable",
      Inactive[MeasurableIntegrable][evalArgs[[1]], evalArgs[[2]]],
    predicate === "Greater" || predicate === "GreaterThan",
      evalArgs[[1]] > evalArgs[[2]],
    True,
      $Failed
  ];
  
  If[expr === $Failed, Return[FTCondition["TemplateCondition", ToString[template], source, False]]];
  
  kind = Which[
    predicate === "RealValued", "RealValued",
    predicate === "FunctionSpace", "FunctionSpaceMembership",
    predicate === "Measurable", "Measurability",
    predicate === "MeasurableIntegrable", "MeasurabilityIntegrability",
    predicate === "Regularity", "Regularity",
    predicate === "BoundaryCondition" || predicate === "BoundaryTerm", "BoundaryCondition",
    predicate === "ExponentConjugacy", "ExponentConjugacy",
    True, "TemplateCondition"
  ];
  
  machine = kind =!= "BoundaryCondition" && FreeQ[expr, Inactive[RealValued] | Inactive[FunctionSpace] | Inactive[Measurable] | Inactive[BoundaryTerm] | Inactive[RegularEnoughForIBP]];
  FTCondition[kind, expr, source, machine]
];

FTCompiledCondition[template_String, bindings_Association, source_String] := Module[{expr, kind, machine},
  If[StringStartsQ[StringTrim[template], "NormalizationFactorNonzero["],
    expr = FTEvaluateTemplate[StringReplace[StringTrim[template], "NormalizationFactorNonzero[" ~~ rest__ ~~ "]" :> rest], bindings];
    If[expr === $Failed, Return[FTCondition["NormalizationFactorNonzero", template, source, False]]];
    Return[FTCondition["NormalizationFactorNonzero", expr != 0, source]]
  ];
  expr = FTEvaluateTemplate[template, bindings];
  If[expr === $Failed, Return[FTCondition["TemplateCondition", template, source, False]]];
  kind = Which[
    MatchQ[expr, Inactive[RealValued][_]], "RealValued",
    MatchQ[expr, Inactive[FunctionSpace][_, _]], "FunctionSpaceMembership",
    MatchQ[expr, Inactive[Measurable][_, _]], "Measurability",
    MatchQ[expr, Inactive[MeasurableIntegrable][_, _]], "MeasurabilityIntegrability",
    MatchQ[expr, Inactive[Regularity][_]], "Regularity",
    MatchQ[expr, Inactive[BoundaryTrace][__]], "BoundaryCondition",
    MatchQ[expr, Inactive[ZeroMean][__]], "NormalizationCondition",
    MatchQ[expr, Inactive[BoundaryTerm][__]], "BoundaryCondition",
    StringStartsQ[StringTrim[template], "BoundaryTerm["], "BoundaryCondition",
    StringStartsQ[StringTrim[template], "Nonnegative["], "Nonnegativity",
    MatchQ[expr, _String], template,
    True, "TemplateCondition"
  ];
  machine = kind =!= "BoundaryCondition" && FreeQ[expr, Inactive[RealValued] | Inactive[FunctionSpace] | Inactive[Measurable] | Inactive[BoundaryTerm] | Inactive[RegularEnoughForIBP]];
  FTCondition[kind, expr, source, machine]
];

FTApplyGenericTemplateRule[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] := Module[
  {name = Lookup[compiled, "Name", ""], runtime = Lookup[compiled, "Runtime", ""], targetText, targetExpr, selectedBindings, targetBindings, unknowns, equations, bindings, derived, orientations, orientation, relationHead, lhs, rhs, terms, relation, conditionTemplates, conditions, discharged, state2, trace2},
  
  If[runtime === "GenericTargetPlanner",
    targetText = FTTargetRelationText[parameters];
    If[targetText === "", 
      Return[FTFailure["Inapplicable", name <> " GenericTargetPlanner requires a target text.", <|"Trace" -> trace, "State" -> state|>]]
    ];
    targetExpr = FTParseMaybeExpression[targetText];
    If[targetExpr === $Failed, Return[FTFailure["Inapplicable", "Could not parse target text.", <|"Trace" -> trace, "State" -> state|>]]];
    If[MatchQ[targetExpr, LessEqual[_, _] | Equal[_, _] | Less[_, _] | Greater[_, _] | GreaterEqual[_, _]], targetExpr = targetExpr[[2]]];
    
    selectedBindings = FTMatchAlgebraicStructure[selected, Lookup[compiled, "selectedTemplate", ""]];
    If[selectedBindings === $Failed, Return[FTFailure["Inapplicable", name <> " selectedTemplate failed.", <|"Trace" -> trace, "State" -> state|>]]];
    
    targetBindings = FTMatchAlgebraicStructure[targetExpr, Lookup[compiled, "targetTemplate", ""]];
    If[targetBindings === $Failed, Return[FTFailure["Inapplicable", name <> " targetTemplate failed.", <|"Trace" -> trace, "State" -> state|>]]];
    
    bindings = Join[selectedBindings, targetBindings, parameters];
    unknowns = Lookup[compiled, "unknownParameters", {}];
    equations = Lookup[compiled, "equations", {}];
    If[Length[equations] > 0 || Length[unknowns] > 0,
      bindings = FTSolveParameters[bindings, unknowns, equations];
      If[bindings === $Failed, Return[FTFailure["Inapplicable", name <> " AlgebraicUnification failed.", <|"Trace" -> trace, "State" -> state|>]]]
    ]
  ,
    bindings = FTGenericMatcherBindings[compiled, selected, parameters];
    If[bindings === $Failed,
      Return[FTFailure["Inapplicable", name <> " generic template matcher did not match the selected formula.", <|"Trace" -> trace, "State" -> state|>]]
    ]
  ];
  derived = Lookup[compiled, "DerivedBindings", <||>];
  If[AssociationQ[derived],
    Do[
      bindings = Join[bindings, <|key -> FTEvaluateTemplate[Lookup[derived, key], bindings]|>],
      {key, Keys[derived]}
    ]
  ];
  orientations = Select[
    Lookup[compiled, "Orientations", {}],
    Lookup[#, "direction", "Auto"] === direction ||
      direction === "Auto" && MemberQ[{"Auto", "Equal"}, Lookup[#, "direction", "Auto"]] &
  ];
  If[orientations === {},
    Return[FTFailure["DirectionUnavailable", "No JSON orientation is available for direction=" <> direction <> " in rule " <> name <> ".", <|"Trace" -> trace, "State" -> state|>]]
  ];
  orientation = First[orientations];
  relationHead = Lookup[orientation, "relation", "LessEqual"];
  relation = Switch[relationHead,
    "LessEqual",
      lhs = FTEvaluateTemplate[Lookup[orientation, "lhs", "$selected"], bindings];
      rhs = FTEvaluateTemplate[Lookup[orientation, "rhs", "$selected"], bindings];
      LessEqual[lhs, rhs],
    "LessEqualChain",
      terms = FTEvaluateTemplate[#, bindings] & /@ Lookup[orientation, "terms", {}];
      Apply[LessEqual, terms],
    "Equal",
      lhs = FTEvaluateTemplate[Lookup[orientation, "lhs", "$selected"], bindings];
      rhs = FTEvaluateTemplate[Lookup[orientation, "rhs", "$selected"], bindings];
      Equal[lhs, rhs],
    _,
      Return[FTFailure["CompilerPrimitiveMissing", "Unsupported JSON orientation relation: " <> relationHead, <|"Trace" -> trace, "State" -> state|>]]
  ];
  conditionTemplates = Join[Lookup[compiled, "Conditions", {}], Lookup[orientation, "conditions", {}]];
  conditions = FTCompiledCondition[#, bindings, name] & /@ conditionTemplates;
  trace2 = FTAppendTrace[trace, "ApplyGenericTemplateRule", <|"Rule" -> name, "Matcher" -> Lookup[bindings, "Matcher", ""], "Orientation" -> Lookup[orientation, "name", ""]|>];
  discharged = FTDischargeConditions[conditions, assumptions, assumptionsText, context, contextText];
  If[Length[Lookup[discharged, "Contradicted", {}]] > 0,
    Return[FTFailure["AssumptionContradiction", "Assumptions contradict a generated transform condition.", <|"Conditions" -> discharged, "Trace" -> trace2, "State" -> state|>]]
  ];
  state2 = FTAddObligations[state, Lookup[discharged, "Deferred", {}], trace2];
  FTSuccess[<|
    "Rule" -> name,
    "Runtime" -> "GenericTemplate",
    "Direction" -> If[direction === "Auto", Lookup[orientation, "direction", "Auto"], direction],
    "Original" -> selected,
    "Selected" -> selected,
    "Relation" -> relation,
    "RelationInputForm" -> ToString[relation, InputForm, PageWidth -> Infinity],
    "RelationLatex" -> Quiet@Check[ToString[TeXForm[relation], PageWidth -> Infinity], ""],
    "Trace" -> FTAppendTrace[trace2, "BuildRelationFromJSON", <|"Relation" -> relationHead|>],
    "Conditions" -> discharged,
    "Obligations" -> Lookup[discharged, "Deferred", {}],
    "State" -> state2
  |>]
];

FTPlanGenericTemplateRule[compiled_Association, selected_, direction_, parameters_, assumptions_, assumptionsText_, context_, contextText_, state_, trace_] :=
  FTApplyGenericTemplateRule[compiled, selected, direction, parameters, assumptions, assumptionsText, context, contextText, state, trace];

