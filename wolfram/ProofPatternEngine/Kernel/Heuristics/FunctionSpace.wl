RegisterFunctionSpaceHeuristics[] := RegisterPPHeuristic["function-space", FunctionSpaceMoves];

FunctionSpaceMoves[goal_, state_] := Join[
  If[PPContextHasText[state, "poincare"], {PoincareMove[goal, state]}, {}],
  If[PPContextHasText[state, "sobolev"], {SobolevMove[goal, state]}, {}]
];

PoincareMove[goal_, state_Association?PPStateQ] := <|
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
    "Domain" -> PPContextStatus[state, "Domain", "DomainRegularity"],
    "BoundaryCondition" -> PPContextStatus[state, "BoundaryCondition", "BoundaryCondition"],
    "FunctionSpaces" -> PPContextStatus[state, "FunctionSpaces", "FunctionSpaces"],
    "ExponentRange" -> PPContextStatus[state, "ExponentRange", "ExponentRange"]
  |>,
  "Cost" -> 3
|>;

SobolevMove[goal_, state_Association?PPStateQ] := <|
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
    "Domain" -> PPContextStatus[state, "Domain", "DomainRegularity"],
    "Dimension" -> PPContextStatus[state, "Dimension", "Dimension"],
    "FunctionSpaces" -> PPContextStatus[state, "FunctionSpaces", "FunctionSpaces"],
    "ExponentRange" -> PPContextStatus[state, "ExponentRange", "ExponentRange"]
  |>,
  "Cost" -> 3
|>;
