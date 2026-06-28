import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";

export const proofToolDefinitions: ToolDefinition[] = [
  defineTool(
  "formula_transform",
  "Deterministically transform a supplied mathematical formula using the Wolfram FormulaTransformEngine.",
  {
    action: { type: "string", enum: ["apply", "plan_parts", "plan_apply", "compile_rule", "compile_heuristic", "compile_seed", "compile_planner", "compile_structural", "compile_discharger", "inspect_registry", "reload_registry", "get_obligations", "discharge_obligation"], description: "Formula-transform action." },
    formula: { type: "string", description: "Formula in Wolfram InputForm syntax." },
    rule: { type: "string", description: "Transform rule." },
    direction: { type: "string", enum: ["Upper", "Lower", "TwoSided", "Equal", "Auto"], description: "Requested orientation." },
    part: { type: "string", description: "Target part selector." },
    parameters: { type: "string", description: "Rule parameters as JSON." },
    assumptions: { type: "string", description: "Wolfram assumptions." },
    context: { type: "string", description: "Optional JSON or plain text analytic context." },
    state: { type: "string", description: "Prior FormulaTransformState." },
    payload: { type: "string", description: "JSON payload for compilation." }
  }
)
];
