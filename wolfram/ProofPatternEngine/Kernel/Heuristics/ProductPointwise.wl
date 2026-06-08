RegisterProductPointwiseHeuristics[] := RegisterPPHeuristic["product-pointwise", ProductPointwiseMoves];

ProductPointwiseMoves[goal_, state_] := Module[{products, selected},
  If[! PPContextHasText[state, "young"] && ! PPContextHasText[state, "product"],
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
            "ExponentConjugacy" -> PPConditionStatus["ExponentConjugacy", "NeedsUser"],
            "ParameterChoice" -> PPConditionStatus["ParameterChoice", "NeedsUser"],
            "Nonnegativity" -> PPConditionStatus["Nonnegativity", "NeedsUser"]
          |>,
          "Cost" -> 2
        |>
      ]
    ],
    selected
  ]
];

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
