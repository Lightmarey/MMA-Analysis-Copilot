import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";

export const discoveryToolDefinitions: ToolDefinition[] = [
  defineTool(
    "load_tool",
    "Dynamically load specialized tools into your available context mid-execution. Use this when you need a capability not currently listed in your tools. Available tools to load: wolfram_integrate, wolfram_differentiate, wolfram_limit, wolfram_algebra, wolfram_matrix, wolfram_series, series_coefficient_check, wolfram_sum, wolfram_convergence, wolfram_dsolve, wolfram_transform, wolfram_residue.",
    {
      tool_names: { type: "string", description: "Comma-separated list of tool names to load (e.g., 'formula_transform, wolfram_dsolve')" }
    }
  )
];