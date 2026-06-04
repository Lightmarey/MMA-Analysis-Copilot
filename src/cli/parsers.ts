import type { ThinkingMode } from "./types.js";
import type { TraceMode } from "./report.js";

export function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Expected a positive integer");
  }
  return parsed;
}

export function parseTraceMode(value: boolean | TraceMode | undefined): TraceMode | null {
  if (value === undefined || value === false) return null;
  if (value === true) return "compact";
  const normalized = value.trim().toLowerCase();
  if (normalized === "compact" || normalized === "full") return normalized;
  throw new Error("--trace must be compact or full");
}

export function parseThinkingMode(value: string): ThinkingMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === "off" || normalized === "brief" || normalized === "full") return normalized;
  throw new Error("--thinking must be off, brief, or full");
}

