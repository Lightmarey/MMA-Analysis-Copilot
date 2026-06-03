import { analyzeProblem, buildPreplanContext, classifyDifficulty, createPreplan, decomposeProblem } from "../agent/planning.js";
import { config } from "../config.js";

export type PlanPreview = {
  difficulty: "simple" | "complex";
  model: string;
  context: string;
  analysis: ReturnType<typeof analyzeProblem>;
  preplan: ReturnType<typeof createPreplan>;
  decomposition: ReturnType<typeof decomposeProblem>;
};

export function createPlanPreview(question: string): PlanPreview {
  const analysis = analyzeProblem(question);
  const preplan = createPreplan(question, analysis);
  const decomposition = decomposeProblem(question, analysis);
  const difficulty = classifyDifficulty(question, analysis);
  const model = config.autoRoute
    ? difficulty === "simple"
      ? config.flashModel
      : config.proModel
    : config.model;
  return {
    difficulty,
    model,
    context: buildPreplanContext(analysis, preplan, decomposition),
    analysis,
    preplan,
    decomposition
  };
}

export function formatPlanPreview(question: string, preview = createPlanPreview(question)): string {
  const lines = [
    "# Wolfram Math Agent Plan Preview",
    "",
    "## Question",
    "",
    question,
    "",
    "## Route",
    "",
    `- Difficulty: ${preview.difficulty}`,
    `- Model: ${preview.model}`,
    "",
    "## Analysis",
    "",
    fenced(JSON.stringify(preview.analysis, null, 2), "json"),
    "",
    "## Preplan",
    "",
    fenced(JSON.stringify(preview.preplan, null, 2), "json"),
    "",
    "## Decomposition",
    "",
    preview.decomposition ? fenced(JSON.stringify(preview.decomposition, null, 2), "json") : "Not needed.",
    "",
    "## Injected Context",
    "",
    fenced(preview.context, "text"),
    ""
  ];
  return lines.join("\n");
}

function fenced(content: string, language: string): string {
  return `\`\`\`${language}\n${content.trim()}\n\`\`\``;
}
