# Wolfram Math Agent

Wolfram Math Agent is a TypeScript CLI for math assistance backed by Wolfram
Engine. It is built for interactive analysis and PDE proof work: the LLM
chooses a route, decomposes the problem, and calls structured Wolfram tools for
explicit calculations. Analytic assumptions remain visible instead of being
silently treated as computer-verified facts.

The current project lives in this repository as an interactive proof assistant,
not a whole-paper verifier or corpus-indexing system. Local directories such as
`testexamples/`, `output/`, and `auxiliary-scripts/` are ignored and may contain
private experiments; do not commit or quote their contents in public docs.

## Current Scope

Implemented core capabilities:

- CLI modes for REPL, one-shot prompts, file input, stdin input, batch runs, and
  raw Wolfram evaluation.
- OpenAI-compatible streaming tool loop with flash/pro model routing.
- LLM planning plus local theorem/preplanning fallback.
- Structured Wolfram tools for simplification, calculus, algebra, matrices,
  series, sums, convergence, ODEs, transforms, and residues.
- `proof_pattern_engine` for interactive proof-rule and transform suggestions,
  especially Holder, Cauchy-Schwarz, Young, Poincare, Sobolev, parameter
  choices, and integration-by-parts seeds.
- Verification templates for compact local symbolic checks such as product
  rules, boundary cancellation, Fourier coefficients, first variations,
  barriers, radial/ODE residuals, Kelvin power algebra, and Hessian matrix
  invariants.
- Theorem JSON guidance for theorem-level analysis and elliptic PDE reasoning.
- Config diagnostics for malformed or unknown `wma.config.json` keys.
- Tool registry drift tests across TypeScript schemas and the Wolfram protocol.

Explicitly out of scope for the current release:

- Persistent Wolfram worker mode.
- GUI or WLJS notebook integration.
- Automatic whole-paper verification.
- Corpus indexing over private TeX examples.
- Broad automatic inequality proof generation.
- Treating named analytic theorems as Wolfram-proved.

## Setup

Install dependencies:

```powershell
npm install
```

Create the local config file:

```powershell
Copy-Item wma.config.example.json wma.config.json
```

Edit `wma.config.json`. This file is ignored by Git and is the normal place for
API keys, model names, Wolfram path, and prompt overrides.

