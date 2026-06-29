import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const isSEA = (process as any).isCompiled || process.env.NODE_SEA === "true";
const appDir = isSEA ? path.dirname(process.execPath) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = process.env.WMA_CONFIG_PATH || (fs.existsSync(path.join(process.cwd(), "wma.config.json")) 
  ? path.join(process.cwd(), "wma.config.json") 
  : path.join(appDir, "wma.config.json"));

type WmaConfigFile = {
  openai?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    flashModel?: string;
    plannerModel?: string;
    proModel?: string;
    autoDiscoverModels?: boolean;
    autoRoute?: boolean;
    llmPlanningEnabled?: boolean;
    preplanEnabled?: boolean;
    maxIterations?: number;
    maxTokens?: number;
    temperature?: number;
  };
  wolfram?: {
    command?: string;
    backendMode?: string;
    formulaTransformEnginePath?: string;
    workerTimeoutMs?: number;
    debugStdio?: boolean;
    workerArgs?: string;
    bootstrapStdin?: boolean | null;
    daemonHost?: string;
    daemonPort?: number;
    daemonPidPath?: string;
  };
  theorems?: {
    source?: string;
    externalPath?: string;
  };
  prompts?: {
    systemPromptPath?: string;
    systemAddendum?: string;
    plannerPromptPath?: string;
    plannerAddendum?: string;
  };
  hooks?: {
    mode?: string;
    promptMaxChars?: number;
    beforeFinal?: string;
  };
};

export type ConfigDiagnostic = {
  level: "warning" | "error";
  message: string;
};

const configRead = readConfigFile(configPath);
const fileConfig = configRead.config;

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

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return allowed.includes(normalized as T) ? normalized as T : fallback;
}

function enumEnv<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const raw = process.env[name];
  if (!raw) return fallback;
  return enumValue(raw, allowed, fallback);
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

const plannerModel = process.env.WOLFRAM_AGENT_PLANNER_MODEL?.trim() || process.env.AI4MATH_PLANNER_MODEL?.trim() || fileConfig.openai?.plannerModel?.trim();

const flashModel =
  process.env.WOLFRAM_AGENT_FLASH_MODEL?.trim() ||
  process.env.AI4MATH_FLASH_MODEL?.trim() ||
  stringValue(fileConfig.openai?.flashModel, model);

const proModel =
  process.env.WOLFRAM_AGENT_PRO_MODEL?.trim() ||
  process.env.AI4MATH_PRO_MODEL?.trim() ||
  stringValue(fileConfig.openai?.proModel, model);

