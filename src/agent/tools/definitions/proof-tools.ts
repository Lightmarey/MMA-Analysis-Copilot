import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";

export const proofToolDefinitions: ToolDefinition[] = [
  defineTool(
  "proof_pattern_engine",
  "Plan and record formula-level proof transformations before doing explicit computation. Use this when the next step is to choose, normalize, apply, compile, or audit a proof move rather than simplify a chosen expression. When the problem already supplies a proposed transformation, prefer compile to create a traceable intent ledger of the move family, transform kinds, and generic condition kinds instead of waiting for a registered pattern to match. Use register only when the user explicitly asks to add a reusable transform to the engine, not during ordinary problem solving. It returns transformation candidates, side-condition status, missing assumptions, and proof-state traces. It is not a whole-paper verifier and does not replace explicit Wolfram checks of the resulting formulas.",
  {
    operation: { type: "string", enum: ["normalize", "suggest", "apply", "trace", "registry", "parameter", "compile", "register"], description: "Requested proof-transform action: prepare a state, ask for candidate moves, apply a move, inspect a trace, inspect available move families, choose a parameter condition, compile a supplied proof move into a ledger, or register a reusable transform only when explicitly asked to persist one." },
    goal: { type: "string", description: "Current formula, estimate, or proof target in Wolfram InputForm syntax; empty when state already contains the target." },
    known: { type: "string", description: "Known formulas, hypotheses, or previously verified consequences in Wolfram InputForm syntax, usually a list, or empty." },
    context: { type: "string", description: "Proof context in Wolfram InputForm syntax, preferably an Association describing domain, assumptions, admissible transformations, boundary data, parameters, and side conditions." },
    state: { type: "string", description: "Existing proof-state Association in Wolfram InputForm syntax, or empty to create one from goal/context/known." },
    moveId: { type: "string", description: "Candidate move identifier returned by suggest, or empty to apply the first suitable candidate." },
    ruleName: { type: "string", description: "Optional abstract transform family name for focused operations, or empty." },
    payload: { type: "string", description: "Auxiliary proof-transform data as a Wolfram Association in InputForm using <|key -> value|> syntax. Do not use JSON, XML-like wrappers, or <Association[...]> syntax. For compile, provide only intent-level fields such as RuleIntent, TransformIntents, ConditionIntents, and MissingConditionIntents. Do not include concrete formulas, parameter values, private example structure, or problem-specific side-condition text in the compile schema." }
  }
)
];
