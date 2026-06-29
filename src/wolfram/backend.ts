import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { WolframRequest, WolframResponse, WolframToolName } from "./types.js";

const WINDOWS_WOLFRAM_ROOT = "C:\\Program Files\\Wolfram Research";
const WINDOWS_WOLFRAM_SCRIPT = path.join(WINDOWS_WOLFRAM_ROOT, "WolframScript", "wolframscript.exe");

export class WolframBackend {
  private worker: ChildProcessWithoutNullStreams | null = null;
  private workerReady: Promise<void> | null = null;
  private workerBuffer = "";
  private workerReadyResolve: (() => void) | null = null;
  private pending = new Map<string, PendingRequest>();

  constructor(
    private readonly command = config.wolframCommand || findDefaultWolframCommand(),
    private readonly mode = config.wolframBackendMode
  ) {}

  get commandPath(): string {
    return this.command;
  }

  async call(tool: WolframToolName, args: Record<string, unknown>, timeoutMs = config.wolframWorkerTimeoutMs): Promise<WolframResponse> {
    if (this.mode === "worker") {
      return await this.callWorker(tool, args, timeoutMs);
    }
    if (this.mode === "daemon") {
      return await this.callDaemon(tool, args, timeoutMs);
    }
    if (this.mode !== "oneshot") {
      throw new Error(`Unsupported Wolfram backend mode '${this.mode}'. Use 'worker', 'oneshot', or 'daemon'.`);
    }
    return await this.callOneshot(tool, args, timeoutMs);
  }

