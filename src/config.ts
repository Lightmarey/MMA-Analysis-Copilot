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

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const model =
  process.env.WOLFRAM_AGENT_MODEL?.trim() ||
  process.env.AI4MATH_MODEL?.trim() ||
  "gpt-4.1-mini";

export const config = {
  rootDir,
  wolframWorkerPath: path.resolve(rootDir, "wolfram", "worker.wls"),
  wolframProtocolPath: path.resolve(rootDir, "wolfram", "protocol.wl"),
  wolframCommand: process.env.WOLFRAM_COMMAND?.trim() || "",
  wolframBackendMode: process.env.WOLFRAM_BACKEND_MODE?.trim() || "oneshot",
  wolframWorkerTimeoutMs: intEnv("WOLFRAM_WORKER_TIMEOUT_MS", 120_000),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
  model,
  flashModel:
    process.env.WOLFRAM_AGENT_FLASH_MODEL?.trim() ||
    process.env.AI4MATH_FLASH_MODEL?.trim() ||
    model,
  proModel:
    process.env.WOLFRAM_AGENT_PRO_MODEL?.trim() ||
    process.env.AI4MATH_PRO_MODEL?.trim() ||
    model,
  autoRoute: boolEnv("WOLFRAM_AGENT_AUTO_ROUTE", true),
  preplanEnabled: boolEnv("WOLFRAM_AGENT_PREPLAN_ENABLED", true),
  maxIterations: intEnv("WOLFRAM_AGENT_MAX_ITERATIONS", 20),
  maxTokens: intEnv("WOLFRAM_AGENT_MAX_TOKENS", 8192),
  temperature: floatEnv("WOLFRAM_AGENT_TEMPERATURE", 0)
};
