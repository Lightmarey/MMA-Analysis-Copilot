import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { WolframRequest, WolframResponse, WolframToolName } from "./types.js";

type Pending = {
  resolve: (value: WolframResponse) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

const WINDOWS_WOLFRAM_SCRIPT = [
  "C:\\Program Files\\Wolfram Research\\WolframScript\\wolframscript.exe",
  "C:\\Program Files\\Wolfram Research\\Wolfram\\14.3\\wolframscript.exe",
  "C:\\Program Files\\Wolfram Research\\Wolfram\\14.3\\SystemFiles\\Kernel\\Binaries\\Windows-x86-64\\wolframscript.exe"
];

const WINDOWS_WOLFRAM_KERNEL = [
  "C:\\Program Files\\Wolfram Research\\Wolfram\\14.3\\WolframKernel.exe",
  "C:\\Program Files\\Wolfram Research\\Wolfram\\14.3\\SystemFiles\\Kernel\\Binaries\\Windows-x86-64\\WolframKernel.exe"
];

const READY_ID = "__worker_ready__";

export class WolframBackend {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, Pending>();
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((reason: Error) => void) | null = null;

  constructor(
    private readonly workerPath = config.wolframWorkerPath,
    private readonly command = config.wolframCommand || findDefaultWolframCommand()
  ) {}

  get commandPath(): string {
    return this.command;
  }

  async call(tool: WolframToolName, args: Record<string, unknown>, timeoutMs = config.wolframWorkerTimeoutMs): Promise<WolframResponse> {
    if (config.wolframBackendMode !== "worker") {
      return await this.callOneshot(tool, args, timeoutMs);
    }

    await this.ensureStarted();
    const child = this.child;
    if (!child) throw new Error("Wolfram worker is not running");

    const id = randomUUID();
    const request: WolframRequest = { id, tool, args, timeoutMs };
    const payload = JSON.stringify(request) + "\n";

    return await new Promise<WolframResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.restart();
        reject(new Error(`Wolfram request timed out after ${timeoutMs}ms`));
      }, timeoutMs + 1000);

      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(payload, "utf8", error => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
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

  async ensureStarted(): Promise<void> {
    if (this.child && !this.child.killed) return;
    if (!this.command) {
      throw new Error("No Wolfram command found. Set WOLFRAM_COMMAND.");
    }
    if (!fs.existsSync(this.workerPath)) {
      throw new Error(`Wolfram worker not found: ${this.workerPath}`);
    }

    const args = workerArgs(this.command, this.workerPath);
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.child = spawn(this.command, args, {
      cwd: config.rootDir,
      stdio: "pipe",
      windowsHide: true
    });
    this.stdoutBuffer = "";
    this.stderrBuffer = "";

    this.child.stdout.on("data", chunk => this.handleStdout(String(chunk)));
    this.child.stderr.on("data", chunk => {
      const text = String(chunk);
      this.stderrBuffer += text;
      if (process.env.WOLFRAM_DEBUG_STDIO === "1") {
        process.stderr.write(text);
      }
      if (this.stderrBuffer.length > 20_000) {
        this.stderrBuffer = this.stderrBuffer.slice(-20_000);
      }
    });
    this.child.on("exit", (code, signal) => {
      const message = `Wolfram worker exited with code=${code ?? "null"} signal=${signal ?? "null"}`;
      this.readyReject?.(new Error(`${message}${this.stderrBuffer ? `\n${this.stderrBuffer}` : ""}`));
      this.readyPromise = null;
      this.readyResolve = null;
      this.readyReject = null;
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`${message}${this.stderrBuffer ? `\n${this.stderrBuffer}` : ""}`));
        this.pending.delete(id);
      }
      this.child = null;
    });

    if (shouldBootstrapFromStdin(this.command)) {
      const source = fs.readFileSync(this.workerPath, "utf8");
      this.child.stdin.write(`Global\`$WMAStdin = $Input; ToExpression[${JSON.stringify(source)}]\n`, "utf8");
    }

    await this.waitForReady();
  }

  close(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Wolfram backend closed"));
      this.pending.delete(id);
    }
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
  }

  private restart(): void {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
  }

  private handleStdout(text: string): void {
    this.stdoutBuffer += text;
    while (true) {
      const idx = this.stdoutBuffer.indexOf("\n");
      if (idx < 0) break;
      const line = this.stdoutBuffer.slice(0, idx).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(idx + 1);
      if (!line) continue;

      let response: WolframResponse;
      try {
        response = JSON.parse(extractJsonObject(line)) as WolframResponse;
      } catch {
        if (process.env.WOLFRAM_DEBUG_STDIO === "1") {
          process.stderr.write(`[wolfram stdout] ${line}\n`);
        }
        continue;
      }

      const id = response.id;
      if (id === READY_ID) {
        this.readyResolve?.();
        this.readyPromise = null;
        this.readyResolve = null;
        this.readyReject = null;
        continue;
      }
      if (!id) continue;
      const pending = this.pending.get(id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve(response);
    }
  }

  private async waitForReady(): Promise<void> {
    if (!this.readyPromise) return;
    const timeoutMs = Math.max(10_000, Math.min(config.wolframWorkerTimeoutMs, 60_000));
    await Promise.race([
      this.readyPromise,
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error(`Wolfram worker did not become ready within ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }
}

function extractJsonObject(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("{")) return trimmed;
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

function workerArgs(command: string, workerPath: string): string[] {
  const override = process.env.WOLFRAM_WORKER_ARGS;
  if (override?.trim()) {
    return override.split(/\s+/).map(part => part.replaceAll("{worker}", workerPath));
  }

  const base = path.basename(command).toLowerCase();
  if (base.includes("wolframscript")) {
    return [];
  }
  if (base.includes("wolframkernel")) {
    return ["-noprompt"];
  }
  return ["-code", `Get[${JSON.stringify(workerPath.replaceAll("\\", "/"))}]`];
}

function shouldBootstrapFromStdin(command: string): boolean {
  if (process.env.WOLFRAM_BOOTSTRAP_STDIN?.trim()) {
    return process.env.WOLFRAM_BOOTSTRAP_STDIN.trim().toLowerCase() !== "false";
  }
  const base = path.basename(command).toLowerCase();
  return base.includes("wolframkernel") || base.includes("wolframscript");
}
