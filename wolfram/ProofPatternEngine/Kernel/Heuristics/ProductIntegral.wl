RegisterProductIntegralHeuristics[] := RegisterPPHeuristic["product-integral", ProductIntegralMoves];

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
                "ExponentConjugacy" -> PPConditionStatus["ExponentConjugacy", "VerifiedByConstruction", <|"p" -> 2, "q" -> 2|>],
                "FunctionSpaces" -> PPConditionStatus["FunctionSpaces", "NeedsUser"],
                "Measurability" -> PPConditionStatus["Measurability", "NeedsUser"]
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
                "ExponentConjugacy" -> PPConditionStatus["ExponentConjugacy", "VerifiedByConstruction", <|"p" -> 2, "q" -> 2|>],
                "FunctionSpaces" -> PPConditionStatus["FunctionSpaces", "NeedsUser"],
                "Measurability" -> PPConditionStatus["Measurability", "NeedsUser"]
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
