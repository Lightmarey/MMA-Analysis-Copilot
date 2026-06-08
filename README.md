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
- **Proof Pattern Engine** – Suggests proof moves (Hölder, Cauchy‑Schwarz, Young, Poincaré, integration by parts, etc.) without claiming fully automated theorem proving.
- **Verification templates** – Compact symbolic checks for product rules, boundary cancellation, Fourier coefficients, Hessian invariants, and more.
- **Flexible routing** – Automatically routes simple queries to a “flash” model and complex ones to a “pro” model.
- **Theorem guidance** – JSON‑based theorem library for elliptic PDE reasoning and tactical advice.
- **CLI & REPL** – One‑shot questions, batch processing, raw Wolfram evaluation, and an interactive REPL with `/tools`, `/model`, `/reset` commands.

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wolfram Engine](https://www.wolfram.com/engine/) (or Mathematica) installed, with `wolframscript` in your PATH.
- An OpenAI‑compatible API key (e.g., DeepSeek, OpenAI).

### Installation

```bash
git clone https://github.com/your-org/wolfram-math-agent
cd wolfram-math-agent
npm install
cp wma.config.example.json wma.config.json   # create your config file
```

Edit `wma.config.json` – at minimum set your API key, base URL, and the path to `wolframscript`.

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

Each tool returns both a value and its LaTeX representation, plus any `ConditionalExpression` conditions.

### Proof Pattern Engine

A Wolfram package (`wolfram/ProofPatternEngine.wl`) that suggests or records **small proof moves**:

- `normalize`, `suggest`, `apply`, `trace`, `registry`, `parameter`, `compile`, `register`

Use it to get hints for inequalities (Hölder, Cauchy‑Schwarz, Young) or integration‑by‑parts seeds – not to prove broad analytic theorems automatically.

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
    "command": "C:\\Program Files\\Wolfram Research\\WolframScript\\wolframscript.exe"
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
  wolfram/      – Wolfram backend wrapper & types
  theorems/     – theorem schema, generator, linter
wolfram/
  protocol.wl   – Wolfram request dispatcher
  ProofPatternEngine/ – proof‑pattern package
theorems/       – JSON theorem guidance
test/           – TypeScript & Wolfram regression tests
```

### Adding a new Wolfram tool

1. Add the tool schema to `src/agent/tools.ts`.
2. Implement the handler in `src/agent/toolHandlers.ts`.
3. Add the corresponding Wolfram endpoint in `wolfram/protocol.wl`.
4. Run `npm run test:wolfram` to verify.
