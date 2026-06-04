import type { TraceMode } from "./report.js";

export type ThinkingMode = "off" | "brief" | "full";

export type CliOptions = {
  output?: string;
  file?: string;
  batch?: string;
  batchStart?: number;
  batchCount?: number;
  trace?: boolean | TraceMode;
  directWolfram?: boolean;
  temperature?: number;
  maxIterations?: number;
  thinking?: ThinkingMode;
};

