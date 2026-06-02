export type WolframToolName =
  | "wolfram_eval"
  | "wolfram_simplify"
  | "wolfram_integrate"
  | "wolfram_limit"
  | "wolfram_solve";

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
  error?: string;
  messages?: string[];
  elapsedMs?: number;
};
