BeginPackage["InequalityEngine`"];

IneqNormalize::usage = "Deprecated compatibility alias for ProofPatternEngine`PPNormalize.";
IneqSuggest::usage = "Deprecated compatibility alias for ProofPatternEngine`PPSuggest.";
IneqApply::usage = "Deprecated compatibility alias for ProofPatternEngine`PPApply.";
IneqTrace::usage = "Deprecated compatibility alias for ProofPatternEngine`PPTrace.";
IneqHandleRequest::usage = "Deprecated compatibility alias for ProofPatternEngine`PPHandleRequest.";
RegisterIneqRule::usage = "Deprecated compatibility alias for ProofPatternEngine`RegisterPPRule.";
RegisterIneqTransform::usage = "Deprecated compatibility alias for ProofPatternEngine`RegisterPPTransform.";
ValidateIneqRule::usage = "Deprecated compatibility alias for ProofPatternEngine`ValidatePPRule.";
ValidateIneqTransform::usage = "Deprecated compatibility alias for ProofPatternEngine`ValidatePPTransform.";
ValidateIneqMoveSchema::usage = "Deprecated compatibility alias for ProofPatternEngine`ValidatePPMoveSchema.";
CompileIneqMoveSchema::usage = "Deprecated compatibility alias for ProofPatternEngine`CompilePPMoveSchema.";
IneqParameterChoice::usage = "Deprecated compatibility alias for ProofPatternEngine`PPParameterChoice.";

Begin["`Private`"];

Get[FileNameJoin[{DirectoryName[$InputFileName], "ProofPatternEngine.wl"}]];

IneqNormalize[args___] := ProofPatternEngine`PPNormalize[args];
IneqSuggest[args___] := ProofPatternEngine`PPSuggest[args];
IneqApply[args___] := ProofPatternEngine`PPApply[args];
IneqTrace[args___] := ProofPatternEngine`PPTrace[args];
IneqHandleRequest[args___] := ProofPatternEngine`PPHandleRequest[args];
RegisterIneqRule[args___] := ProofPatternEngine`RegisterPPRule[args];
RegisterIneqTransform[args___] := ProofPatternEngine`RegisterPPTransform[args];
ValidateIneqRule[args___] := ProofPatternEngine`ValidatePPRule[args];
ValidateIneqTransform[args___] := ProofPatternEngine`ValidatePPTransform[args];
ValidateIneqMoveSchema[args___] := ProofPatternEngine`ValidatePPMoveSchema[args];
CompileIneqMoveSchema[args___] := ProofPatternEngine`CompilePPMoveSchema[args];
IneqParameterChoice[args___] := ProofPatternEngine`PPParameterChoice[args];

End[];

EndPackage[];
