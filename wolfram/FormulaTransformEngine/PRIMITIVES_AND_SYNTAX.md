# FormulaTransformEngine Primitives & Syntax

To ensure compatibility with future formal systems (like Lean 4 / Mathlib, Coq, and SageMath), the `FormulaTransformEngine` uses a standardized, strongly-typed Intermediate Representation (IR) for mathematical templates.

This document describes the allowed primitives, our design philosophy (borrowed from formal theorem proving), and the syntax conventions used when defining JSON templates.

## 1. Design Philosophy

### 1.1 Typeclass-like Properties over Rigid Sets
Inspired by Lean's Mathlib, we separate algebraic operators from topological and measure-theoretic properties. Instead of defining a custom "IntegralOverLpSpace", we use a generic `Integral[f, domain]` and impose formal properties via the `conditions` list (e.g., `FunctionSpace[f, Lp[p], domain]`, `Measurable[f, domain]`).

### 1.2 Separation of Spaces and Norms
Spaces (like $L^p$ or $W^{k,p}$) are treated as abstract structures, while `Norm` acts as a generic operator. 
For example, to represent $\| f \|_{L^p(\Omega)}$, we use:
`Norm[f, FunctionSpace[Lp[p], domain]]`
This cleanly separates the element $f$, the abstract norm operator, and the topology space parameterizing the norm.

### 1.3 Inactive Computation
Because Wolfram Language aggressively auto-evaluates mathematical expressions, templates must be wrapped in `Inactive` forms or use our bespoke capitalization (e.g., `Integral` instead of `Integrate`) to prevent the engine from collapsing templates before they are matched.

## 2. Allowed Primitives (The Copilot IR)

When writing `matchers`, `rewrite`, or `targetTemplate` in the JSON DSL, you **must** use the following whitelisted primitives. Unrecognized primitives will be rejected by the compiler.

### 2.1 Core Calculus & Algebra
- `Integral[body, domain]`: Represents a Lebesgue or Riemann integral over a specific `domain`.
- `Sum[body, domain]`: Discrete summation over an index set or range `domain`.
- `Product[body, domain]`: Discrete product.
- `D[f, x]`: Partial or weak derivative of $f$ with respect to $x$.
- `Grad[f]`, `Gradient[f]`: The gradient operator $\nabla f$.
- `Abs[x]`: Absolute value $|x|$.
- `Power[x, p]`: Exponentiation $x^p$.
- `Sqrt[x]`: Square root $\sqrt{x}$.

### 2.2 Functional Analysis & Norms
- `Norm[f, space]`: The norm of $f$ in the specified `space`. 
  - *Example*: `Norm[f, FunctionSpace[Lp[p], domain]]`
- `FunctionSpace[type, domain]`: Represents a function space over a domain.
- `Lp[p]`: The $L^p$ space type, parameterized by $p$.
- `Lq[q]`: Conventionally used for the conjugate exponent $q$.
- `L2`: Shorthand for the Hilbert space $L^2$.
- `W[k, p]`: Sobolev space $W^{k,p}$.

### 2.3 Assertions & Conditions (Predicates)
These primitives are primarily used in the `conditions` array of a rule to specify proof obligations.
- `Regularity[f, space]`: Asserts $f \in \text{space}$.
- `RealValued[f]`: Asserts $f$ maps to $\mathbb{R}$.
- `Nonnegative[f]`: Asserts $f \ge 0$ almost everywhere.
- `ZeroMean[f, domain]`: Asserts $\int_{\text{domain}} f = 0$.
- `BoundaryTrace[f, boundary]`: The trace operator.
- `BoundedLipschitzDomain[domain]`: Asserts the domain is regular enough for Sobolev embeddings and Stokes' theorem.
- `Measurable[f, domain]`, `MeasurableIntegrable[f, domain]`: Measure-theoretic prerequisites.
- `RegularEnoughForIBP[f, g, domain]`: A high-level heuristic assertion discharging the prerequisites for Integration by Parts.

### 2.4 Internal Planner & Heuristic Constants
- `YoungConstant[p, q, epsilon]`: Represents the constant $C(\varepsilon)$ generated during Young's inequality with $\varepsilon$.
- `BoundaryTerm[f, g, domain]`: Represents the generic integrated boundary term in Green's identities or IBP.
- `IBPIntegral[f, g, domain]`: Represents the residual integral after applying IBP.
- `NormalizeQuotient[a, b]`: Internal struct representing $a/b$.
- `NormalizationFactorNonzero[x]`: Obligation asserting a denominator is non-zero.
- `Inactive[...]*`: A wrapper used to bypass aggressive Wolfram evaluation.

## 3. Template Usage Examples

**Example 1: Matching an $L^p$ Norm**
```json
{
  "pattern": "Norm[$f, FunctionSpace[Lp[$p], $domain]]"
}
```

**Example 2: Integration by Parts (Green's First Identity)**
Instead of hardcoding Euclidean geometry, the LHS relies on `Integral` and `Grad`.
```json
{
  "lhs": "Integral[Inactive[Times][Grad[$u], Grad[$v]], $domain]",
  "rhs": "Inactive[Plus][BoundaryTerm[$u, $v, $domain], Inactive[Times][-1, Integral[Inactive[Times][$u, Laplacian[$v]], $domain]]]"
}
```

By strictly adhering to these primitives, the Math Copilot can seamlessly export these rule JSONs to Lean 4, mapping our `Integral` to `measure_theory.integral` and `Norm` to `norm`.
