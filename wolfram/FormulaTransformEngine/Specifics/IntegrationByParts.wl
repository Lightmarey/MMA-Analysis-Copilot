FTIBPBoundaryTerm[u_, v_, {x_, a_, b_}] := u[b] * (v /. x -> b) - u[a] * (v /. x -> a);
FTIBPBoundaryTerm[u_, v_, domain_] := Inactive[BoundaryTerm][u, v, domain];

FTIBPInteriorIntegral[u_, v_, {x_, a_, b_}] := Inactive[Integrate][u[x] * D[v, x], {x, a, b}];
FTIBPInteriorIntegral[u_, v_, domain_] := Inactive[IBPIntegral][u, v, domain];

