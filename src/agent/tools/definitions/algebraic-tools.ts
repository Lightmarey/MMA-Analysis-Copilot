import type { ToolDefinition } from "../names.js";
import { defineTool } from "./define-tool.js";

export const algebraicToolDefinitions: ToolDefinition[] = [
  defineTool(
  "wolfram_eval",
  "Evaluate Wolfram Language code. Use only as an advanced escape hatch when structured tools are not enough. Do not use this for simple Simplify/FullSimplify/Refine/Equivalent checks; use wolfram_simplify. Do not use this for Solve/Reduce checks; use wolfram_solve. Do not use this tool to read local files, import documents, or parse prose/LaTeX source; use only the mathematical expressions already supplied in the prompt.",
  {
    code: {
      type: "string",
      description: "Wolfram Language code in InputForm syntax. The final expression is returned."
    }
  }
),
  defineTool(
  "wolfram_simplify",
  "Simplify, refine, or power-expand an explicit Wolfram Language expression under stated assumptions. Use this for algebraic, analytic, asymptotic, sign, monotonicity, and conditional expression simplification when the expression and assumptions are already chosen. Use this, not wolfram_algebra, for plain Simplify/FullSimplify/Refine. For several small identities with the same assumptions, pass a Wolfram list such as {id1, id2, id3} in expr and simplify them together. If this list ledger returns True entries for the requested checks, stop and summarize instead of making confirmatory Reduce calls. Compact derivative identities may put D[...] directly in expr and simplify the combined expression; when substituting after differentiation, write (D[expr, r] /. r -> 1), including each repeated derivative inside a list entry. For scale-ordered power inequalities, a dimensionless substitution can make the check stable; if a normalized power bound does not close directly, verify the exponent-domain sign condition and stop retrying the same bare power inequality. To verify a conclusion under hypotheses, place the hypotheses in assumptions and simplify/refine the conclusion directly before proving a bare Implies. For inequality equivalence, implication, or logarithmic rearrangement under domain conditions, prefer wolfram_solve with method Reduce. For mathematical equation equivalence or swapped equation sides, simplify Equivalent[...] rather than SameQ/=== unless syntax identity is the actual target. Do not use it to choose proof rules, formula transformations, parameter choices, or side-condition ledgers; use proof_pattern_engine for transform selection and side-condition tracking.",
  {
    expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax. A list such as {id1, id2, id3} is appropriate for a short verification ledger with shared assumptions. For several inequalities under the same hypotheses, put hypotheses in assumptions and pass expr={ineq1, ineq2}; do not wrap a list conclusion as Implies[..., {...}]. Use camelCase/plain symbols, not underscores, because underscore is Wolfram pattern syntax. Do not include Assumptions -> here; use the assumptions field." },
    assumptions: { type: "string", description: "Wolfram assumptions, e.g. x > 0 && Element[n, Integers], or empty string. Put hypotheses here when checking whether a conclusion follows." },
    operation: { type: "string", enum: ["Simplify", "FullSimplify", "Refine", "PowerExpand"], description: "Simplification operation." }
  }
),
  defineTool(
  "wolfram_equivalence_check",
  "Verify whether two already chosen Wolfram Language expressions are equivalent under stated assumptions. Use this when the task is to check that a supplied transformation, substitution result, rearrangement, or before/after expression is consistent. It does not choose formulas, proof moves, side conditions, or case splits.",
  {
    lhs: { type: "string", description: "Left expression in Wolfram Language InputForm syntax. Do not include assumptions here." },
    rhs: { type: "string", description: "Right expression in Wolfram Language InputForm syntax. Do not include assumptions here." },
    assumptions: { type: "string", description: "Wolfram assumptions, or empty string." },
    mode: { type: "string", enum: ["auto", "difference_zero", "equivalent", "reduce_equivalence"], description: "Equivalence strategy. Use auto for the default combined check; difference_zero for lhs-rhs simplification; equivalent for Equivalent[lhs,rhs]; reduce_equivalence for Reduce-based logical equivalence." }
  }
),
  defineTool(
  "wolfram_algebra",
  "Perform named algebraic expression transformations: Expand, Factor, Apart, Together, Cancel, and Collect. For Simplify, FullSimplify, Refine, or PowerExpand, use wolfram_simplify instead.",
  {
    expr: { type: "string", description: "Expression in Wolfram Language InputForm syntax." },
    operation: { type: "string", enum: ["Expand", "Factor", "Apart", "Together", "Cancel", "Collect"], description: "Algebraic operation." },
    variable: { type: "string", description: "Optional variable for Collect, or empty string." },
    assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
  }
),
  defineTool(
  "wolfram_matrix",
  "Compute matrix determinant, inverse, eigenvalues/eigensystem, characteristic polynomial, row reduction, rank, or trace.",
  {
    matrix: { type: "string", description: "Matrix in Wolfram list syntax, e.g. {{1,2},{3,4}}." },
    operation: { type: "string", enum: ["Det", "Inverse", "Eigenvalues", "Eigensystem", "CharacteristicPolynomial", "RowReduce", "MatrixRank", "Tr"], description: "Matrix operation." },
    variable: { type: "string", description: "Variable for CharacteristicPolynomial, or empty string." },
    assumptions: { type: "string", description: "Wolfram assumptions, or empty string." }
  }
)
];
