import { config } from "../config.js";

export type RuntimeOptions = {
  temperature?: number;
  maxIterations?: number;
};

export function applyRuntimeOptions(options: RuntimeOptions): void {
  if (options.temperature !== undefined) {
    if (!Number.isFinite(options.temperature) || options.temperature < 0 || options.temperature > 2) {
      throw new Error("--temperature must be a number between 0 and 2");
    }
    config.temperature = options.temperature;
  }

  if (options.maxIterations !== undefined) {
    if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1) {
      throw new Error("--max-iterations must be a positive integer");
    }
    config.maxIterations = options.maxIterations;
  }
}
