# Wolfram Math Agent

A Wolfram Engine backed math-agent CLI/TUI experiment.

This branch implements a small TypeScript agent shell inspired by `ai4math`:

- OpenAI-compatible tool-calling loop.
- Local theorem/preplanning/routing layer inspired by `ai4math`.
- Wolfram tools for simplify, integrate, limit, solve, series, sum, ODEs, transforms, and residues.
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

Useful checks:

```powershell
npm run check
npm run test:planning
npm run test:wolfram
npm run smoke:wolfram
```
