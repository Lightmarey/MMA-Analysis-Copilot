import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(rootDir, "wma.config.json");

type WmaConfigFile = {
  openai?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    flashModel?: string;
    proModel?: string;
    autoRoute?: boolean;
    preplanEnabled?: boolean;
    maxIterations?: number;
    maxTokens?: number;
    temperature?: number;
  };
  wolfram?: {
    command?: string;
    backendMode?: string;
    workerTimeoutMs?: number;
    debugStdio?: boolean;
    workerArgs?: string;
    bootstrapStdin?: boolean | null;
  };
  theorems?: {
    source?: string;
    externalPath?: string;
  };
};

const fileConfig = readConfigFile(configPath);

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

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

function optionalBoolEnv(name: string, fallback: boolean | null): boolean | null {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["null", "auto", "default"].includes(normalized)) return null;
  return fallback;
}

const model =
  process.env.WOLFRAM_AGENT_MODEL?.trim() ||
  process.env.AI4MATH_MODEL?.trim() ||
  stringValue(fileConfig.openai?.model, "gpt-4.1-mini");

const flashModel =
  process.env.WOLFRAM_AGENT_FLASH_MODEL?.trim() ||
  process.env.AI4MATH_FLASH_MODEL?.trim() ||
  stringValue(fileConfig.openai?.flashModel, model);

const proModel =
  process.env.WOLFRAM_AGENT_PRO_MODEL?.trim() ||
  process.env.AI4MATH_PRO_MODEL?.trim() ||
  stringValue(fileConfig.openai?.proModel, model);

export const config = {
  rootDir,
  configPath,
  configFileLoaded: fs.existsSync(configPath),
  wolframWorkerPath: path.resolve(rootDir, "wolfram", "worker.wls"),
  wolframProtocolPath: path.resolve(rootDir, "wolfram", "protocol.wl"),
  wolframCommand: process.env.WOLFRAM_COMMAND?.trim() || stringValue(fileConfig.wolfram?.command),
  wolframBackendMode: process.env.WOLFRAM_BACKEND_MODE?.trim() || stringValue(fileConfig.wolfram?.backendMode, "oneshot"),
  wolframWorkerTimeoutMs: intEnv("WOLFRAM_WORKER_TIMEOUT_MS", numberValue(fileConfig.wolfram?.workerTimeoutMs, 120_000)),
  wolframDebugStdio: boolEnv("WOLFRAM_DEBUG_STDIO", booleanValue(fileConfig.wolfram?.debugStdio, false)),
  wolframWorkerArgs: process.env.WOLFRAM_WORKER_ARGS?.trim() || stringValue(fileConfig.wolfram?.workerArgs),
  wolframBootstrapStdin: optionalBoolEnv("WOLFRAM_BOOTSTRAP_STDIN", fileConfig.wolfram?.bootstrapStdin ?? null),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || stringValue(fileConfig.openai?.apiKey),
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || stringValue(fileConfig.openai?.baseUrl) || undefined,
  model,
  flashModel,
  proModel,
  autoRoute: boolEnv("WOLFRAM_AGENT_AUTO_ROUTE", booleanValue(fileConfig.openai?.autoRoute, true)),
  preplanEnabled: boolEnv("WOLFRAM_AGENT_PREPLAN_ENABLED", booleanValue(fileConfig.openai?.preplanEnabled, true)),
  maxIterations: intEnv("WOLFRAM_AGENT_MAX_ITERATIONS", numberValue(fileConfig.openai?.maxIterations, 20)),
  maxTokens: intEnv("WOLFRAM_AGENT_MAX_TOKENS", numberValue(fileConfig.openai?.maxTokens, 8192)),
  temperature: floatEnv("WOLFRAM_AGENT_TEMPERATURE", numberValue(fileConfig.openai?.temperature, 0)),
  theoremSource: process.env.WOLFRAM_THEOREM_SOURCE?.trim() || process.env.AI4MATH_THEOREM_SOURCE?.trim() || stringValue(fileConfig.theorems?.source, "merge"),
  theoremExternalPath: process.env.WOLFRAM_THEOREM_EXTERNAL_PATH?.trim() || process.env.AI4MATH_THEOREM_EXTERNAL_PATH?.trim() || stringValue(fileConfig.theorems?.externalPath)
};

function readConfigFile(filePath: string): WmaConfigFile {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as WmaConfigFile : {};
  } catch {
    return {};
  }
}