export const config = {
  rootDir: appDir,
  configPath,
  configFileLoaded: fs.existsSync(configPath),
  configDiagnostics: configRead.diagnostics,
  wolframWorkerPath: path.resolve(appDir, "wolfram", "worker.wls"),
  wolframProtocolPath: path.resolve(appDir, "wolfram", "protocol.wl"),
  formulaTransformEnginePath: path.resolve(
    process.env.FORMULA_TRANSFORM_ENGINE_PACLET_DIR?.trim() ||
      process.env.WMA_FORMULA_TRANSFORM_ENGINE_PATH?.trim() ||
      stringValue(fileConfig.wolfram?.formulaTransformEnginePath, path.join(appDir, "..", "FormulaTransformEngine"))
  ),
  wolframCommand: process.env.WOLFRAM_COMMAND?.trim() || stringValue(fileConfig.wolfram?.command),
  wolframBackendMode: process.env.WOLFRAM_BACKEND_MODE?.trim() || stringValue(fileConfig.wolfram?.backendMode, "worker"),
  wolframWorkerTimeoutMs: intEnv("WOLFRAM_WORKER_TIMEOUT_MS", numberValue(fileConfig.wolfram?.workerTimeoutMs, 120_000)),
  wolframDebugStdio: boolEnv("WOLFRAM_DEBUG_STDIO", booleanValue(fileConfig.wolfram?.debugStdio, false)),
  wolframWorkerArgs: process.env.WOLFRAM_WORKER_ARGS?.trim() || stringValue(fileConfig.wolfram?.workerArgs),
  wolframBootstrapStdin: optionalBoolEnv("WOLFRAM_BOOTSTRAP_STDIN", fileConfig.wolfram?.bootstrapStdin ?? null),
  wolframDaemonHost: process.env.WOLFRAM_DAEMON_HOST?.trim() || stringValue(fileConfig.wolfram?.daemonHost, "127.0.0.1"),
  wolframDaemonPort: intEnv("WOLFRAM_DAEMON_PORT", numberValue(fileConfig.wolfram?.daemonPort, 37623)),
  wolframDaemonPidPath: process.env.WOLFRAM_DAEMON_PID_PATH?.trim() || stringValue(fileConfig.wolfram?.daemonPidPath, path.join(appDir, ".wma-wolfram-daemon.pid")),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || stringValue(fileConfig.openai?.apiKey),
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || stringValue(fileConfig.openai?.baseUrl) || undefined,
  model,
  flashModel,
  plannerModel: plannerModel as string | undefined,
  proModel,
  autoRoute: boolEnv("WOLFRAM_AGENT_AUTO_ROUTE", booleanValue(fileConfig.openai?.autoRoute, true)),
  autoDiscoverModels: boolEnv("WOLFRAM_AGENT_AUTO_DISCOVER_MODELS", booleanValue(fileConfig.openai?.autoDiscoverModels, true)),
  llmPlanningEnabled: boolEnv("WOLFRAM_AGENT_LLM_PLANNING_ENABLED", booleanValue(fileConfig.openai?.llmPlanningEnabled, true)),
  preplanEnabled: boolEnv("WOLFRAM_AGENT_PREPLAN_ENABLED", booleanValue(fileConfig.openai?.preplanEnabled, true)),
  maxIterations: intEnv("WOLFRAM_AGENT_MAX_ITERATIONS", numberValue(fileConfig.openai?.maxIterations, 20)),
  maxTokens: intEnv("WOLFRAM_AGENT_MAX_TOKENS", numberValue(fileConfig.openai?.maxTokens, 8192)),
  temperature: floatEnv("WOLFRAM_AGENT_TEMPERATURE", numberValue(fileConfig.openai?.temperature, 0)),
  theoremSource: process.env.WOLFRAM_THEOREM_SOURCE?.trim() || process.env.AI4MATH_THEOREM_SOURCE?.trim() || stringValue(fileConfig.theorems?.source, "merge"),
  theoremExternalPath: process.env.WOLFRAM_THEOREM_EXTERNAL_PATH?.trim() || process.env.AI4MATH_THEOREM_EXTERNAL_PATH?.trim() || stringValue(fileConfig.theorems?.externalPath, path.join(appDir, "theorems")),
  systemPromptPath: process.env.WOLFRAM_AGENT_SYSTEM_PROMPT_PATH?.trim() || process.env.AI4MATH_SYSTEM_PROMPT_PATH?.trim() || stringValue(fileConfig.prompts?.systemPromptPath),
  systemPromptAddendum: process.env.WOLFRAM_AGENT_SYSTEM_PROMPT_APPEND?.trim() || process.env.AI4MATH_SYSTEM_PROMPT_APPEND?.trim() || stringValue(fileConfig.prompts?.systemAddendum),
  plannerPromptPath: process.env.WOLFRAM_AGENT_PLANNER_PROMPT_PATH?.trim() || process.env.AI4MATH_PLANNER_PROMPT_PATH?.trim() || stringValue(fileConfig.prompts?.plannerPromptPath),
  plannerPromptAddendum: process.env.WOLFRAM_AGENT_PLANNER_PROMPT_APPEND?.trim() || process.env.AI4MATH_PLANNER_PROMPT_APPEND?.trim() || stringValue(fileConfig.prompts?.plannerAddendum),
  hookMode: enumEnv("WOLFRAM_AGENT_HOOK_MODE", ["off", "trace_only", "hint"] as const, enumValue(fileConfig.hooks?.mode, ["off", "trace_only", "hint"] as const, "hint")),
  hookPromptMaxChars: intEnv("WOLFRAM_AGENT_HOOK_PROMPT_MAX_CHARS", numberValue(fileConfig.hooks?.promptMaxChars, 1200)),
  hookBeforeFinal: enumEnv("WOLFRAM_AGENT_HOOK_BEFORE_FINAL", ["off", "warning"] as const, enumValue(fileConfig.hooks?.beforeFinal, ["off", "warning"] as const, "warning"))
};

