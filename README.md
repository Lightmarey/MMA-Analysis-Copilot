# Wolfram Math Agent

**Wolfram Math Agent** is a TypeScript CLI that combines large language models (LLM) with a live Wolfram Engine for **interactive mathematical analysis and PDE proof assistance**.
It does **not** treat analytic assumptions as computer‑verified facts – assumptions remain visible, traceable, and under your control.

[![npm version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/your-org/wolfram-math-agent)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6)](https://www.typescriptlang.org/)
[![Wolfram](https://img.shields.io/badge/Wolfram-Engine-DD1100)](https://www.wolfram.com/engine/)

---

## ✨ Key Features

- **LLM + Wolfram hybrid** – The LLM plans the approach, then calls structured Wolfram tools for exact calculations.
- **Interactive proof assistance** – Not a whole‑paper verifier, but a step‑by‑step assistant that keeps assumptions explicit.
- **Workflow hooks** – Optional, bounded checks (transform ledger, assumption ledger, case splits, final warnings) that can inject guidance or run silently.
- **Formula Transform Engine** – Applies deterministic formula transformations (`formula_transform`) such as Hölder, Cauchy‑Schwarz, Young, and integration by parts with direction, trace, conditions, obligations, and round‑trippable state.
- **Proof Pattern Engine compatibility** – Retains legacy/internal proof‑move hints without making it the public formula transformation entrypoint.
- **Verification templates** – Compact symbolic checks for product rules, boundary cancellation, Fourier coefficients, Hessian invariants, and more.
- **Flexible routing** – Automatically routes simple queries to a “flash” model and complex ones to a “pro” model.
- **Theorem guidance** – JSON‑based theorem library for elliptic PDE reasoning and tactical advice.
- **CLI & REPL** – One‑shot questions, batch processing, raw Wolfram evaluation, and an interactive REPL with `/tools`, `/model`, `/reset` commands.

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wolfram Engine](https://www.wolfram.com/engine/) or Mathematica 15+ installed. The agent auto-discovers Wolfram on Windows, falls back to `wolframscript` on `PATH`, and still supports an explicit command override.
- An OpenAI‑compatible API key (e.g., DeepSeek, OpenAI).

### Installation

```bash
git clone https://github.com/your-org/wolfram-math-agent
cd wolfram-math-agent
npm install
cp wma.config.example.json wma.config.json   # create your config file
```

Edit `wma.config.json` – at minimum set your API key and base URL. Leave `wolfram.command` empty for auto-discovery, or set it to an explicit `wolframscript.exe` / `WolframKernel.exe` path when needed.

### Run your first query

```bash
npm run dev -- "Does ∑ 1/k^p converge?"
```

Or start the REPL:

```bash
npm run dev
```

Inside the REPL, you can paste multiline LaTeX problems, use `/help`, switch models with `/model`, and save sessions.

---

## 📦 Core Concepts

### How it works

```text
Question → Planner (flash model) → Workflow hooks (optional) → Routing (simple/complex) → Tool loop (Wolfram + local tools) → Report + final answer
```

- The **planner** suggests a route – it does **not** execute code.
- **Wolfram tools** return `ConditionalExpression` with explicit assumptions (e.g., `Converges if p > 1`). The agent preserves these in the final answer.
- **Formula transformations** go through `formula_transform`. Rule, heuristic, and structural JSON are compiled by Wolfram's restricted compiler; the TypeScript layer only routes schema, config, and formatted output.
- **Workflow hooks** (e.g., assumption ledger, case‑split ledger) are deterministic TypeScript checks. They can add short hints to the LLM (`mode: hint`), only log to traces (`mode: trace_only`), or be disabled (`mode: off`).
- **Before‑final warning** hooks may trigger one extra LLM round when `hooks.beforeFinal: "warning"` (default) to catch unverified symbolic claims.

### Wolfram Tools

All tools are structured calls to Wolfram Engine. Supported operations:

- `wolfram_eval` – arbitrary Wolfram code
- `wolfram_simplify`, `equivalence_check`
- `integrate`, `differentiate`, `limit`, `solve`, `dsolve`
- `algebra`, `matrix`, `series`, `series_coefficient_check`
- `sum`, `convergence`
- `transform` (Laplace, Fourier, etc.)
- `residue`
- `formula_transform` – deterministic formula transformations with JSON-compiled rules and assumptions-aware condition ledgers

Each tool returns both a value and its LaTeX representation, plus any `ConditionalExpression` conditions.

### Formula Transform Engine

A sibling Wolfram paclet (`../FormulaTransformEngine` by default) powers the public `formula_transform` tool. Override the path with `FORMULA_TRANSFORM_ENGINE_PACLET_DIR`, `WMA_FORMULA_TRANSFORM_ENGINE_PATH`, or `wolfram.formulaTransformEnginePath` in `wma.config.json`.

The remaining full-version work is tracked in [`FORMULA_TRANSFORM_TASKS.md`](FORMULA_TRANSFORM_TASKS.md).

- actions: `apply`, `plan_parts`, `plan_apply`, `compile_rule`, `compile_heuristic`, `compile_seed`, `compile_planner`, `compile_structural`, `inspect_registry`, `get_obligations`, `discharge_obligation`
- built-in JSON rules: `Holder`, `CauchySchwarz`, `Young`, `IntegrationByParts`
- built-in JSON heuristics: `SplitSqrt`, `MultiplyByOne`
- built-in estimate seeds: `Poincare`, `Sobolev`
- built-in structural transforms: `DerivativeProduct`, `CommutatorDerivative`, `NormalizeByFactor`, `DropBoundaryTerm`
- registry kinds: `CanonicalFormulaTransform`, `HeuristicRewrite`, `EstimateSeed`, `StructuralTransform`, `TargetPlanner`, `ObligationDischarger`
- directions: `Upper`, `Lower`, `TwoSided`, `Equal`, `Auto`

Rule, heuristic, estimate seed, and obligation discharger files live under the paclet's `Registry/` directory. The compiler accepts only the restricted JSON DSL and a whitelist of primitives such as `Integral`, `Sum`, `Product`, `Abs`, `Power`, `NormIntegral`, `FunctionSpace`, `RealValued`, `Nonnegative`, and `YoungConstant`.

Rules use `runtime: "GenericTemplate"` when their matcher, derived bindings, orientations, and conditions are expressible in the JSON DSL. `Young`, `Holder`, `CauchySchwarz`, and `IntegrationByParts` use this path: Wolfram matches slots, evaluates JSON `derivedBindings`, selects the requested orientation, builds the relation, and compiles JSON conditions into the assumptions/obligations ledger.

Heuristics are also JSON-compiled. `SplitSqrt` and `MultiplyByOne` declare matchers, a rewrite template, side conditions, cost, and max applications. Product estimates use bounded heuristic search: by default the engine searches one rewrite layer, records `Runtime -> "JSONHeuristic"` in trace, avoids loops with a visited-expression ledger, and keeps generated side conditions in the same obligations ledger. Request parameters can set `allowedHeuristics` and `maxSearchDepth` for one-shot search control without mutating the registry.

Use `plan_parts`, `plan_apply`, or `apply` with `parameters.targetRelation` / `parameters.targetPattern` for one-shot target-shaped estimates, such as choosing a Young absorption coefficient to match `C a b <= 1/2 a^2 + K b^2`. Start with `plan_parts` when the target is embedded in a larger formula or several subexpressions might match: it returns candidate `PartPath` values and optional per-candidate transform previews without mutating the registry. For weighted Holder, either pass a request-time `parameters.weight` such as `"w[x]"` or provide a `targetRelation` whose right side is an explicit product of weighted Lp/Lq norm factors; the engine infers the temporary weight when the two norm factors determine it consistently. In both cases it plans a temporary `MultiplyByOneWeight` heuristic pipeline instead of registering a `WeightedHolder` rule. These target requests are not persisted into the registry; the engine returns a temporary plan with parameter synthesis, trace, and any generated obligations.

Target-guided planners are also JSON descriptors under `Registry/TargetPlanners/`. The current descriptors are `YoungAbsorption` and `WeightedHolder`: they declare which rule families and objectives they serve, select a restricted Wolfram runtime, and list the allowed planner primitives used by that runtime, such as target lhs matching, absorbed-quadratic inference, residual-coefficient condition generation, or weighted-norm weight inference. These primitive names are validated metadata, not executable Wolfram code, and they do not create persistent transform rules. At runtime the selected planner checks that required primitives are declared and returns a `TargetPlannerPrimitiveAudit` ledger with executed and missing steps; the Young absorption runtime is composed from matching Wolfram helper primitives for target parsing, lhs matching, factor extraction, absorbed-factor inference, residual inference, coefficient calculation, and residual-condition construction. `compile_planner` can register an additional descriptor at runtime; when several descriptors match the same rule family and runtime, the most recently registered descriptor is selected, so experiments can override metadata without changing the canonical rule JSON.

When the selected expression is embedded inside a larger formula, pass `part: "Auto"` together with `parameters.targetRelation` or `parameters.targetPattern` only when a unique match is expected. `targetRelation` selects by the relation lhs; `targetPattern` is a one-shot Wolfram pattern such as `"a_ b_"` or `"Inactive[Integrate][_Times, {_, _, _}]"` and is used only to choose the subexpression, not to register a new rule. If there may be ambiguity, call `plan_parts` first and retry `apply` / `plan_apply` with an explicit path such as `1`, `1,2`, or `{1,2}`.

Use `get_obligations` to inspect deferred side conditions and `discharge_obligation` with assumptions/context plus optional `parameters.obligationId` to consume them. Current built-in dischargers cover boundary-vanishing declarations, real-valuedness declarations, normalization declarations, and function-space/regularity/measurability/domain-regularity declarations. Dischargers are restricted JSON entries with structured evidence rules (`source`, `containsAny`, `containsAll`, optional `obligationKinds`, `label`); successful discharges record the matched evidence in the returned obligation state instead of silently deleting the side condition.

Sobolev and Poincare are exposed as `EstimateSeed` entries. They instantiate theorem-level estimate templates and return domain, function-space, exponent, and normalization obligations; they are intentionally separate from canonical algebraic transforms such as Holder or Young.

Derivative product expansion, first-order derivative commutators, explicit factor normalization, and explicit boundary-term removal are exposed as `StructuralTransform` entries. They are equality transforms with regularity, nonzero-factor, or boundary-vanishing obligations, intentionally separate from inequality rules and estimate seeds.

Structural transforms use `runtime: "GenericStructural"` when their matcher and equality relation fit the restricted JSON DSL. `DerivativeProduct`, `CommutatorDerivative`, `NormalizeByFactor`, and `DropBoundaryTerm` use this path: JSON declares the matcher, expression parameters, derived bindings, equality template, and side-condition templates, while Wolfram supplies only the compiler primitives and obligation ledger.

### Theorem Library

JSON files in `theorems/` provide tactical guidance for theorems (e.g., Maximum Principle). You can generate a draft:

```bash
npm run theorem:generate -- --name "Maximum principle" --domain elliptic_pde --output output/maximum-principle.json
```

Lint all theorem files:

```bash
npm run theorem:lint
```

---

## 🖥️ CLI Usage

| Command | Description |
|---------|-------------|
| `npm run dev -- "question"` | One‑shot query |
| `npm run dev -- --direct-wolfram "Simplify[Sin[x]^2+Cos[x]^2]"` | Raw Wolfram evaluation (no LLM) |
| `npm run dev -- -f question.md -o answer.md --trace` | Read prompt from file, save answer, enable trace |
| `npm run dev -- --batch questions.md --output output/batch` | Batch process a file split by `---` |
| `npm run dev -- --batch-start 6 --batch-count 3` | Resume batch from question #6 |
| `npm run dev -- -t 0 -n 12 --thinking off` | Override temperature, max iterations, reasoning display |
| `npm run dev -- wolfram-daemon start` | Start the optional cross-process Wolfram daemon |
| `npm run dev -- wolfram-daemon status` | Check whether the Wolfram daemon is running |
| `npm run dev -- wolfram-daemon stop` | Stop the Wolfram daemon |

**REPL commands** (when running without a prompt):

- `/help` – show help
- `/tools` – list available Wolfram tools
- `/model [id\|auto]` – switch model or enable auto‑routing
- `/reset` – clear conversation history
- `/last` – repeat last answer
- `/save [path]` – save current session
- `/quit` – exit

### Output options

- `--trace [compact\|full]` – saves planning, tool calls, and verification summary.
- `-o, --output <path>` – writes the final answer (Markdown) to a file.

---

## ⚙️ Configuration

All settings are in `wma.config.json`. Environment variables (e.g., `WOLFRAM_AGENT_HOOK_MODE`) override config values temporarily.

### Minimal config example

```json
{
  "openai": {
    "apiKey": "your-key",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-chat",
    "flashModel": "deepseek-chat",
    "proModel": "deepseek-chat",
    "autoRoute": true,
    "llmPlanningEnabled": true,
    "maxIterations": 20
  },
  "wolfram": {
    "command": "",
    "backendMode": "worker"
  },
  "hooks": {
    "mode": "hint",
    "promptMaxChars": 1200,
    "beforeFinal": "warning"
  }
}
```

### Hook modes

- `hint` – add workflow guidance to the model context (moderate token cost)
- `trace_only` – record hook hits in traces only (no extra tokens)
- `off` – completely disable hooks

Set `hooks.beforeFinal: "off"` to avoid the extra LLM round for final warnings (minimum latency).

### Wolfram backend modes

- `worker` is the default. One Wolfram process is kept alive for the current CLI, REPL, direct, or batch run.
- `oneshot` is the compatibility mode. It starts `wolframscript -code` for every tool call.
- `daemon` connects to a local daemon started with `wma wolfram-daemon start`, so separate CLI launches can share a long-lived Wolfram worker.

Set `wolfram.backendMode` or `WOLFRAM_BACKEND_MODE` to `worker`, `oneshot`, or `daemon`.

### Wolfram command discovery

By default, `wolfram.command` is empty. The backend resolves the executable in this order:

1. `wolfram.command` / `WOLFRAM_AGENT_WOLFRAM_COMMAND`
2. Windows Wolfram installs under `C:\Program Files\Wolfram Research\Wolfram\`, choosing the highest version first
3. `wolframscript` from `PATH`
4. final fallback literal command `wolframscript`

`npm run doctor` reports the command and detected Wolfram version so a stale hardcoded path is visible.

---

## 🔧 Development

### Build & test

```bash
npm run build        # compile TypeScript
npm run doctor       # check config and tool registration
npm run verify       # full delivery gate (build + doctor + tests)
npm test             # run tests
npm run test:wolfram # Wolfram integration tests
```

### Project structure

```
src/
  cli/          – REPL, batch processing, reports, CLI overrides
  agent/        – main loop, prompts, planning, routing, tools
  wolfram/      – Wolfram backend wrapper, types, and runtime assets
    runtime/    – protocol.wl and worker.wls used by source/dev runs
  theorems/     – theorem schema, generator, linter
../FormulaTransformEngine/
  PacletInfo.wl
  Registry/     – JSON registry for deterministic formula transforms
theorems/       – JSON theorem guidance
test/           – TypeScript & Wolfram regression tests
```

### Adding a new Wolfram tool

1. Add the tool schema to `src/agent/tools.ts`.
2. Implement the handler in `src/agent/toolHandlers.ts`.
3. Add the corresponding Wolfram endpoint in `src/wolfram/runtime/protocol.wl`.
4. Run `npm run test:wolfram` to verify.
