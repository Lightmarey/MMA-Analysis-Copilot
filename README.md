# Wolfram Math Agent

Wolfram Math Agent is a TypeScript CLI that ports the useful `ai4math` agent
framework to a Wolfram Engine backend. The current scope is intentionally
analysis-focused: limits, integrals, convergence, series, ODEs, transforms,
residues, special functions, and the theorem/preplanning/routing/verification
framework around those tools.

It does not currently ship probability, broad number theory, modular forms,
algebraic geometry, GUI/WLJS integration, or a persistent Wolfram worker.

## Configuration

Runtime configuration is file-first. The local config file is ignored by Git:

```powershell
Copy-Item wma.config.example.json wma.config.json
```

Edit `wma.config.json`:

```json
{
  "openai": {
    "apiKey": "your-api-key",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-chat",
    "flashModel": "deepseek-chat",
    "proModel": "deepseek-chat",
    "autoDiscoverModels": true,
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

Environment variables are still accepted as temporary overrides for CI or
one-off tests, but `wma.config.json` is the normal path.

When `openai.autoDiscoverModels` is enabled and an API key is available,
startup probes the provider's OpenAI-compatible model list. Explicit
`flashModel` and `proModel` values are respected when the provider reports
them; otherwise the agent infers fast/pro routes from model names such as
`chat`, `flash`, `reasoner`, `pro`, or `r1`.

## Commands

`npm run dev -- ...` uses npm's argument separator. The empty-looking `--`
belongs to npm, not this CLI: everything after it is forwarded to
`tsx src/cli/main.ts`. Without it, npm may try to parse flags such as `-t`,
`-n`, or `--file` itself.

If you do not want to type npm's separator, run the CLI directly:

```powershell
npx tsx src/cli/main.ts --plan "Show that a dominated pointwise limit may pass under the integral."
npm run build
node dist\cli\main.js --direct-wolfram "2+2"
```

```powershell
npm install
npm run build
npm run doctor
npm run verify
```

Interactive agent mode:

```powershell
npm run dev
```

One-shot agent mode:

```powershell
npm run dev -- "Determine whether Sum[1/k^p,{k,1,Infinity}] converges."
```

Direct Wolfram mode, no LLM required:

```powershell
npm run dev -- --direct-wolfram "FullSimplify[Sin[x]^2 + Cos[x]^2]"
```

Local plan preview, no LLM or Wolfram call required:

```powershell
npm run dev -- --plan "Show that a dominated pointwise limit may pass under the integral."
```

File, stdin, and batch input:

```powershell
npm run dev -- --file question.md --output output/answer.md --trace
Get-Content question.md | npm run dev -- --output output/answer.md --trace
npm run dev -- --batch questions.md --output output/batch-run --trace
```

Runtime CLI overrides:

```powershell
npm run dev -- -t 0 -n 12 --trace "Compute a parameter integral and state conditions."
```

Common options:

| Option | Meaning |
| --- | --- |
| `-t, --temperature <number>` | Override `openai.temperature` for one run. Use `0` for deterministic output. |
| `-n, --max-iterations <number>` | Override `openai.maxIterations`, the maximum LLM/tool loop count. |
| `--trace` | Include route, preplanning, tool calls, Wolfram results, and verification summary in saved Markdown. |
| `-o, --output <path>` | Write the final answer or report to a file. |
| `-f, --file <path>` | Read one question from a text/Markdown file. |
| `-b, --batch <path>` | Process a batch file split by lines containing only `---`. |
| `--plan` | Print deterministic local route/preplan/decomposition without LLM or Wolfram. |
| `--direct-wolfram` | Evaluate raw Wolfram Language without LLM. |

## Agent Flow

The framework follows the migrated `ai4math` shape:

```text
question
-> local theorem advisor / problem analysis
-> deterministic preplan and optional decomposition
-> simple/complex model route
-> OpenAI-compatible tool loop
-> Wolfram structured tools
-> trace report and verification summary
-> final Markdown answer
```

`--plan` stops before the LLM/tool loop. It only runs local deterministic
TypeScript code in `src/agent/planning.ts`, so it can audit route and injected
context without an API key.

## Wolfram Backend

The supported backend is `oneshot`. Each structured tool call runs:

```text
wolframscript -code ...
```

The old JSONL worker path is intentionally unsupported for this release because
local stdin behavior was not stable enough for delivery.

Wolfram `ConditionalExpression[value, condition]` results expose:

- `output`
- `latex`
- `conditions`
- `conditionLatex`
- `rawOutput`
- `rawLatex`

Trace reports include route, preplanning context, tool trace, returned
conditions, verification summary, and answer.

## MCP Migration

The current in-process tool layer is deliberately close to an MCP server shape.
When the theorem library and Wolfram tool schemas become large, migrate by
moving the stable pieces behind an MCP boundary:

1. Keep theorem data in JSON files under `theorems/`.
2. Keep Wolfram execution in `src/wolfram/backend.ts`.
3. Reuse `src/agent/tools.ts` as the source of tool names, descriptions, and
   JSON schemas.
4. Add an MCP server package that maps each tool schema to an MCP tool
   `inputSchema`.
5. Implement MCP tool handlers by calling `WolframBackend.call(...)` for
   Wolfram tools and `runLocalTool(...)` for local tools such as
   `theorem_advisor`.
6. Let this CLI either keep using the in-process tools for speed, or become an
   MCP client for parity with other agents.

This avoids rewriting accumulated theorem/function knowledge. The MCP layer is
mostly a transport and registration adapter around the existing schemas and
handlers.

## Verification

```powershell
npm run check
npm run test
npm run test:wolfram
npm run smoke:wolfram
npm run verify
```

`npm run verify` runs unit checks, Wolfram tool tests, TypeScript build, and
`doctor`.
