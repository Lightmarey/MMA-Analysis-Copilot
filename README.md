# Wolfram Math Agent

Wolfram Math Agent is a TypeScript CLI that ports the useful `ai4math` agent
framework to a Wolfram Engine backend. The current scope is intentionally
analysis-focused: limits, integrals, convergence, series, ODEs, transforms,
residues, special functions, and the theorem/preplanning/routing/verification
framework around those tools.

It does not currently ship probability, broad number theory, modular forms,
algebraic geometry, GUI/WLJS integration, or a persistent Wolfram worker.

For a current module-by-module status report, see
`IMPLEMENTATION_REPORT.md`.

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
    "llmPlanningEnabled": true,
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
  },
  "prompts": {
    "systemPromptPath": "",
    "systemAddendum": "",
    "plannerPromptPath": "",
    "plannerAddendum": ""
  }
}
```

Environment variables are still accepted as temporary overrides for CI or
one-off tests, but `wma.config.json` is the normal path.

Prompt engineering is configurable without editing source code:

- `prompts.systemPromptPath` or `WOLFRAM_AGENT_SYSTEM_PROMPT_PATH`
- `prompts.systemAddendum` or `WOLFRAM_AGENT_SYSTEM_PROMPT_APPEND`
- `prompts.plannerPromptPath` or `WOLFRAM_AGENT_PLANNER_PROMPT_PATH`
- `prompts.plannerAddendum` or `WOLFRAM_AGENT_PLANNER_PROMPT_APPEND`

The built-in prompt tells the agent to use Wolfram for exact computation,
separate analytic assumptions from verified calculations, and route
interactive inequality proof states through `inequality_engine`.

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
npx tsx src/cli/main.ts "Show that a dominated pointwise limit may pass under the integral."
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

In interactive mode, multiline paste is collected as one question. This is the
recommended way to paste LaTeX problems with `cases`, `align`, or displayed
equations without putting the whole prompt on one shell command line.

Interactive model control:

```powershell
/model
/model deepseek-v4-pro
/model auto
```

`/model` lists discovered provider models and the current route. `/model <id>`
forces the current REPL session to use that model for final answering. Planning
still uses the resolved flash model so the route decision remains fast; `/model
auto` clears the override and returns to automatic flash/pro routing.

During LLM calls the CLI streams provider reasoning as `[think]` when available
and normal answer text as `[output]`, so long responses show visible progress
before tool calls or the final answer finish.

One-shot agent mode:

```powershell
npm run dev -- "Determine whether Sum[1/k^p,{k,1,Infinity}] converges."
```

Direct Wolfram mode, no LLM required:

```powershell
npm run dev -- --direct-wolfram "FullSimplify[Sin[x]^2 + Cos[x]^2]"
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
| `--direct-wolfram` | Evaluate raw Wolfram Language without LLM. |

## Agent Flow

The framework follows the migrated `ai4math` shape:

```text
question
-> LLM planner: strategy, difficulty, decomposition, verification targets
-> simple/complex model route from the LLM plan
-> OpenAI-compatible tool loop
-> Wolfram structured tools
-> trace report and verification summary
-> final Markdown answer
```

The theorem advisor in `src/agent/planning.ts` is retained as local theorem
retrieval and as a fallback if the LLM planning call fails. It is not the main
route decision path. With `openai.llmPlanningEnabled` and `openai.autoRoute`
enabled, the agent first asks the resolved flash model to classify and
decompose the problem, then routes simple tasks to the flash model and complex
tasks to the pro model.

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

## Theorem Authoring

The theorem library lives in `theorems/*.json`. Entries are tactical guidance,
not full proofs. A good theorem entry tells the agent:

- when the theorem should be considered (`keywords`, `signals`)
- what hypotheses must be checked (`prerequisites`)
- which quantities matter (`invariantHints`)
- what must be verified before the final answer (`verificationHints`)
- what Wolfram tools may verify side conditions (`wolframHint`)

Generate a draft:

```powershell
npm run theorem:generate -- --name "Maximum principle" --domain elliptic_pde --domain inequalities --keyword "maximum principle" --output output/maximum-principle.json
```

Lint theorem files:

```powershell
npm run theorem:lint
```

The generator intentionally creates a draft, not production-ready knowledge.
Review the hypotheses, verification targets, sign conventions, and
`wolframHint` before moving generated entries into `theorems/`.

Current scoped additions cover elliptic PDE and inequalities, including maximum
principles, Hopf lemma, Sobolev-Poincare, and Calderon-Zygmund estimates.
Elementary interactive inequality moves such as explicit product Holder or
Cauchy-Schwarz candidates now belong to the standalone Wolfram
`InequalityEngine`, not theorem JSON entries.

## Inequality Engine

`wolfram/InequalityEngine.wl` is a standalone Wolfram package for interactive
inequality proof assistance. It can be loaded directly from Wolfram or called
through the `inequality_engine` tool.

Current exported operations include:

- `IneqNormalize`
- `IneqSuggest`
- `IneqApply`
- `IneqTrace`
- `ValidateIneqRule`
- `ValidateIneqTransform`
- `IneqParameterChoice`

The engine currently provides a conservative seed move for explicit product
integrals using a Holder/Cauchy-Schwarz default. It is intentionally not a
broad automatic inequality generator. Unverified analytic hypotheses are kept
visible in condition status fields such as `NeedsUser` or
`GeneratedByParameterChoice`.

## Verification

```powershell
npm run theorem:lint
npm run check
npm run test
npm run test:wolfram
npm run smoke:wolfram
npm run verify
```

`npm run verify` runs unit checks, Wolfram tool tests, TypeScript build, and
`doctor`.
