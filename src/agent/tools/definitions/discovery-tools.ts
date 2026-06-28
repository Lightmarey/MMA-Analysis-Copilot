import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";

export const discoveryToolDefinitions: ToolDefinition[] = [
  defineTool(
    "load_tool",
    "Dynamically load specialized tools into your available context mid-execution (e.g. formula_transform, wolfram_dsolve). Use this when you need a mathematical engine or domain-specific capability that is not currently listed in your tools.",
    {
      tool_names: { type: "string", description: "Comma-separated list of tool names to load (e.g., 'formula_transform, wolfram_dsolve')" }
    }
  )
];