import OpenAI from "openai";
import { config } from "../config.js";

export type ModelRoute = {
  defaultModel: string;
  flashModel: string;
  proModel: string;
  discovered: boolean;
  availableModels: string[];
  warning?: string;
};

let cachedRoute: Promise<ModelRoute> | null = null;

export function resetModelRouteCache(): void {
  cachedRoute = null;
}

export async function getModelRoute(client?: OpenAI): Promise<ModelRoute> {
  if (!cachedRoute) {
    cachedRoute = discoverModelRoute(client).catch(error => fallbackRoute(error));
  }
  return await cachedRoute;
}

async function discoverModelRoute(client?: OpenAI): Promise<ModelRoute> {
  if (!config.autoDiscoverModels || !config.openaiApiKey) {
    return fallbackRoute();
  }

  const modelClient = client ?? new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl
  });
  const page = await modelClient.models.list();
  const ids = page.data.map(model => model.id).filter(Boolean).sort();
  if (!ids.length) {
    return fallbackRoute(new Error("provider returned no models"));
  }

  const resolved = resolveModelRouteFromIds(ids, {
    model: config.model,
    flashModel: config.flashModel,
    proModel: config.proModel
  });

  return {
    defaultModel: resolved.defaultModel,
    flashModel: resolved.flashModel,
    proModel: resolved.proModel,
    discovered: true,
    availableModels: ids
  };
}

export function resolveModelRouteFromIds(
  ids: string[],
  defaults: { model: string; flashModel: string; proModel: string }
): Pick<ModelRoute, "defaultModel" | "flashModel" | "proModel"> {
  const models = [...ids].filter(Boolean).sort();
  const flashModel = chooseFlashModel(models, defaults.flashModel || defaults.model);
  const proModel = chooseProModel(models, defaults.proModel || defaults.model);
  const defaultModel = models.includes(defaults.model) ? defaults.model : proModel || flashModel || defaults.model;
  return { defaultModel, flashModel, proModel };
}

function fallbackRoute(error?: unknown): ModelRoute {
  return {
    defaultModel: config.model,
    flashModel: config.flashModel || config.model,
    proModel: config.proModel || config.model,
    discovered: false,
    availableModels: [],
    warning: error instanceof Error ? error.message : undefined
  };
}

function chooseFlashModel(models: string[], fallback: string): string {
  return findPreferred(models, [
    /flash/i,
    /lite/i,
    /mini/i,
    /small/i,
    /fast/i,
    /chat/i
  ], fallback);
}

function chooseProModel(models: string[], fallback: string): string {
  return findPreferred(models, [
    /pro/i,
    /reason/i,
    /r1/i,
    /o1/i,
    /o3/i,
    /max/i,
    /large/i,
    /coder/i,
    /chat/i
  ], fallback);
}

function findPreferred(models: string[], patterns: RegExp[], fallback: string): string {
  if (fallback && models.includes(fallback)) return fallback;
  for (const pattern of patterns) {
    const match = models.find(model => pattern.test(model));
    if (match) return match;
  }
  return models[0] ?? fallback;
}
