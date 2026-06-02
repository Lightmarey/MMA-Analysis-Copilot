import assert from "node:assert/strict";
import { WolframBackend } from "../src/wolfram/backend.js";

const backend = new WolframBackend();

try {
  const simplify = await backend.call("wolfram_simplify", {
    expr: "Sin[x]^2 + Cos[x]^2",
    assumptions: "",
    operation: "FullSimplify"
  });
  assert.equal(simplify.ok, true);
  assert.equal(simplify.output, "1");

  const integral = await backend.call("wolfram_integrate", {
    expr: "x^2 Exp[-x]",
    variable: "x",
    lower: "0",
    upper: "Infinity",
    assumptions: ""
  });
  assert.equal(integral.ok, true);
  assert.equal(integral.output, "2");

  const limit = await backend.call("wolfram_limit", {
    expr: "Sin[x]/x",
    variable: "x",
    point: "0",
    direction: "",
    assumptions: ""
  });
  assert.equal(limit.ok, true);
  assert.equal(limit.output, "1");

  const derivative = await backend.call("wolfram_differentiate", {
    expr: "x^3 Sin[x]",
    variable: "x",
    order: 1,
    assumptions: ""
  });
  assert.equal(derivative.ok, true);
  assert.match(derivative.output ?? "", /3\*x\^2\*Sin\[x\]/);

  const algebra = await backend.call("wolfram_algebra", {
    expr: "x^4 - 1",
    operation: "Factor",
    variable: "",
    assumptions: ""
  });
  assert.equal(algebra.ok, true);
  assert.match(algebra.output ?? "", /-1 \+ x/);

  const matrix = await backend.call("wolfram_matrix", {
    matrix: "{{1, 2}, {3, 4}}",
    operation: "Det",
    variable: "",
    assumptions: ""
  });
  assert.equal(matrix.ok, true);
  assert.equal(matrix.output, "-2");

  const series = await backend.call("wolfram_series", {
    expr: "Sin[x]",
    variable: "x",
    point: "0",
    order: 5,
    assumptions: ""
  });
  assert.equal(series.ok, true);
  assert.match(series.output ?? "", /x\^5\/120/);

  const sum = await backend.call("wolfram_sum", {
    expr: "k",
    variable: "k",
    lower: "1",
    upper: "n",
    assumptions: "Element[n, Integers] && n >= 1"
  });
  assert.equal(sum.ok, true);
  assert.match(sum.output ?? "", /n/);
  assert.doesNotMatch(sum.output ?? "", /k\*n/);

  const residue = await backend.call("wolfram_residue", {
    expr: "1/(z - a)",
    variable: "z",
    point: "a",
    assumptions: ""
  });
  assert.equal(residue.ok, true);
  assert.equal(residue.output, "1");

  const transform = await backend.call("wolfram_transform", {
    expr: "Exp[-a t]",
    variable: "t",
    targetVariable: "s",
    transform: "LaplaceTransform",
    assumptions: "a > 0 && s > 0"
  });
  assert.equal(transform.ok, true);
  assert.match(transform.output ?? "", /a \+ s/);

  console.log("wolfram tool tests passed");
} finally {
  backend.close();
}
