import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import { config } from "../config.js";
import { WolframBackend } from "./backend.js";
import type { WolframRequest, WolframResponse } from "./types.js";

type ControlPayload = {
  control?: "status" | "shutdown";
};

export async function startDaemonServer(): Promise<net.Server> {
  const backend = new WolframBackend(undefined, "worker");
  const server = net.createServer(socket => {
    let buffer = "";
    socket.on("data", chunk => {
      buffer += String(chunk);
      while (true) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) return;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) void handleLine(line, socket, backend, server);
      }
    });
  });

  server.on("close", () => {
    backend.close();
    void removePidFile();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.wolframDaemonPort, config.wolframDaemonHost, () => {
      server.off("error", reject);
      resolve();
    });
  });
  await writePidFile();
  return server;
}

export async function runDaemonForeground(): Promise<void> {
  const server = await startDaemonServer();
  console.log(`Wolfram daemon listening on ${config.wolframDaemonHost}:${config.wolframDaemonPort}`);
  const shutdown = async () => {
    server.close();
    await removePidFile();
  };
  process.once("SIGINT", () => void shutdown().then(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().then(() => process.exit(0)));
  await new Promise<void>(resolve => server.once("close", resolve));
}

export async function startDaemonDetached(): Promise<void> {
  const status = await daemonStatus().catch(() => null);
  if (status?.ok) return;
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1] ?? "", "wolfram-daemon", "run"], {
    cwd: config.rootDir,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  await waitForDaemonReady();
}

export async function stopDaemon(): Promise<WolframResponse> {
  return await sendControl({ control: "shutdown" });
}

export async function daemonStatus(): Promise<WolframResponse> {
  return await sendControl({ control: "status" });
}

async function handleLine(line: string, socket: net.Socket, backend: WolframBackend, server: net.Server): Promise<void> {
  let payload: (Partial<WolframRequest> & ControlPayload) | null = null;
  try {
    payload = JSON.parse(line) as Partial<WolframRequest> & ControlPayload;
  } catch {
    write(socket, { id: null, ok: false, error: "Invalid JSON request" });
    return;
  }

  if (payload.control === "status") {
    write(socket, { id: "daemon_status", ok: true, title: "Wolfram daemon status", output: "running" });
    return;
  }
  if (payload.control === "shutdown") {
    write(socket, { id: "daemon_shutdown", ok: true, title: "Wolfram daemon shutdown", output: "stopping" });
    socket.end();
    setTimeout(() => {
      server.close();
      void removePidFile();
    }, 10).unref();
    return;
  }
  if (!payload.tool || !payload.args || typeof payload.id !== "string") {
    write(socket, { id: null, ok: false, error: "Invalid Wolfram request" });
    return;
  }

  try {
    const result = await backend.call(payload.tool, payload.args, payload.timeoutMs);
    write(socket, result);
  } catch (error) {
    write(socket, {
      id: payload.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function write(socket: net.Socket, response: WolframResponse): void {
  socket.write(`${JSON.stringify(response)}\n`);
}

async function sendControl(payload: ControlPayload): Promise<WolframResponse> {
  const { sendDaemonPayload } = await import("./backend.js");
  return await sendDaemonPayload(payload, 5000);
}

async function waitForDaemonReady(): Promise<void> {
  const deadline = Date.now() + 10_000;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const response = await daemonStatus();
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Wolfram daemon did not start: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function writePidFile(): Promise<void> {
  await fs.writeFile(config.wolframDaemonPidPath, String(process.pid), "utf8").catch(() => undefined);
}

async function removePidFile(): Promise<void> {
  await fs.rm(config.wolframDaemonPidPath, { force: true }).catch(() => undefined);
}
