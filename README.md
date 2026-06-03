# Wolfram Math Agent

A Wolfram Engine backed math-agent CLI/TUI experiment focused on analysis
workflows: limits, integration, convergence tests, series, ODEs, transforms,
residues, and the theorem/invariant checks that usually surround them.

This branch implements a small TypeScript agent shell inspired by `ai4math`:

- OpenAI-compatible tool-calling loop.
- Local theorem/preplanning/routing layer inspired by `ai4math`.
- Offline plan preview for route/preplanning audits without API keys.
- JSON-extensible theorem/tactic library, filtered by default to analysis-related domains.
- Wolfram tools for analysis-first work: simplify, algebraic cleanup, differentiate, integrate, limit, solve/reduce, series, sums, convergence checks, ODEs, transforms, and residues.
- Reliable oneshot Wolfram subprocess backend.
- Markdown output for terminal and future notebook frontends.
- No CAS-specific rendering in the CLI.

## Quick Start

```powershell
npm install
npm run build
npm run doctor
npm run smoke:wolfram
npm run verify
```

Create a local config file:

```powershell
Copy-Item wma.config.example.json wma.config.json
```

`wma.config.json` is ignored by Git and is the intended place for local
settings, including API keys:

```json
{
  "openai": {
    "apiKey": "put-your-api-key-here",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-chat",
    "flashModel": "deepseek-chat",
    "proModel": "deepseek-chat",
    "autoRoute": true,
    "preplanEnabled": true,
    "maxIterations": 20,
    "maxTokens": 8192,
    "temperature": 0
  },
  "wolfram": {
    "command": "C:\\Program Files\\Wolfram Research\\WolframScript\\wolframscript.exe",
    "backendMode": "oneshot",
    "workerTimeoutMs": 120000,
    "debugStdio": false,
    "workerArgs": "",
    "bootstrapStdin": null
  },
  "theorems": {
    "source": "merge",
    "externalPath": ""
  }
}
```

Environment variables are still supported as temporary overrides for CI or
one-off shell tests, but they are not the primary configuration path.

When auto routing is enabled, simple questions use `openai.flashModel` and
complex or theory-first questions use `openai.proModel`. If those are unset,
both fall back to `openai.model`.

The supported Wolfram backend mode is `oneshot`: each tool call runs a short
`wolframscript -code ...` process. This is slower than a persistent kernel but
is the verified delivery path for the current CLI/TUI version. The old JSONL
worker mode is not supported in this release because `wolframscript` and
`WolframKernel` stdin behavior was not reliable enough for a stable agent loop.

Interactive mode:

```powershell
npm run dev
```

Single-question file input, stdin, and batch mode:

```powershell
npm run dev -- --direct-wolfram "FullSimplify[Sin[x]^2 + Cos[x]^2]"
npm run dev -- --plan "Show that a dominated pointwise limit may pass under the integral."
npm run dev -- --file question.md --output output/answer.md --trace
Get-Content question.md | npm run dev -- --output output/answer.md --trace
npm run dev -- --batch questions.md --output output/batch-run --trace
npm run dev -- -t 0 -n 12 --trace "Determine whether Sum[1/k^p,{k,1,Infinity}] converges."
```

Natural-language agent mode requires `openai.apiKey`; direct Wolfram mode only
requires a working local Wolfram Engine command.
`--plan` also does not require an API key; it prints the deterministic local
route, preplan, decomposition when needed, and the exact system context that
would be injected before an LLM call.

Batch files are split on lines containing only `---`. Saved trace reports
include routing, preplanning context, tool arguments, compact tool results, and
a verification summary that surfaces Wolfram-returned conditions and
preplanned proof checks. Questions may inline local text files with
`@path/to/file.md`.

Theorem guidance is loaded from built-ins plus `theorems/*.json` by default,
then filtered to analysis-related domains. Current default coverage includes
real/measure analysis, functional analysis, complex analysis, asymptotics, and
special functions. Set `theorems.externalPath` to merge in a custom analysis
theorem file, or set `theorems.source` to `external` to use only that external
file.

Wolfram results keep assumptions visible. If a tool returns
`ConditionalExpression[value, condition]`, the protocol exposes `output` for
the value, `conditions` for the condition, and `rawOutput` for the original
Wolfram expression. Use `wolfram_convergence` for direct p-series and related
sum convergence checks, and for extracting generated conditions from
parameter-dependent definite integrals.

For now the project keeps Wolfram capabilities as in-project structured tools
rather than a separate MCP server. That is the better short-term fit while the
analysis tool schemas, condition handling, and theorem-routing behavior are
still changing. Once those interfaces stabilize, the same tool layer can be
extracted into a Wolfram MCP so other agents can call it without depending on
this CLI.

See `NEXT_SESSION_HANDOFF.md` for the current continuation state and
`MIGRATION_AUDIT.md` for the ai4math-to-Wolfram capability map, scope
boundaries, and verification evidence.

Useful checks:

```powershell
npm run check
npm run test:planning
npm run test:plan-preview
npm run test:input
npm run test:wolfram
npm run smoke:wolfram
npm run verify
```
