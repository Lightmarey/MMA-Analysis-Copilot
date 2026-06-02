# Wolfram Math Agent

A Wolfram Engine backed math-agent CLI/TUI experiment.

This branch implements a small TypeScript agent shell inspired by `ai4math`:

- OpenAI-compatible tool-calling loop.
- Local theorem/preplanning/routing layer inspired by `ai4math`.
- JSON-extensible theorem/tactic library.
- Wolfram tools for simplify, algebra, differentiate, integrate, limit, solve, matrix operations, series, sum, ODEs, transforms, and residues.
- Optional persistent Wolfram worker over JSON lines.
- Markdown output for terminal and future notebook frontends.
- No CAS-specific rendering in the CLI.

## Quick Start

```powershell
npm install
npm run build
npm run doctor
npm run smoke:wolfram
npm run dev -- "FullSimplify[Sin[x]^2 + Cos[x]^2]"
```

Set these environment variables as needed:

```text
OPENAI_API_KEY=...
OPENAI_BASE_URL=...
WOLFRAM_AGENT_MODEL=...
WOLFRAM_AGENT_FLASH_MODEL=...
WOLFRAM_AGENT_PRO_MODEL=...
WOLFRAM_AGENT_AUTO_ROUTE=true
WOLFRAM_AGENT_PREPLAN_ENABLED=true
WOLFRAM_THEOREM_SOURCE=merge
WOLFRAM_THEOREM_EXTERNAL_PATH=
WOLFRAM_COMMAND=C:\Program Files\Wolfram Research\WolframScript\wolframscript.exe
```

When auto routing is enabled, simple questions use `WOLFRAM_AGENT_FLASH_MODEL`
and complex or theory-first questions use `WOLFRAM_AGENT_PRO_MODEL`. If those
are unset, both fall back to `WOLFRAM_AGENT_MODEL`.

The default Wolfram backend mode is `oneshot`: each tool call runs a short
`wolframscript -code ...` process. This is slower than a persistent kernel but
works reliably for the first CLI/TUI version. The experimental JSONL worker is
kept behind:

```text
WOLFRAM_BACKEND_MODE=worker
```

Interactive mode:

```powershell
npm run dev
```

Single-question file input, stdin, and batch mode:

```powershell
npm run dev -- --file question.md --output output/answer.md --trace
Get-Content question.md | npm run dev -- --output output/answer.md --trace
npm run dev -- --batch questions.md --output output/batch-run --trace
```

Batch files are split on lines containing only `---`. Saved trace reports
include routing, preplanning context, tool arguments, and compact tool results.
Questions may inline local text files with `@path/to/file.md`.

Theorem guidance is loaded from built-ins plus `theorems/*.json` by default.
Set `WOLFRAM_THEOREM_EXTERNAL_PATH` to merge in a custom theorem file, or set
`WOLFRAM_THEOREM_SOURCE=external` to use only that external file.

Useful checks:

```powershell
npm run check
npm run test:planning
npm run test:input
npm run test:wolfram
npm run smoke:wolfram
```
