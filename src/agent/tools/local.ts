import OpenAI from "openai";
import { theoremAdvisorTool } from "../planning/theorem-advisor.js";
import type { WolframResponse } from "../../wolfram/types.js";
import type { AgentToolName, LocalToolName } from "./names.js";
import { toolDefinitions } from "./schemas.js";

export type LocalToolContext = {
  activeToolNames: Set<AgentToolName>;
  blockedToolNames?: Set<AgentToolName>;
  delegateToSubagent?: (args: Record<string, unknown>) => Promise<WolframResponse>;
};

const knownToolNames = new Set<AgentToolName>(toolDefinitions.map(tool => tool.name));

export async function runLocalTool(
  client: OpenAI,
  name: LocalToolName,
  args: Record<string, unknown>,
  context?: LocalToolContext
): Promise<WolframResponse> {
  if (name === "load_tool") {
    return runLoadTool(args, context);
  }
  if (name === "delegate_to_subagent") {
    if (!context?.delegateToSubagent) {
      return {
        id: null,
        ok: false,
        title: name,
        error: "delegate_to_subagent is disabled in this context"
      };
    }
    return context.delegateToSubagent(args);
  }
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

function runLoadTool(args: Record<string, unknown>, context?: LocalToolContext): WolframResponse {
  const requested = parseToolNames(args.tool_names);
  const loaded: string[] = [];
  const skipped: string[] = [];

  for (const toolName of requested) {
    if (!knownToolNames.has(toolName as AgentToolName)) {
      skipped.push(`${toolName} (unknown)`);
      continue;
    }
    if (context?.blockedToolNames?.has(toolName as AgentToolName)) {
      skipped.push(`${toolName} (disabled)`);
      continue;
    }
    context?.activeToolNames.add(toolName as AgentToolName);
    loaded.push(toolName);
  }

  return {
    id: null,
    ok: skipped.length === 0,
    title: "load_tool",
    output: [
      `Loaded tools: ${loaded.length ? loaded.join(", ") : "none"}`,
      skipped.length ? `Skipped tools: ${skipped.join(", ")}` : ""
    ].filter(Boolean).join("; ")
  };
}

function parseToolNames(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  return [...new Set(values
    .map(value => typeof value === "string" ? value.trim() : "")
    .filter(Boolean))];
}
