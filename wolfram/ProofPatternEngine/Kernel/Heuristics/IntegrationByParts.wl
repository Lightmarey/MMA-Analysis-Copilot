RegisterIntegrationByPartsHeuristics[] := RegisterPPHeuristic["integration-by-parts", IntegrationByPartsMoves];

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
          "Regularity" -> PPConditionStatus["Regularity", "NeedsUser"],
          "BoundaryTrace" -> PPConditionStatus["BoundaryTrace", "NeedsUser"],
          "Integrability" -> PPConditionStatus["Integrability", "NeedsUser"]
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