  private async callWorker(tool: WolframToolName, args: Record<string, unknown>, timeoutMs: number): Promise<WolframResponse> {
    await this.ensureWorker();
    const id = randomUUID();
    const request: WolframRequest = { id, tool, args, timeoutMs };
    return await new Promise<WolframResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Wolfram worker request timed out after ${timeoutMs}ms`));
        this.restartWorker();
      }, timeoutMs + 1000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker?.stdin.write(`${JSON.stringify(request)}\n`);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private async ensureWorker(): Promise<void> {
    if (this.worker && this.workerReady) {
      await this.workerReady;
      return;
    }

    const command = this.command || findDefaultWolframCommand();
    const child = spawn(command, workerLaunchArgs(), {
      cwd: config.rootDir,
      env: wolframProcessEnv(),
      stdio: "pipe",
      windowsHide: true
    });
    this.worker = child;
    this.workerBuffer = "";
    this.workerReady = new Promise<void>((resolve, reject) => {
      this.workerReadyResolve = resolve;
      const timer = setTimeout(() => {
        if (!this.workerReadyResolve) return;
        this.workerReadyResolve = null;
        reject(new Error(`Wolfram worker did not become ready after ${config.wolframWorkerTimeoutMs}ms`));
        this.restartWorker();
      }, config.wolframWorkerTimeoutMs);
      child.once("error", error => {
        if (!this.workerReadyResolve) return;
        this.workerReadyResolve = null;
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", codeValue => {
        if (!this.workerReadyResolve) return;
        this.workerReadyResolve = null;
        clearTimeout(timer);
        if (this.worker === child) {
          this.worker = null;
          this.workerReady = null;
        }
        reject(new Error(`Wolfram worker exited before ready${codeValue === null ? "" : ` with code ${codeValue}`}`));
      });
      const ready = () => clearTimeout(timer);
      child.stdout.once("data", ready);
    });

    child.stdout.on("data", chunk => this.handleWorkerStdout(String(chunk)));
    child.stderr.on("data", chunk => {
      if (config.wolframDebugStdio) process.stderr.write(String(chunk));
    });
    child.on("exit", codeValue => {
      if (this.worker === child) {
        this.worker = null;
        this.workerReady = null;
        this.workerReadyResolve = null;
      }
      this.rejectAllPending(new Error(`Wolfram worker exited${codeValue === null ? "" : ` with code ${codeValue}`}`));
    });
    const bootstrap = workerBootstrapCode();
    if (bootstrap) child.stdin.write(`${bootstrap}\n`);

    await this.workerReady;
  }

  private handleWorkerStdout(chunk: string): void {
    if (config.wolframDebugStdio) process.stderr.write(chunk);
    this.workerBuffer += chunk;
    while (true) {
      const newline = this.workerBuffer.indexOf("\n");
      if (newline < 0) return;
      const line = this.workerBuffer.slice(0, newline).trim();
      this.workerBuffer = this.workerBuffer.slice(newline + 1);
      if (!line) continue;
      let response: WolframResponse;
      try {
        response = JSON.parse(extractJsonObject(line)) as WolframResponse;
      } catch {
        if (config.wolframDebugStdio) process.stderr.write(`Could not parse Wolfram worker output: ${line}\n`);
        continue;
      }
      if (response.id === "__worker_ready__") {
        this.workerReadyResolve?.();
        this.workerReadyResolve = null;
        continue;
      }
      if (!response.id) continue;
      const pending = this.pending.get(response.id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      pending.resolve(response);
    }
  }

  private restartWorker(): void {
    const child = this.worker;
    this.worker = null;
    this.workerReady = null;
    this.workerReadyResolve = null;
    if (child && !child.killed) child.kill();
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private async callDaemon(tool: WolframToolName, args: Record<string, unknown>, timeoutMs: number): Promise<WolframResponse> {
    const id = randomUUID();
    const request: WolframRequest = { id, tool, args, timeoutMs };
    return await sendDaemonPayload(request, timeoutMs);
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
        env: wolframProcessEnv(),
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

  close(): void {
    this.rejectAllPending(new Error("Wolfram backend closed"));
    const child = this.worker;
    this.worker = null;
    this.workerReady = null;
    this.workerReadyResolve = null;
    if (!child) return;
    child.stdin.end();
    setTimeout(() => {
      if (!child.killed) child.kill();
    }, 500).unref();
  }
}

type PendingRequest = {
  resolve: (response: WolframResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

function wolframProcessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    FORMULA_TRANSFORM_ENGINE_PACLET_DIR: config.formulaTransformEnginePath
  };
}

function workerLaunchArgs(): string[] {
  if (!config.wolframWorkerArgs) return [];
  return splitArgs(config.wolframWorkerArgs).map(arg => arg
    .replaceAll("{worker}", config.wolframWorkerPath)
    .replaceAll("{protocol}", config.wolframProtocolPath)
  );
}

function workerBootstrapCode(): string {
  if (config.wolframWorkerArgs) return "";
  const workerPath = config.wolframWorkerPath.replaceAll("\\", "/");
  const protocolPath = config.wolframProtocolPath.replaceAll("\\", "/");
  return `Global\`$WMAProtocolPath = ${JSON.stringify(protocolPath)}; Global\`$WMAUseInputString = True; Get[${JSON.stringify(workerPath)}]`;
}

function splitArgs(raw: string): string[] {
  const matches = raw.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map(part => part.replace(/^["']|["']$/g, ""));
}

export async function sendDaemonPayload<T extends Record<string, unknown>>(payload: T, timeoutMs = config.wolframWorkerTimeoutMs): Promise<WolframResponse> {
  return await new Promise<WolframResponse>((resolve, reject) => {
    const socket = net.createConnection({
      host: config.wolframDaemonHost,
      port: config.wolframDaemonPort
    });
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Wolfram daemon request timed out after ${timeoutMs}ms`));
    }, timeoutMs + 1000);

    socket.on("connect", () => {
      socket.write(`${JSON.stringify(payload)}\n`);
    });
    socket.on("data", chunk => {
      buffer += String(chunk);
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const line = buffer.slice(0, newline).trim();
      clearTimeout(timer);
      socket.end();
      try {
        resolve(JSON.parse(extractJsonObject(line)) as WolframResponse);
      } catch {
        reject(new Error(`Could not parse Wolfram daemon output: ${line}`));
      }
    });
    socket.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on("close", () => clearTimeout(timer));
  });
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
    for (const candidate of findWindowsWolframCandidates()) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  const onPath = findExecutableOnPath(process.platform === "win32" ? "wolframscript.exe" : "wolframscript");
  if (onPath) return onPath;

  return "wolframscript";
}

export function findWindowsWolframCandidates(): string[] {
  const candidates: string[] = [];
  const installRoot = path.join(WINDOWS_WOLFRAM_ROOT, "Wolfram");
  let versions: string[] = [];
  try {
    versions = fs.readdirSync(installRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort(compareWolframVersions)
      .reverse();
  } catch {
    versions = [];
  }
  for (const version of versions) {
    const root = path.join(installRoot, version);
    candidates.push(
      path.join(root, "wolframscript.exe"),
      path.join(root, "SystemFiles", "Kernel", "Binaries", "Windows-x86-64", "wolframscript.exe"),
      path.join(root, "WolframKernel.exe"),
      path.join(root, "SystemFiles", "Kernel", "Binaries", "Windows-x86-64", "WolframKernel.exe")
    );
  }
  candidates.push(WINDOWS_WOLFRAM_SCRIPT);
  return [...new Set(candidates)];
}

function findExecutableOnPath(executable: string): string {
  const pathValue = process.env.PATH ?? "";
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  const names = process.platform === "win32" && !path.extname(executable)
    ? extensions.map(ext => `${executable}${ext.toLowerCase()}`)
    : [executable];
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "";
}

function compareWolframVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(part => Number.parseInt(part, 10));
  const rightParts = right.split(".").map(part => Number.parseInt(part, 10));
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return left.localeCompare(right);
}
