import OpenAI from "openai";
import { analyzeProblem } from "./analysis.js";

export async function theoremAdvisorTool(client: OpenAI, args: Record<string, unknown>) {
  const problem = typeof args.problem === "string" ? args.problem : "";
  const detectedObjects = typeof args.detected_objects === "string"
    ? args.detected_objects
    : typeof args.detectedObjects === "string"
      ? args.detectedObjects
      : "";
  const analysis = await analyzeProblem(client, problem, detectedObjects);
  return {
    id: null,
    ok: true,
    title: "Theorem advisor",
    output: JSON.stringify(analysis, null, 2),
    elapsedMs: 0
  };
}
