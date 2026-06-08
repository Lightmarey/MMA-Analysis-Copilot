import { theoremAdvisorTool } from "../planning/theorem-advisor.js";
import type { WolframResponse } from "../../wolfram/types.js";
import type { LocalToolName } from "./names.js";

export function runLocalTool(name: LocalToolName, args: Record<string, unknown>): WolframResponse {
  if (name === "theorem_advisor") {
    return theoremAdvisorTool(args);
  }
  return {
    id: null,
    ok: false,
    title: name,
    error: `Unknown local tool: ${name}`
  };
}
