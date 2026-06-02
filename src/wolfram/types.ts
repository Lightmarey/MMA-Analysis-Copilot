export type WolframToolName =
  | "wolfram_eval"
  | "wolfram_simplify"
  | "wolfram_integrate"
  | "wolfram_differentiate"
  | "wolfram_limit"
  | "wolfram_solve"
  | "wolfram_algebra"
  | "wolfram_matrix"
  | "wolfram_series"
  | "wolfram_sum"
  | "wolfram_dsolve"
  | "wolfram_transform"
  | "wolfram_residue";

export type WolframRequest = {
  id: string;
  tool: WolframToolName;
  args: Record<string, unknown>;
  timeoutMs?: number;
};

export type WolframResponse = {
  id: string | null;
  ok: boolean;
  title?: string;
  output?: string;
  latex?: string;
  conditions?: string;
  conditionLatex?: string;
  rawOutput?: string;
  rawLatex?: string;
  error?: string;
  messages?: string[];
  elapsedMs?: number;
};
