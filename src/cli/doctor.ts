import chalk from "chalk";
import { config } from "../config.js";
import { findDefaultWolframCommand } from "../wolfram/backend.js";
import { getModelRoute } from "../agent/model-routing.js";

export async function runDoctor(): Promise<void> {
  const command = findDefaultWolframCommand();
  console.log(`${chalk.bold("Root:")} ${config.rootDir}`);
  console.log(`${chalk.bold("Config:")} ${config.configPath} (${config.configFileLoaded ? "loaded" : "not found"})`);
  if (config.configDiagnostics.length) {
    console.log(`${chalk.bold("Config diagnostics:")}`);
    for (const diagnostic of config.configDiagnostics) {
      console.log(`- ${diagnostic.level}: ${diagnostic.message}`);
    }
  }
  console.log(`${chalk.bold("Protocol:")} ${config.wolframProtocolPath}`);
  console.log(`${chalk.bold("Worker:")} unsupported in this release`);
  console.log(`${chalk.bold("Wolfram command:")} ${command || "(not found)"}`);
  console.log(`${chalk.bold("Wolfram backend mode:")} ${config.wolframBackendMode}`);
  console.log(`${chalk.bold("Model:")} ${config.model}`);
  console.log(`${chalk.bold("Auto route:")} ${config.autoRoute ? "enabled" : "disabled"}`);
  console.log(`${chalk.bold("Flash model:")} ${config.flashModel}`);
  console.log(`${chalk.bold("Pro model:")} ${config.proModel}`);
  console.log(`${chalk.bold("Model discovery:")} ${config.autoDiscoverModels ? "enabled" : "disabled"}`);
  if (config.openaiApiKey && config.autoDiscoverModels) {
    const route = await getModelRoute();
    console.log(`${chalk.bold("Discovered models:")} ${route.discovered ? route.availableModels.join(", ") : `failed (${route.warning ?? "unknown"})`}`);
    console.log(`${chalk.bold("Resolved flash model:")} ${route.flashModel}`);
    console.log(`${chalk.bold("Resolved pro model:")} ${route.proModel}`);
  }
  console.log(`${chalk.bold("Preplanning:")} ${config.preplanEnabled ? "enabled" : "disabled"}`);
  console.log(`${chalk.bold("LLM planning:")} ${config.llmPlanningEnabled ? "enabled" : "disabled"}`);
  console.log(`${chalk.bold("Hooks:")} mode=${config.hookMode}, beforeFinal=${config.hookBeforeFinal}, promptMaxChars=${config.hookPromptMaxChars}`);
  console.log(`${chalk.bold("Max iterations:")} ${config.maxIterations}`);
  console.log(`${chalk.bold("Temperature:")} ${config.temperature}`);
  console.log(`${chalk.bold("OpenAI API key:")} ${config.openaiApiKey ? "set" : "missing"}`);
  console.log(`${chalk.bold("OpenAI base URL:")} ${config.openaiBaseUrl ?? "(default)"}`);
}
