import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { WolframToolName } from "../../wolfram/types.js";

export type LocalToolName = "theorem_advisor" | "verification_template" | "load_tool";
export type AgentToolName = WolframToolName | LocalToolName;

export type ToolDefinition = {
  name: AgentToolName;
  description: string;
  schema: ChatCompletionTool;
};

export type ToolProperty = {
  type: "string" | "integer";
  description: string;
  enum?: string[];
};

export const publicWolframToolNames = [
  "formula_transform",
  "wolfram_eval",
  "wolfram_simplify",
  "wolfram_equivalence_check",
  "wolfram_integrate",
  "wolfram_differentiate",
  "wolfram_limit",
  "wolfram_solve",
  "wolfram_algebra",
  "wolfram_matrix",
  "wolfram_series",
  "series_coefficient_check",
  "wolfram_sum",
  "wolfram_convergence",
  "wolfram_dsolve",
  "wolfram_transform",
  "wolfram_residue"
] as const satisfies readonly WolframToolName[];

export const compatWolframToolNames = [
] as const satisfies readonly WolframToolName[];

export const localToolNames = [
  "theorem_advisor",
  "verification_template"
] as const satisfies readonly LocalToolName[];

export const publicAgentToolNames = [
  ...publicWolframToolNames,
  ...localToolNames
] as const satisfies readonly AgentToolName[];

const wolframToolNames = new Set<string>([
  ...publicWolframToolNames,
  ...compatWolframToolNames
]);

export function isWolframToolName(name: string): name is WolframToolName {
  return wolframToolNames.has(name);
}
