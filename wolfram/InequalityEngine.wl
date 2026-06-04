BeginPackage["InequalityEngine`"];

IneqNormalize::usage = "IneqNormalize[input, context] creates a proof-rule state for expression-pattern matching.";
IneqSuggest::usage = "IneqSuggest[state] returns candidate proof-rule or transform moves for a proof state.";
IneqApply::usage = "IneqApply[state, move] applies one candidate move and appends proof trace.";
IneqTrace::usage = "IneqTrace[state] returns the proof trace stored in a state.";
IneqHandleRequest::usage = "IneqHandleRequest[args] handles ai4math proof_pattern_engine tool requests.";
RegisterIneqRule::usage = "RegisterIneqRule[rule] registers an inequality rule association.";
RegisterIneqTransform::usage = "RegisterIneqTransform[transform] registers a transform association.";
ValidateIneqRule::usage = "ValidateIneqRule[rule] validates the restricted inequality rule schema.";
ValidateIneqTransform::usage = "ValidateIneqTransform[transform] validates the restricted transform schema.";
ValidateIneqMoveSchema::usage = "ValidateIneqMoveSchema[schema] validates an LLM-proposed restricted proof move schema without evaluating injected code.";
CompileIneqMoveSchema::usage = "CompileIneqMoveSchema[schema] compiles a validated restricted proof move schema into a safe proof-rule plan.";
IneqParameterChoice::usage = "IneqParameterChoice[direction, parameter, condition, dependencies] creates a small/large parameter proof obligation.";

Begin["`Private`"];

ClearAll[
  $IneqRuleRegistry, $IneqTransformRegistry, IneqNow, IneqReadString,
  IneqParseInput, IneqParseContext, IneqStateQ, IneqGoal,
  IneqContext, IneqKnown, IneqTrace, IneqNormalize, IneqSuggest,
  IneqApply, IneqHandleRequest, RegisterIneqRule, RegisterIneqTransform,
  ValidateIneqRule, ValidateIneqTransform, ValidateIneqMoveSchema,
  CompileIneqMoveSchema, IneqParameterChoice,
  ProductIntegralMoves, SumProductMoves, ProductPointwiseMoves,
  IntegrationByPartsMoves,
  AbstractInequalityMoves,
  HolderConclusion, HolderConditions, CauchySchwarzConclusion,
  CauchySchwarzConditions, CauchySchwarzSumConclusion,
  CauchySchwarzSumConditions, YoungConclusion, YoungEpsilonConclusion,
  YoungConditions, IntegrationByPartsConclusion, IntegrationByPartsConditions,
  PoincareMove, SobolevMove,
  ReadMoveId, MoveById, AppendTrace, StateSummary, RegistrySummary,
  IneqValidateStringField, IneqValidateStringListField, IneqRegisterPayload,
  IneqParsePayload, IneqRuleQ, IneqTransformQ, IneqConditionStatus,
  IneqGoalText, IneqContextValues, IneqContextHasText, IneqContextStatus,
  IneqLookupSchemaField, IneqNormalizeStringList, IneqValidateBindingSchema,
  IneqCanonicalRegistryName, IneqKnownRuleNameQ, IneqKnownTransformNameQ,
  IneqCompilerSchemaSummary
];

If[! ValueQ[$IneqRuleRegistry] || ! AssociationQ[$IneqRuleRegistry],
  $IneqRuleRegistry = <||>
];

If[! ValueQ[$IneqTransformRegistry] || ! AssociationQ[$IneqTransformRegistry],
  $IneqTransformRegistry = <||>
];

IneqNow[] := DateString[{"ISODate", "T", "Time"}];

IneqReadString[value_] := If[StringQ[value], StringTrim[value], ""];

IneqParseInput[value_] := Module[{text},
  text = IneqReadString[value];
  If[text === "", Return[Missing["EmptyInput"]]];
  Quiet@Check[ToExpression[text, InputForm], text]
];

IneqParseContext[value_] := Module[{text, parsed},
  text = IneqReadString[value];
  If[text === "", Return[<||>]];
  parsed = Quiet@Check[ToExpression[text, InputForm], $Failed];
  Which[
    AssociationQ[parsed], parsed,
    ListQ[parsed], <|"Assumptions" -> parsed|>,
    True, <|"Raw" -> text|>
  ]
];

IneqParsePayload[value_] := IneqParseContext[value];

IneqStateQ[state_] := AssociationQ[state] && Lookup[state, "Head", ""] === "IneqState";
IneqGoal[state_Association] := Lookup[state, "Goal", Missing["NoGoal"]];
IneqContext[state_Association] := Lookup[state, "Context", <||>];
IneqKnown[state_Association] := Lookup[state, "Known", {}];
IneqTrace[state_Association] := Lookup[state, "Trace", {}];

