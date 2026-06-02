# Wolfram Math Agent

A Wolfram Engine backed math-agent CLI/TUI experiment.

This branch implements a small TypeScript agent shell inspired by `ai4math`:

- OpenAI-compatible tool-calling loop.
- Persistent Wolfram worker over JSON lines.
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
WOLFRAM_COMMAND=C:\Program Files\Wolfram Research\WolframScript\wolframscript.exe
```

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