Minimal useful fields:

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
    "llmPlanningEnabled": true,
    "preplanEnabled": true,
    "maxIterations": 20,
    "maxTokens": 8192,
    "temperature": 0
  },
  "wolfram": {
    "command": "C:\\Program Files\\Wolfram Research\\WolframScript\\wolframscript.exe",
    "backendMode": "oneshot",
    "workerTimeoutMs": 120000
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
  },
  "hooks": {
    "mode": "hint",
    "promptMaxChars": 1200,
    "beforeFinal": "warning"
  }
}
```

Environment variables are supported as temporary overrides. The config file is
preferred for local development.

Hook modes control token cost:

- `hint` records hook hits and injects bounded workflow guidance into the model
  context.
- `trace_only` records hook hits in traces without adding model context.
- `off` disables hook execution.

`hooks.beforeFinal` controls whether warning-level final-answer hooks may add one
extra model round before the answer is returned. Set it to `off` for minimum
latency and token usage.

## Commands

Build and check the project:

```powershell
npm run build
npm run doctor
npm run verify
```

Start the interactive REPL:

```powershell
npm run dev
```

Ask one question:

```powershell
npm run dev -- "Determine whether Sum[1/k^p,{k,1,Infinity}] converges."
```

Evaluate raw Wolfram Language without the LLM:

```powershell
npm run dev -- --direct-wolfram "FullSimplify[Sin[x]^2 + Cos[x]^2]"
```

Use file, stdin, or batch input:

```powershell
npm run dev -- --file question.md --output output/answer.md --trace
Get-Content question.md | npm run dev -- --output output/answer.md --trace
npm run dev -- --batch questions.md --output output/batch-run --trace compact
npm run dev -- --batch questions.md --batch-start 6 --batch-count 3 --output output/batch-resume --trace compact
```

Runtime overrides:

```powershell
npm run dev -- -t 0 -n 12 --thinking off --trace compact "Compute a parameter integral and state conditions."
```

Common CLI options:

| Option | Meaning |
| --- | --- |
| `-t, --temperature <number>` | Override `openai.temperature` for one run. |
| `-n, --max-iterations <number>` | Override the tool-loop iteration budget. |
| `--thinking off|brief|full` | Control streamed reasoning display. |
| `--trace [compact|full]` | Save route, plan, tools, and verification summary. Bare `--trace` means compact. |
| `-o, --output <path>` | Write the final answer or report. |
| `-f, --file <path>` | Read one prompt from a file. |
| `-b, --batch <path>` | Split a batch file on lines containing only `---`. |
| `--batch-start <number>` | Resume from a 1-based source question number. |
| `--batch-count <number>` | Limit how many source questions are processed. |
| `--direct-wolfram` | Evaluate the prompt as raw Wolfram Language. |

In REPL mode:

```text
/help
/tools
/model
/model <id>
/model auto
/reset
/last
/save [path]
/quit
```

Multiline paste is collected as one question, which is the recommended way to
submit LaTeX problems.

## Agent Flow

The runtime flow is:

```text
question
-> optional @file inlining
-> LLM planner on the flash model
-> local theorem/preplanning analysis
-> merged route: simple -> flash, complex -> pro
-> streaming OpenAI-compatible tool loop
-> structured Wolfram tools and local tools
-> optional Markdown report
-> final answer
```

The planner is advisory. The final answer should distinguish:

- computations verified by Wolfram;
- conditions returned by Wolfram;
- theorem-level assumptions supplied by analysis;
- proof obligations still requiring user or author input.

## Tool Layers

### Structured Wolfram Tools

The tool schema lives in `src/agent/tools.ts`. Wolfram execution lives in
`src/wolfram/backend.ts` and `wolfram/protocol.wl`.

Supported tool names:

- `wolfram_eval`
- `wolfram_simplify`
- `wolfram_integrate`
- `wolfram_differentiate`
- `wolfram_limit`
- `wolfram_solve`
- `wolfram_algebra`
- `wolfram_matrix`
- `wolfram_series`
- `wolfram_sum`
- `wolfram_convergence`
- `wolfram_dsolve`
- `wolfram_transform`
- `wolfram_residue`

The supported backend mode is `oneshot`: each call runs `wolframscript -code`.
`WOLFRAM_BACKEND_MODE=worker` intentionally fails in this release.

Wolfram `ConditionalExpression[value, condition]` results expose the value,
LaTeX, condition, condition LaTeX, and raw output so reports can preserve
assumptions.

### Proof Pattern Engine

`proof_pattern_engine` calls the standalone Wolfram package at
`wolfram/InequalityEngine.wl`, with package entrypoint
`wolfram/InequalityEngine/Kernel/init.wl`.

Use it to suggest or record proof moves, not to prove broad analytic theorems.
Current operations:

- `normalize`
- `suggest`
- `apply`
- `trace`
- `registry`
- `parameter`
- `compile`
- `register`

When `suggest` has no candidate, the LLM may use `compile` with a restricted
schema containing rule names, transform names, inert string bindings, and
missing conditions. The compiler validates the schema and does not execute
LLM-proposed Wolfram code.

### Local Tools

`theorem_advisor` reads theorem guidance from built-in fallback entries and
`theorems/*.json`.

`verification_template` packages repeated finite checks into compact Wolfram
calls. Templates are for explicit symbolic targets, not for proving named
inequality theorems.

## Theorem Library

The theorem library lives in `theorems/*.json`. Entries are tactical guidance:

- keywords and signals for retrieval;
- prerequisites to check;
- invariants to track;
- verification hints;
- optional Wolfram tactics.

Generate a draft:

```powershell
npm run theorem:generate -- --name "Maximum principle" --domain elliptic_pde --domain inequalities --keyword "maximum principle" --output output/maximum-principle.json
```

Lint theorem files:

```powershell
npm run theorem:lint
```

Keep theorem JSON at theorem level. Elementary proof moves such as product
Holder, Cauchy-Schwarz, Young, parameter absorption, and simple
integration-by-parts candidates belong in `proof_pattern_engine`.

## Prompt Configuration

Prompt construction is centralized in `src/agent/prompts.ts`.

Config keys:

- `prompts.systemPromptPath`
- `prompts.systemAddendum`
- `prompts.plannerPromptPath`
- `prompts.plannerAddendum`

Environment override names:

- `WOLFRAM_AGENT_SYSTEM_PROMPT_PATH`
- `WOLFRAM_AGENT_SYSTEM_PROMPT_APPEND`
- `WOLFRAM_AGENT_PLANNER_PROMPT_PATH`
- `WOLFRAM_AGENT_PLANNER_PROMPT_APPEND`

Use these for prompt experiments instead of hardcoding prompt changes in the
agent loop.

## Reports And Validation

Saved reports can include:

- route and model;
- merged preplanning context;
- compact or full tool trace;
- Wolfram conditions;
- verification summary;
- final answer.

Run the delivery gate before treating changes as complete:

```powershell
npm run verify
```

Useful focused checks:

```powershell
npm run test
npm run test:wolfram
npm run test:prompts
npm run test:theorems
```

## Project Map

```text
src/cli/                 CLI, REPL, batch, reports, runtime overrides
src/agent/               agent loop, prompts, planning, routing, streaming, tools
src/wolfram/             Node/Wolfram backend wrapper and types
src/theorems/            theorem schema, generator, linter
wolfram/protocol.wl      Wolfram request dispatcher
wolfram/InequalityEngine proof-pattern package
theorems/                theorem guidance data
test/                    TypeScript and Wolfram-backed regression tests
```

For current module status and recommended refactors, read
`IMPLEMENTATION_REPORT.md`. For continuation steps, read
`NEXT_SESSION_HANDOFF.md`.
