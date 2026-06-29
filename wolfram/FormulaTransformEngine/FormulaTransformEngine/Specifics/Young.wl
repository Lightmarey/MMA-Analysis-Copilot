FTYoungParseTargetRelation[targetText_String] := Module[{target},
  target = FTParseMaybeExpression[targetText];
  If[MatchQ[target, LessEqual[_, _]], <|"Target" -> target, "LHS" -> First[List @@ target], "RHS" -> Last[List @@ target]|>, Missing["InvalidTargetRelation"]]
];

FTYoungMatchTargetLHS[target_Association, selected_] :=
  TrueQ[Quiet@Check[Simplify[Lookup[target, "LHS"] == selected], False]];

FTYoungExtractProductFactors[selected_] := Module[{factors, flatFactors},
  factors = FTProductFactors[selected];
  If[factors === $Failed, Return[Missing["NoProductFactors"]]];
  flatFactors = If[Head[selected] === Times, List @@ selected, List @@ Times @@ factors];
  <|"Factors" -> factors, "FlatFactors" -> flatFactors|>
];

FTYoungInferAbsorbedQuadraticFactor[rhs_, flatFactors_List, absorbParam_] := Module[
  {terms, allCandidates, candidates},
  terms = FTTerms[rhs];
  allCandidates = DeleteCases[
    Table[
      With[{qcoeffs = DeleteMissing[FTQuadraticCoefficient[#, factor] & /@ terms]},
        If[qcoeffs === {}, Nothing, <|"Factor" -> factor, "Coefficient" -> First[qcoeffs]|>]
      ],
      {factor, flatFactors}
    ],
    Nothing
  ];
  candidates = allCandidates;
  If[absorbParam =!= $Failed,
    candidates = Select[candidates, TrueQ[Quiet@Check[Simplify[Lookup[#, "Factor"] == absorbParam], False]] &]
  ];
  If[candidates === {}, Return[Missing["NoAbsorbedQuadraticFactor"]]];
  Join[First[candidates], <|"AllCandidates" -> allCandidates, "Terms" -> terms|>]
];

FTYoungInferResidualFactor[selected_, flatFactors_List, allCandidates_List, absorb_] := Module[
  {residualCandidates},
  residualCandidates = Select[allCandidates, ! TrueQ[Quiet@Check[Simplify[Lookup[#, "Factor"] == absorb], False]] &];
  If[residualCandidates === {},
    Times @@ DeleteCases[flatFactors, absorb, {1}, 1],
    Lookup[First[residualCandidates], "Factor"]
  ]
];

FTYoungComputeProductCoefficient[selected_, absorb_, residual_] :=
  FTProductCoefficient[selected, absorb, residual];