function readConfigFile(filePath: string): { config: WmaConfigFile; diagnostics: ConfigDiagnostic[] } {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        config: {},
        diagnostics: [{ level: "error", message: "wma.config.json must contain a JSON object." }]
      };
    }
    return {
      config: parsed as WmaConfigFile,
      diagnostics: validateConfigPayload(parsed)
    };
  } catch (error) {
    if (!fs.existsSync(filePath)) return { config: {}, diagnostics: [] };
    return {
      config: {},
      diagnostics: [{ level: "error", message: `Could not parse wma.config.json: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

export function validateConfigPayload(payload: unknown): ConfigDiagnostic[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [{ level: "error", message: "Config payload must be a JSON object." }];
  }
  const diagnostics: ConfigDiagnostic[] = [];
  const schema: Record<string, Record<string, "string" | "number" | "boolean" | "nullableBoolean">> = {
    openai: {
      apiKey: "string",
      baseUrl: "string",
      model: "string",
      flashModel: "string",
      plannerModel: "string",
      proModel: "string",
      autoDiscoverModels: "boolean",
      autoRoute: "boolean",
      llmPlanningEnabled: "boolean",
      preplanEnabled: "boolean",
      maxIterations: "number",
      maxTokens: "number",
      temperature: "number"
    },
    wolfram: {
      command: "string",
      backendMode: "string",
      formulaTransformEnginePath: "string",
      workerTimeoutMs: "number",
      debugStdio: "boolean",
      workerArgs: "string",
      bootstrapStdin: "nullableBoolean",
      daemonHost: "string",
      daemonPort: "number",
      daemonPidPath: "string"
    },
    theorems: {
      source: "string",
      externalPath: "string"
    },
    prompts: {
      systemPromptPath: "string",
      systemAddendum: "string",
      plannerPromptPath: "string",
      plannerAddendum: "string"
    },
    hooks: {
      mode: "string",
      promptMaxChars: "number",
      beforeFinal: "string"
    }
  };
  const record = payload as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!schema[key]) {
      diagnostics.push({ level: "warning", message: `Unknown config section: ${key}` });
      continue;
    }
    const section = record[key];
    if (!section || typeof section !== "object" || Array.isArray(section)) {
      diagnostics.push({ level: "error", message: `Config section '${key}' must be an object.` });
      continue;
    }
    const sectionRecord = section as Record<string, unknown>;
    for (const field of Object.keys(sectionRecord)) {
      const expected = schema[key][field];
      if (!expected) {
        diagnostics.push({ level: "warning", message: `Unknown config key: ${key}.${field}` });
        continue;
      }
      if (!matchesConfigType(sectionRecord[field], expected)) {
        diagnostics.push({ level: "error", message: `Config key ${key}.${field} must be ${expected === "nullableBoolean" ? "boolean or null" : expected}.` });
        continue;
      }
      if (key === "hooks" && field === "mode" && !["off", "trace_only", "hint"].includes(String(sectionRecord[field]))) {
        diagnostics.push({ level: "error", message: "Config key hooks.mode must be one of off, trace_only, hint." });
      }
      if (key === "hooks" && field === "beforeFinal" && !["off", "warning"].includes(String(sectionRecord[field]))) {
        diagnostics.push({ level: "error", message: "Config key hooks.beforeFinal must be one of off, warning." });
      }
      if (key === "wolfram" && field === "backendMode" && !["oneshot", "worker", "daemon"].includes(String(sectionRecord[field]))) {
        diagnostics.push({ level: "error", message: "Config key wolfram.backendMode must be one of oneshot, worker, daemon." });
      }
    }
  }
  return diagnostics;
}

function matchesConfigType(value: unknown, expected: "string" | "number" | "boolean" | "nullableBoolean"): boolean {
  if (expected === "nullableBoolean") return value === null || typeof value === "boolean";
  return typeof value === expected;
}