IneqNormalize[input_, context_: <||>, known_: {}] := <|
  "Head" -> "IneqState",
  "Version" -> 1,
  "Goal" -> input,
  "Known" -> If[ListQ[known], known, {known}],
  "Context" -> If[AssociationQ[context], context, <|"Raw" -> context|>],
  "Trace" -> {
    <|
      "Kind" -> "normalize",
      "Message" -> "Created proof-rule pattern state.",
      "Time" -> IneqNow[]
    |>
  }
|>;

IneqValidateStringField[payload_Association, key_] := StringQ[Lookup[payload, key, ""]] && StringTrim[Lookup[payload, key, ""]] =!= "";

IneqValidateStringListField[payload_Association, key_] := Module[{value = Lookup[payload, key, {}]},
  ListQ[value] && AllTrue[value, StringQ[#] && StringTrim[#] =!= "" &]
];

ValidateIneqRule[rule_Association] := Module[{issues = {}},
  If[! IneqValidateStringField[rule, "Name"], AppendTo[issues, "Name must be a non-empty string."]];
  If[! IneqValidateStringField[rule, "Family"], AppendTo[issues, "Family must be a non-empty string."]];
  If[! IneqValidateStringField[rule, "CanonicalForm"], AppendTo[issues, "CanonicalForm must be a non-empty string."]];
  If[! IneqValidateStringListField[rule, "Conditions"], AppendTo[issues, "Conditions must be a string list."]];
  <|"Valid" -> issues === {}, "Issues" -> issues|>
];

ValidateIneqRule[_] := <|"Valid" -> False, "Issues" -> {"Rule schema must be an Association."}|>;

ValidateIneqTransform[transform_Association] := Module[{issues = {}},
  If[! IneqValidateStringField[transform, "Name"], AppendTo[issues, "Name must be a non-empty string."]];
  If[! IneqValidateStringField[transform, "Description"], AppendTo[issues, "Description must be a non-empty string."]];
  If[KeyExistsQ[transform, "Cost"] && ! NumericQ[Lookup[transform, "Cost"]], AppendTo[issues, "Cost must be numeric when present."]];
  <|"Valid" -> issues === {}, "Issues" -> issues|>
];

ValidateIneqTransform[_] := <|"Valid" -> False, "Issues" -> {"Transform schema must be an Association."}|>;

IneqRuleQ[rule_] := TrueQ[Lookup[ValidateIneqRule[rule], "Valid", False]];
IneqTransformQ[transform_] := TrueQ[Lookup[ValidateIneqTransform[transform], "Valid", False]];

RegisterIneqRule[rule_Association] := Module[{name = Lookup[rule, "Name", ""], validation},
  validation = ValidateIneqRule[rule];
  If[! TrueQ[Lookup[validation, "Valid", False]], Return[Join[<|"Status" -> "Rejected"|>, validation]]];
  $IneqRuleRegistry[StringTrim[name]] = rule;
  <|"Status" -> "Registered", "Kind" -> "Rule", "Name" -> StringTrim[name], "Rule" -> rule|>
];

RegisterIneqRule[rule_] := Join[<|"Status" -> "Rejected"|>, ValidateIneqRule[rule]];

RegisterIneqTransform[transform_Association] := Module[{name = Lookup[transform, "Name", ""], validation},
  validation = ValidateIneqTransform[transform];
  If[! TrueQ[Lookup[validation, "Valid", False]], Return[Join[<|"Status" -> "Rejected"|>, validation]]];
  $IneqTransformRegistry[StringTrim[name]] = transform;
  <|"Status" -> "Registered", "Kind" -> "Transform", "Name" -> StringTrim[name], "Transform" -> transform|>
];

RegisterIneqTransform[transform_] := Join[<|"Status" -> "Rejected"|>, ValidateIneqTransform[transform]];

RegistrySummary[] := <|
  "Rules" -> Keys[$IneqRuleRegistry],
  "Transforms" -> Keys[$IneqTransformRegistry],
  "RuleCount" -> Length[$IneqRuleRegistry],
  "TransformCount" -> Length[$IneqTransformRegistry],
  "LLMMoveSchema" -> IneqCompilerSchemaSummary[]
|>;

IneqConditionStatus[kind_, status_, data_: <||>] := Join[
  <|"Kind" -> kind, "Status" -> status|>,
  If[AssociationQ[data], data, <|"Data" -> data|>]
];

IneqGoalText[goal_] := ToLowerCase[ToString[Unevaluated[goal], InputForm]];

IneqContextValues[context_Association] := Flatten[Normal[context] /. Rule -> List, Infinity];
IneqContextValues[_] := {};

IneqContextHasText[state_Association?IneqStateQ, pattern_String] := Module[
  {needle = ToLowerCase[pattern], goalText, contextText},
  goalText = IneqGoalText[IneqGoal[state]];
  contextText = ToLowerCase[ToString[IneqContextValues[IneqContext[state]], InputForm]];
  StringContainsQ[goalText, needle] || StringContainsQ[contextText, needle]
];

IneqContextStatus[state_Association?IneqStateQ, key_String, kind_String] := Module[
  {context = IneqContext[state], value},
  value = Lookup[context, key, Missing["NotProvided"]];
  If[value === Missing["NotProvided"] || value === "" || value === {},
    IneqConditionStatus[kind, "NeedsUser"],
    IneqConditionStatus[kind, "AssumedFromContext", <|"Value" -> value|>]
  ]
];

Get[FileNameJoin[{DirectoryName[$InputFileName], "InequalityEngine", "Kernel", "Compiler.wl"}]];

IneqParameterChoice[direction_, parameter_, condition_, dependencies_: {}] := Module[
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

IneqSuggest[state_Association?IneqStateQ, OptionsPattern[]] := Module[
  {goal = IneqGoal[state], moves},
  moves = Join[
    ProductIntegralMoves[goal, state],
    SumProductMoves[goal, state],
    ProductPointwiseMoves[goal, state],
    IntegrationByPartsMoves[goal, state],
    AbstractInequalityMoves[goal, state]
  ];
  If[moves === {},
    {
      <|
        "MoveId" -> "no_move",
        "Rule" -> "None",
        "Status" -> "NoCandidate",
        "Message" -> "No registered proof-rule pattern matched. Propose a restricted schema with Rule/Transforms/Bindings/MissingConditions for compile, ask for a decomposition, or register a validated transform; do not inject executable Wolfram code.",
        "RequiredConditions" -> {},
        "Transforms" -> {}
      |>
    },
    moves
  ]
];

IneqSuggest[input_, OptionsPattern[]] := IneqSuggest[IneqNormalize[input]];

ProductIntegralMoves[goal_, state_] := Module[{integrals, moves},
  integrals = Cases[
    Hold[goal],
    int : (Integrate[_Times, {_, _, _}] | Inactive[Integrate][_Times, {_, _, _}]) :> Unevaluated[int],
    Infinity
  ];
  moves = Flatten[MapIndexed[
    Function[{int, idx},
      With[{parts = List @@ Unevaluated[int]},
        With[{integrand = parts[[1]], domain = parts[[2]]},
          {
            <|
              "MoveId" -> "holder_product_" <> ToString[First[idx]],
              "Rule" -> "Holder",
              "Variant" -> "CauchySchwarzDefault",
              "Status" -> "Candidate",
              "Matched" -> int,
              "Conclusion" -> HolderConclusion[integrand, domain, 2, 2],
              "RequiredConditions" -> HolderConditions[integrand, domain, 2, 2],
              "Transforms" -> {"abs-dominate", "explicit-product"},
              "ConditionStatus" -> <|
                "ExponentConjugacy" -> IneqConditionStatus["ExponentConjugacy", "VerifiedByConstruction", <|"p" -> 2, "q" -> 2|>],
                "FunctionSpaces" -> IneqConditionStatus["FunctionSpaces", "NeedsUser"],
                "Measurability" -> IneqConditionStatus["Measurability", "NeedsUser"]
              |>,
              "Cost" -> 1
            |>,
            <|
              "MoveId" -> "cauchy_schwarz_integral_" <> ToString[First[idx]],
              "Rule" -> "CauchySchwarz",
              "Variant" -> "IntegralL2",
              "Status" -> "Candidate",
              "Matched" -> int,
              "Conclusion" -> CauchySchwarzConclusion[integrand, domain],
              "RequiredConditions" -> CauchySchwarzConditions[integrand, domain],
              "Transforms" -> {"abs-dominate", "explicit-product"},
              "ConditionStatus" -> <|
                "ExponentConjugacy" -> IneqConditionStatus["ExponentConjugacy", "VerifiedByConstruction", <|"p" -> 2, "q" -> 2|>],
                "FunctionSpaces" -> IneqConditionStatus["FunctionSpaces", "NeedsUser"],
                "Measurability" -> IneqConditionStatus["Measurability", "NeedsUser"]
              |>,
              "Cost" -> 1
            |>
          }
        ]
      ]
    ],
    integrals
  ], 1];
  moves
];

SumProductMoves[goal_, state_] := Module[{sums, moves},
  sums = Cases[
    Hold[goal],
    sum : (Sum[_Times, {_, _, _}] | Inactive[Sum][_Times, {_, _, _}]) :> Unevaluated[sum],
    Infinity
  ];
  moves = MapIndexed[
    Function[{sum, idx},
      With[{parts = List @@ Unevaluated[sum]},
        With[{summand = parts[[1]], indexSpec = parts[[2]]},
          <|
            "MoveId" -> "cauchy_schwarz_sum_" <> ToString[First[idx]],
            "Rule" -> "CauchySchwarz",
            "Variant" -> "FiniteSum",
            "Status" -> "Candidate",
            "Matched" -> sum,
            "Conclusion" -> CauchySchwarzSumConclusion[summand, indexSpec],
            "RequiredConditions" -> CauchySchwarzSumConditions[summand, indexSpec],
            "Transforms" -> {"explicit-product", "choose-inner-product"},
            "ConditionStatus" -> <|
              "FiniteIndexSet" -> IneqConditionStatus["FiniteIndexSet", "NeedsUser"],
              "InnerProductStructure" -> IneqConditionStatus["InnerProductStructure", "NeedsUser"],
              "NonnegativeWeights" -> IneqConditionStatus["NonnegativeWeights", "NeedsUser"]
            |>,
            "Cost" -> 2
          |>
        ]
      ]
    ],
    sums
  ];
  moves
];

IntegrationByPartsMoves[goal_, state_] := Module[{integrals},
  integrals = Cases[
    Hold[goal],
    int : (Integrate[Derivative[1][u_][x_] * v_, {x_, a_, b_}] |
      Inactive[Integrate][Derivative[1][u_][x_] * v_, {x_, a_, b_}]) :> Unevaluated[int],
    Infinity
  ];
  MapIndexed[
    Function[{int, idx},
      <|
        "MoveId" -> "integration_by_parts_" <> ToString[First[idx]],
        "Rule" -> "IntegrationByParts",
        "Variant" -> "OneDimensionalProductDerivative",
        "Status" -> "Candidate",
        "Matched" -> int,
        "Conclusion" -> IntegrationByPartsConclusion[int],
        "RequiredConditions" -> IntegrationByPartsConditions[int],
        "Transforms" -> {"product-rule", "boundary-term", "move-derivative"},
        "ConditionStatus" -> <|
          "Regularity" -> IneqConditionStatus["Regularity", "NeedsUser"],
          "BoundaryTrace" -> IneqConditionStatus["BoundaryTrace", "NeedsUser"],
          "Integrability" -> IneqConditionStatus["Integrability", "NeedsUser"]
        |>,
        "Cost" -> 2
      |>
    ],
    integrals
  ]
];

IntegrationByPartsConclusion[Integrate[Derivative[1][u_][x_] * v_, {x_, a_, b_}]] := <|
  "Identity" -> "Integral[u'[x] v[x], {x,a,b}] = u[b] v[b] - u[a] v[a] - Integral[u[x] v'[x], {x,a,b}]",
  "BoundaryTerm" -> u[b] * (v /. x -> b) - u[a] * (v /. x -> a),
  "InteriorTerm" -> -Inactive[Integrate][u[x] * D[v, x], {x, a, b}]
|>;

IntegrationByPartsConclusion[Inactive[Integrate][Derivative[1][u_][x_] * v_, {x_, a_, b_}]] :=
  IntegrationByPartsConclusion[Integrate[Derivative[1][u][x] * v, {x, a, b}]];

IntegrationByPartsConclusion[int_] := <|
  "Identity" -> "Integral[u' v] = [u v]_a^b - Integral[u v']",
  "Matched" -> int
|>;

IntegrationByPartsConditions[int_] := {
  <|"Kind" -> "Regularity", "Requirement" -> "u and v have enough weak/classical regularity for the selected integration-by-parts formula.", "Status" -> "NeedsUser"|>,
  <|"Kind" -> "BoundaryTrace", "Requirement" -> "Boundary traces exist and boundary terms are either retained or justified to vanish.", "Status" -> "NeedsUser"|>,
  <|"Kind" -> "Integrability", "Requirement" -> "The product terms are integrable on the stated domain.", "Status" -> "NeedsUser"|>
};

ProductPointwiseMoves[goal_, state_] := Module[{products, selected},
  If[! IneqContextHasText[state, "young"] && ! IneqContextHasText[state, "product"],
    Return[{}]
  ];
  products = Cases[
    Hold[goal],
    expr : (_Times | Abs[_Times]) :> Unevaluated[expr],
    Infinity
  ];
  selected = DeleteDuplicates[Take[products, UpTo[3]]];
  MapIndexed[
    Function[{expr, idx},
      With[{raw = If[Head[Unevaluated[expr]] === Abs, First[List @@ Unevaluated[expr]], Unevaluated[expr]]},
        <|
          "MoveId" -> "young_product_" <> ToString[First[idx]],
          "Rule" -> "Young",
          "Variant" -> "ConjugateExponentsWithEpsilon",
          "Status" -> "Candidate",
          "Matched" -> expr,
            "Conclusion" -> <|
              "Standard" -> YoungConclusion[raw, p, q],
              "EpsilonForm" -> YoungEpsilonConclusion[raw, p, q, eps]
            |>,
          "RequiredConditions" -> YoungConditions[raw, p, q, eps],
          "Transforms" -> {"abs-dominate", "choose-small-parameter"},
          "ConditionStatus" -> <|
            "ExponentConjugacy" -> IneqConditionStatus["ExponentConjugacy", "NeedsUser"],
            "ParameterChoice" -> IneqConditionStatus["ParameterChoice", "NeedsUser"],
            "Nonnegativity" -> IneqConditionStatus["Nonnegativity", "NeedsUser"]
          |>,
          "Cost" -> 2
        |>
      ]
    ],
    selected
  ]
];

AbstractInequalityMoves[goal_, state_] := Join[
  If[IneqContextHasText[state, "poincare"], {PoincareMove[goal, state]}, {}],
  If[IneqContextHasText[state, "sobolev"], {SobolevMove[goal, state]}, {}]
];

HolderConclusion[integrand_Times, domain_, p_, q_] := Module[{factors, f, g},
  factors = List @@ integrand;
  f = First[factors];
  g = Times @@ Rest[factors];
  Inactive[Inequality][
    Inactive[Integrate][Abs[f g], domain],
    LessEqual,
    Inactive[Integrate][Abs[f]^p, domain]^(1/p) *
      Inactive[Integrate][Abs[g]^q, domain]^(1/q)
  ]
];

HolderConclusion[integrand_, domain_, p_, q_] := Inactive[Inequality][
  Inactive[Integrate][Abs[integrand], domain],
  LessEqual,
  Missing["NoProductDecomposition"]
];

HolderConditions[integrand_Times, domain_, p_, q_] := Module[{factors, f, g},
  factors = List @@ integrand;
  f = First[factors];
  g = Times @@ Rest[factors];
  {
    p > 1,
    q > 1,
    1/p + 1/q == 1,
    <|"Kind" -> "FunctionSpace", "Expression" -> f, "Space" -> LpSpace[p, domain], "Status" -> "NeedsUser"|>,
    <|"Kind" -> "FunctionSpace", "Expression" -> g, "Space" -> LpSpace[q, domain], "Status" -> "NeedsUser"|>
  }
];

HolderConditions[_, _, p_, q_] := {p > 1, q > 1, 1/p + 1/q == 1};

CauchySchwarzConclusion[integrand_Times, domain_] := HolderConclusion[integrand, domain, 2, 2];

CauchySchwarzConclusion[integrand_, domain_] := Inactive[Inequality][
  Inactive[Integrate][Abs[integrand], domain],
  LessEqual,
  Missing["NoProductDecomposition"]
];

CauchySchwarzConditions[integrand_, domain_] := HolderConditions[integrand, domain, 2, 2];

CauchySchwarzSumConclusion[summand_Times, indexSpec_] := Module[{factors, a, b},
  factors = List @@ summand;
  a = First[factors];
  b = Times @@ Rest[factors];
  Inactive[Inequality][
    Abs[Inactive[Sum][a b, indexSpec]],
    LessEqual,
    Inactive[Sum][Abs[a]^2, indexSpec]^(1/2) *
      Inactive[Sum][Abs[b]^2, indexSpec]^(1/2)
  ]
];

CauchySchwarzSumConclusion[summand_, indexSpec_] := Inactive[Inequality][
  Abs[Inactive[Sum][summand, indexSpec]],
  LessEqual,
  Missing["NoProductDecomposition"]
];

CauchySchwarzSumConditions[summand_Times, indexSpec_] := Module[{factors, a, b},
  factors = List @@ summand;
  a = First[factors];
  b = Times @@ Rest[factors];
  {
    <|"Kind" -> "FiniteIndexSet", "Index" -> indexSpec, "Status" -> "NeedsUser"|>,
    <|"Kind" -> "SquareSummableFactor", "Expression" -> a, "Status" -> "NeedsUser"|>,
    <|"Kind" -> "SquareSummableFactor", "Expression" -> b, "Status" -> "NeedsUser"|>
  }
];

CauchySchwarzSumConditions[_, indexSpec_] := {
  <|"Kind" -> "FiniteIndexSet", "Index" -> indexSpec, "Status" -> "NeedsUser"|>
};

YoungConclusion[integrand_Times, p_, q_] := Module[{factors, a, b},
  factors = List @@ integrand;
  a = First[factors];
  b = Times @@ Rest[factors];
  Inactive[Inequality][Abs[a b], LessEqual, Abs[a]^p/p + Abs[b]^q/q]
];

YoungConclusion[integrand_, p_, q_] := Inactive[Inequality][
  Abs[integrand],
  LessEqual,
  Missing["NoProductDecomposition"]
];

YoungEpsilonConclusion[integrand_Times, p_, q_, eps_] := Module[{factors, a, b},
  factors = List @@ integrand;
  a = First[factors];
  b = Times @@ Rest[factors];
  <|
    "Form" -> Inactive[Inequality][Abs[a b], LessEqual, eps Abs[a]^p + C[eps, p, q] Abs[b]^q],
    "CoefficientObligation" -> "Choose C[eps,p,q] from the standard Young epsilon form for the selected normalization."
  |>
];

YoungEpsilonConclusion[integrand_, p_, q_, eps_] := <|
  "Form" -> Inactive[Inequality][Abs[integrand], LessEqual, Missing["NoProductDecomposition"]],
  "CoefficientObligation" -> "Provide a product decomposition before applying Young."
|>;

YoungConditions[integrand_Times, p_, q_, eps_] := Module[{factors, a, b},
  factors = List @@ integrand;
  a = First[factors];
  b = Times @@ Rest[factors];
  {
    p > 1,
    q > 1,
    1/p + 1/q == 1,
    eps > 0,
    <|"Kind" -> "NonnegativeFactor", "Expression" -> Abs[a], "Status" -> "VerifiedByConstruction"|>,
    <|"Kind" -> "NonnegativeFactor", "Expression" -> Abs[b], "Status" -> "VerifiedByConstruction"|>
  }
];

YoungConditions[_, p_, q_, eps_] := {p > 1, q > 1, 1/p + 1/q == 1, eps > 0};

PoincareMove[goal_, state_Association?IneqStateQ] := <|
  "MoveId" -> "poincare_1",
  "Rule" -> "Poincare",
  "Variant" -> "DomainConstant",
  "Status" -> "Candidate",
  "Matched" -> goal,
  "Conclusion" -> "||u - u_Omega||_Lp(Omega) <= C_P(Omega,p) ||grad u||_Lp(Omega); if boundary/zero-mean data is supplied, replace u-u_Omega by u.",
  "RequiredConditions" -> {
    "Omega is a bounded connected domain with enough regularity for Poincare.",
    "u has weak gradient in Lp(Omega).",
    "Either u has zero trace on the required boundary part or u is normalized by subtracting its mean.",
    "1 <= p < Infinity."
  },
  "Transforms" -> {"subtract-mean", "boundary-normalize"},
  "ConditionStatus" -> <|
    "Domain" -> IneqContextStatus[state, "Domain", "DomainRegularity"],
    "BoundaryCondition" -> IneqContextStatus[state, "BoundaryCondition", "BoundaryCondition"],
    "FunctionSpaces" -> IneqContextStatus[state, "FunctionSpaces", "FunctionSpaces"],
    "ExponentRange" -> IneqContextStatus[state, "ExponentRange", "ExponentRange"]
  |>,
  "Cost" -> 3
|>;

SobolevMove[goal_, state_Association?IneqStateQ] := <|
  "MoveId" -> "sobolev_1",
  "Rule" -> "Sobolev",
  "Variant" -> "FirstOrderEmbedding",
  "Status" -> "Candidate",
  "Matched" -> goal,
  "Conclusion" -> "||u||_Lq(Omega) <= C_S ||u||_W^{1,p}(Omega), with q <= n p/(n-p) when 1 <= p < n; use the usual endpoint/low-dimensional variants separately.",
  "RequiredConditions" -> {
    "Omega supports the selected Sobolev embedding.",
    "u belongs to W^{1,p}(Omega).",
    "Dimension n and exponents p,q satisfy the embedding range.",
    "Endpoint and homogeneous variants must be stated explicitly."
  },
  "Transforms" -> {"choose-exponents", "replace-by-gradient-norm-when-poincare-applies"},
  "ConditionStatus" -> <|
    "Domain" -> IneqContextStatus[state, "Domain", "DomainRegularity"],
    "Dimension" -> IneqContextStatus[state, "Dimension", "Dimension"],
    "FunctionSpaces" -> IneqContextStatus[state, "FunctionSpaces", "FunctionSpaces"],
    "ExponentRange" -> IneqContextStatus[state, "ExponentRange", "ExponentRange"]
  |>,
  "Cost" -> 3
|>;

IneqApply[state_Association?IneqStateQ, move_Association] := Module[
  {trace = IneqTrace[state], entry},
  entry = <|
    "Kind" -> "apply",
    "MoveId" -> Lookup[move, "MoveId", "unknown"],
    "Rule" -> Lookup[move, "Rule", "unknown"],
    "Conclusion" -> Lookup[move, "Conclusion", Missing["NoConclusion"]],
    "RequiredConditions" -> Lookup[move, "RequiredConditions", {}],
    "ConditionStatus" -> Lookup[move, "ConditionStatus", <||>],
    "Transforms" -> Lookup[move, "Transforms", {}],
    "Time" -> IneqNow[]
  |>;
  Join[state, <|
    "LastMove" -> move,
    "Trace" -> Append[trace, entry]
  |>]
];

IneqApply[state_Association?IneqStateQ, moveId_String] := Module[{move},
  move = MoveById[IneqSuggest[state], moveId];
  If[AssociationQ[move], IneqApply[state, move], AppendTrace[state, <|"Kind" -> "error", "Message" -> "Move not found: " <> moveId|>]]
];

MoveById[moves_, moveId_] := SelectFirst[moves, Lookup[#, "MoveId", ""] === moveId &, Missing["NotFound"]];

AppendTrace[state_Association?IneqStateQ, entry_Association] := Join[
  state,
  <|"Trace" -> Append[IneqTrace[state], Join[entry, <|"Time" -> IneqNow[]|>]]|>
];

StateSummary[state_Association?IneqStateQ] := <|
  "Head" -> "IneqState",
  "Version" -> Lookup[state, "Version", 1],
  "Goal" -> IneqGoal[state],
  "KnownCount" -> Length[IneqKnown[state]],
  "ContextKeys" -> Keys[IneqContext[state]],
  "TraceLength" -> Length[IneqTrace[state]],
  "LastMove" -> Lookup[Lookup[state, "LastMove", <||>], "MoveId", ""]
|>;

ReadMoveId[args_Association] := Module[{moveId = IneqReadString[Lookup[args, "moveId", ""]]},
  If[moveId === "", IneqReadString[Lookup[args, "move_id", ""]], moveId]
];

IneqHandleRequest[args_Association] := Module[
  {operation, goal, context, known, stateText, state, moves, moveId, payload},
  operation = ToLowerCase[IneqReadString[Lookup[args, "operation", "suggest"]]];
  goal = IneqParseInput[Lookup[args, "goal", ""]];
  context = IneqParseContext[Lookup[args, "context", ""]];
  known = IneqParseInput[Lookup[args, "known", ""]];
  payload = IneqParsePayload[Lookup[args, "payload", ""]];
  known = If[known === Missing["EmptyInput"], {}, If[ListQ[known], known, {known}]];
  stateText = IneqReadString[Lookup[args, "state", ""]];
  state = If[stateText === "",
    IneqNormalize[goal, context, known],
    Quiet@Check[ToExpression[stateText, InputForm], IneqNormalize[goal, context, known]]
  ];
  If[! IneqStateQ[state], state = IneqNormalize[goal, context, known]];

  Switch[operation,
    "normalize",
      StateSummary[state],
    "suggest",
      IneqSuggest[state],
    "apply",
      moves = IneqSuggest[state];
      moveId = ReadMoveId[args];
      If[moveId === "" && Length[moves] > 0, moveId = Lookup[First[moves], "MoveId", ""]];
      IneqApply[state, moveId],
    "trace",
      IneqTrace[state],
    "registry",
      RegistrySummary[],
    "parameter",
      IneqParameterChoice[
        Lookup[payload, "Direction", Lookup[payload, "direction", "small"]],
        Lookup[payload, "Parameter", Lookup[payload, "parameter", eps]],
        Lookup[payload, "Condition", Lookup[payload, "condition", Missing["NoCondition"]]],
        Lookup[payload, "Dependencies", Lookup[payload, "dependencies", {}]]
      ],
    "compile",
      CompileIneqMoveSchema[payload],
    "register",
      IneqRegisterPayload[payload],
    _,
      <|"Status" -> "Error", "Message" -> "Unknown operation: " <> operation|>
  ]
];

IneqRegisterPayload[payload_Association] := Module[{kind = ToLowerCase[IneqReadString[Lookup[payload, "Type", Lookup[payload, "type", "Rule"]]]]},
  Switch[kind,
    "transform", RegisterIneqTransform[payload],
    "rule", RegisterIneqRule[payload],
    _, <|"Status" -> "Rejected", "Issues" -> {"Type must be Rule or Transform. Use operation -> compile for LLM move schemas."}|>
  ]
];

IneqRegisterPayload[_] := <|"Status" -> "Rejected", "Issues" -> {"Payload must be an Association."}|>;

RegisterIneqRule[<|
  "Name" -> "Holder",
  "Family" -> "integral-product",
  "CanonicalForm" -> "Integral[Abs[f g], mu] <= LpNorm[f,p,mu] LpNorm[g,q,mu]",
  "Conditions" -> {"p > 1", "q > 1", "1/p + 1/q == 1", "f in Lp", "g in Lq"},
  "DefaultVariant" -> "CauchySchwarzDefault"
|>];

RegisterIneqRule[<|
  "Name" -> "CauchySchwarz",
  "Family" -> "integral-product",
  "CanonicalForm" -> "Integral[Abs[f g], mu] <= L2Norm[f,mu] L2Norm[g,mu]",
  "Conditions" -> {"f in L2", "g in L2", "measurable/integrable product"},
  "DefaultVariant" -> "IntegralL2"
|>];

RegisterIneqRule[<|
  "Name" -> "Young",
  "Family" -> "pointwise-product",
  "CanonicalForm" -> "a b <= a^p/p + b^q/q with conjugate p,q; epsilon form records coefficient obligations",
  "Conditions" -> {"p > 1", "q > 1", "1/p + 1/q == 1", "epsilon > 0 for epsilon form"},
  "DefaultVariant" -> "ConjugateExponentsWithEpsilon"
|>];

RegisterIneqRule[<|
  "Name" -> "Poincare",
  "Family" -> "function-space",
  "CanonicalForm" -> "||u - mean(u)||_Lp <= C ||grad u||_Lp",
  "Conditions" -> {"bounded connected domain", "domain regularity", "u in W^{1,p}", "zero trace or mean normalization"},
  "DefaultVariant" -> "DomainConstant"
|>];

RegisterIneqRule[<|
  "Name" -> "Sobolev",
  "Family" -> "function-space",
  "CanonicalForm" -> "W^{1,p}(Omega) embeds into L^q(Omega) under dimension/exponent restrictions",
  "Conditions" -> {"domain supports embedding", "u in W^{1,p}", "dimension and exponents satisfy embedding range"},
  "DefaultVariant" -> "FirstOrderEmbedding"
|>];

RegisterIneqTransform[<|
  "Name" -> "explicit-product",
  "Description" -> "Match an integrand already written as a product."
|>];

RegisterIneqTransform[<|
  "Name" -> "choose-inner-product",
  "Description" -> "Select the finite-dimensional or weighted inner product structure before applying Cauchy-Schwarz."
|>];

RegisterIneqTransform[<|
  "Name" -> "abs-dominate",
  "Description" -> "Replace |Integral[expr]| by Integral[Abs[expr]] as a proof move requiring integrability."
|>];

RegisterIneqTransform[<|
  "Name" -> "choose-small-parameter",
  "Description" -> "Introduce an explicit small positive parameter and leave the finite-dimensional absorption condition visible."
|>];

RegisterIneqTransform[<|
  "Name" -> "product-rule",
  "Description" -> "Match a product derivative pattern and expose the associated proof-rule identity."
|>];

RegisterIneqTransform[<|
  "Name" -> "boundary-term",
  "Description" -> "Expose boundary terms generated by integration by parts and require trace hypotheses."
|>];

RegisterIneqTransform[<|
  "Name" -> "move-derivative",
  "Description" -> "Move a derivative from one factor to another using integration by parts under stated assumptions."
|>];

RegisterIneqTransform[<|
  "Name" -> "subtract-mean",
  "Description" -> "Replace u by u minus its domain mean before applying Poincare."
|>];

RegisterIneqTransform[<|
  "Name" -> "boundary-normalize",
  "Description" -> "Use supplied zero trace or boundary data to select a Poincare normalization."
|>];

RegisterIneqTransform[<|
  "Name" -> "choose-exponents",
  "Description" -> "Record dimension and exponent restrictions before applying a Sobolev embedding."
|>];

RegisterIneqTransform[<|
  "Name" -> "replace-by-gradient-norm-when-poincare-applies",
  "Description" -> "Use Poincare after Sobolev to replace a full Sobolev norm by a gradient norm when the hypotheses allow it."
|>];

End[];

EndPackage[];
