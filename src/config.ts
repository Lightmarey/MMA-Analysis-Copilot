import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  rootDir,
  wolframWorkerPath: path.resolve(rootDir, "wolfram", "worker.wls"),
  wolframProtocolPath: path.resolve(rootDir, "wolfram", "protocol.wl"),
  wolframCommand: process.env.WOLFRAM_COMMAND?.trim() || "",
  wolframBackendMode: process.env.WOLFRAM_BACKEND_MODE?.trim() || "oneshot",
  wolframWorkerTimeoutMs: intEnv("WOLFRAM_WORKER_TIMEOUT_MS", 120_000),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
  model:
    process.env.WOLFRAM_AGENT_MODEL?.trim() ||
    process.env.AI4MATH_MODEL?.trim() ||
    "gpt-4.1-mini",
  maxIterations: intEnv("WOLFRAM_AGENT_MAX_ITERATIONS", 20),
  maxTokens: intEnv("WOLFRAM_AGENT_MAX_TOKENS", 8192),
  temperature: floatEnv("WOLFRAM_AGENT_TEMPERATURE", 0)
};
