import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";

export const equationSolvingToolDefinitions: ToolDefinition[] = [
  defineTool(
  "wolfram_solve",
  "Solve or reduce equations and inequalities using Wolfram Language when the unknown solution set or parameter domain must be derived. Use == for equations. Prefer method Reduce for conditional inequality implication checks, log/exponential rearrangements, and domains with parameters. If a candidate result, before/after expression, or transformation target is already supplied, use wolfram_equivalence_check first instead of solving the original equation from scratch. For a simple proposition or implication already expressed with Implies[...] under assumptions, use wolfram_simplify instead. Provide concrete variables such as x or {x, y}; for a proposition with no variables to solve for, use wolfram_simplify instead of variables={}.",
  {
    equations: { type: "string", description: "Equation, inequality, or list of equations in Wolfram syntax." },
    variables: { type: "string", description: "Variable or list of variables in Wolfram syntax, e.g. x or {x, y}; do not use {}." },
    method: { type: "string", enum: ["Solve", "Reduce", "NSolve", "FindInstance"], description: "Solving method." },
    assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
  }
),
  defineTool(
  "wolfram_dsolve",
  "Solve ordinary differential equations using DSolve, DSolveValue, or NDSolve.",
  {
    equations: { type: "string", description: "Equation or list of equations, e.g. {y'[x] == y[x], y[0] == 1}." },
    functions: { type: "string", description: "Dependent function or list, e.g. y or {x, y}." },
    variable: { type: "string", description: "Independent variable." },
    method: { type: "string", enum: ["DSolve", "DSolveValue", "NDSolve"], description: "Differential equation solver." },
    assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
  }
)
];
