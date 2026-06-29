import OpenAI from "openai";
import { theoremAdvisorTool } from "../planning/theorem-advisor.js";
import type { WolframResponse } from "../../wolfram/types.js";
import type { LocalToolName } from "./names.js";

export async function runLocalTool(client: OpenAI, name: LocalToolName, args: Record<string, unknown>): Promise<WolframResponse> {
  if (name === "theorem_advisor") {
    return theoremAdvisorTool(client, args);
  }
  return {
    id: null,
    ok: false,
    title: name,
    error: `Unknown local tool: ${name}`
  };
}
