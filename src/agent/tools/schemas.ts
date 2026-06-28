import type { AgentToolName, ToolDefinition } from "./names.js";
import { algebraicToolDefinitions } from "./definitions/algebraic-tools.js";
import { calculusToolDefinitions } from "./definitions/calculus-tools.js";
import { equationSolvingToolDefinitions } from "./definitions/equation-solving-tools.js";
import { localToolDefinitions } from "./definitions/local-tools.js";
import { proofToolDefinitions } from "./definitions/proof-tools.js";
import { transformConvergenceToolDefinitions } from "./definitions/transform-convergence-tools.js";
import { discoveryToolDefinitions } from "./definitions/discovery-tools.js";

const groupedToolDefinitions = [
  ...proofToolDefinitions,
  ...localToolDefinitions,
  ...algebraicToolDefinitions,
  ...calculusToolDefinitions,
  ...equationSolvingToolDefinitions,
  ...transformConvergenceToolDefinitions
];

const toolDefinitionOrder = [
  "formula_transform",
  "theorem_advisor",
  "verification_template",
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
  "wolfram_sum",
  "series_coefficient_check",
  "wolfram_convergence",
  "wolfram_dsolve",
  "wolfram_transform",
  "wolfram_residue"
] as const satisfies readonly AgentToolName[];

export const toolDefinitions: ToolDefinition[] = toolDefinitionOrder.map(toolName => {
  const definition = groupedToolDefinitions.find(tool => tool.name === toolName);
  if (!definition) throw new Error(`Missing tool definition: ${toolName}`);
  return definition;
});
