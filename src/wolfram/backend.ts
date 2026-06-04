import { spawn } from "node:child_process";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { WolframRequest, WolframResponse, WolframToolName } from "./types.js";

const WINDOWS_WOLFRAM_SCRIPT = [
  "C:\\Program Files\\Wolfram Research\\WolframScript\\wolframscript.exe",
  "C:\\Program Files\\Wolfram Research\\Wolfram\\14.3\\wolframscript.exe",
  "C:\\Program Files\\Wolfram Research\\Wolfram\\14.3\\SystemFiles\\Kernel\\Binaries\\Windows-x86-64\\wolframscript.exe"
];

const WINDOWS_WOLFRAM_KERNEL = [
  "C:\\Program Files\\Wolfram Research\\Wolfram\\14.3\\WolframKernel.exe",
  "C:\\Program Files\\Wolfram Research\\Wolfram\\14.3\\SystemFiles\\Kernel\\Binaries\\Windows-x86-64\\WolframKernel.exe"
];

export class WolframBackend {
  constructor(
    private readonly command = config.wolframCommand || findDefaultWolframCommand()
  ) {}

  get commandPath(): string {
    return this.command;
  }

  async call(tool: WolframToolName, args: Record<string, unknown>, timeoutMs = config.wolframWorkerTimeoutMs): Promise<WolframResponse> {
    if (config.wolframBackendMode === "worker") {
      throw new Error("WOLFRAM_BACKEND_MODE=worker is not supported in this release. Use the default oneshot backend.");
    }
    if (config.wolframBackendMode !== "oneshot") {
      throw new Error(`Unsupported Wolfram backend mode '${config.wolframBackendMode}'. Use 'oneshot'.`);
    }
    return await this.callOneshot(tool, args, timeoutMs);
  }

  private async callOneshot(tool: WolframToolName, args: Record<string, unknown>, timeoutMs: number): Promise<WolframResponse> {
    const id = randomUUID();
    const request: WolframRequest = { id, tool, args, timeoutMs };
    const protocolPath = config.wolframProtocolPath.replaceAll("\\", "/");
    const code = [
      `Get[${JSON.stringify(protocolPath)}]`,
      `ExportString[WMAHandleRequest[ImportString[${JSON.stringify(JSON.stringify(request))}, "RawJSON"]], "RawJSON", "Compact" -> True]`
    ].join("; ");

    const command = this.command || findDefaultWolframCommand();
    return await new Promise<WolframResponse>((resolve, reject) => {
      const child = spawn(command, ["-code", code], {
        cwd: config.rootDir,
        stdio: "pipe",
        windowsHide: true
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Wolfram request timed out after ${timeoutMs}ms`));
      }, timeoutMs + 1000);

      child.stdout.on("data", chunk => {
        stdout += String(chunk);
      });
      child.stderr.on("data", chunk => {
        stderr += String(chunk);
      });
      child.on("error", error => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("exit", codeValue => {
        clearTimeout(timer);
        if (codeValue !== 0 && !stdout.trim()) {
          reject(new Error(stderr.trim() || `Wolfram exited with code ${codeValue}`));
          return;
        }
        try {
          resolve(JSON.parse(extractJsonObject(stdout.trim())) as WolframResponse);
        } catch {
          reject(new Error(`Could not parse Wolfram output: ${stdout.trim() || stderr.trim()}`));
        }
      });
    });
  }

  close(): void {}
}

function extractJsonObject(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("{") && trimmed.includes("\"ok\"")) return trimmed;
  const responseStart = trimmed.lastIndexOf("{\"id\"");
  if (responseStart >= 0) {
    return trimmed.slice(responseStart);
  }
  const prettyResponseStart = trimmed.lastIndexOf("{\n  \"id\"");
  if (prettyResponseStart >= 0) {
    return trimmed.slice(prettyResponseStart);
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

export function findDefaultWolframCommand(): string {
  const explicit = config.wolframCommand;
  if (explicit) return explicit;

  if (process.platform === "win32") {
    for (const candidate of [...WINDOWS_WOLFRAM_SCRIPT, ...WINDOWS_WOLFRAM_KERNEL]) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "wolframscript";
}
