If[!TrueQ[ValueQ[$ScriptCommandLine]], $ScriptCommandLine = {}];
$HistoryLength = 0;

ClearAll[WMAJsonWrite, WMAResolveProtocolPath, WMAReadLoop];

WMAJsonWrite[assoc_Association] := Module[{line},
  line = ExportString[assoc, "RawJSON", "Compact" -> True];
  WriteString[$Output, line <> "\n"];
  Flush[$Output];
];

WMAResolveProtocolPath[] := Module[{candidate},
  candidate = If[
    TrueQ[ValueQ[Global`$WMAProtocolPath]] && StringQ[Global`$WMAProtocolPath],
    Global`$WMAProtocolPath,
    FileNameJoin[{Directory[], "wolfram", "protocol.wl"}]
  ];
  If[FileExistsQ[candidate], candidate, FileNameJoin[{DirectoryName[$InputFileName], "protocol.wl"}]]
];

Get[WMAResolveProtocolPath[]];

WMAReadLoop[inputStream_] := Module[{line, req},
  WMAJsonWrite[<|"id" -> "__worker_ready__", "ok" -> True, "title" -> "Wolfram worker ready"|>];
  While[True,
    line = Quiet@Check[ReadLine[inputStream], EndOfFile];
    If[line === EndOfFile, Break[]];
    If[!StringQ[line] || StringLength[StringTrim[line]] == 0, Continue[]];
    req = Quiet@Check[ImportString[line, "RawJSON"], $Failed];
    If[AssociationQ[req],
      WMAJsonWrite[WMAHandleRequest[req]],
      WMAJsonWrite[<|"id" -> Null, "ok" -> False, "error" -> "Invalid JSON request"|>]
    ];
  ];
];

WMAReadLoop[If[TrueQ[ValueQ[Global`$WMAStdin]], Global`$WMAStdin, $Input]];
