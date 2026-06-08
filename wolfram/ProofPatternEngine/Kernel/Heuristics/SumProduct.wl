RegisterSumProductHeuristics[] := RegisterPPHeuristic["sum-product", SumProductMoves];

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
              "FiniteIndexSet" -> PPConditionStatus["FiniteIndexSet", "NeedsUser"],
              "InnerProductStructure" -> PPConditionStatus["InnerProductStructure", "NeedsUser"],
              "NonnegativeWeights" -> PPConditionStatus["NonnegativeWeights", "NeedsUser"]
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
