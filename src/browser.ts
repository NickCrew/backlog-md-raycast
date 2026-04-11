import { ChildProcess, spawn } from "child_process";
import http from "http";
import net from "net";
import { runBacklog } from "./backlog";
import { getProjectConfig } from "./preferences";

const HOST = "127.0.0.1";
const DEFAULT_BROWSER_PORT = 6420;
const PORT_SEARCH_LIMIT = 25;
const STARTUP_TIMEOUT_MS = 15000;
const STARTUP_POLL_INTERVAL_MS = 300;
const PROBE_TIMEOUT_MS = 1200;
const PROBE_BODY_LIMIT = 4096;

export interface BrowserLaunchResult {
  port: number;
  url: string;
  reused: boolean;
}

interface BrowserExitResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidPort(port: number | undefined): port is number {
  return typeof port === "number" && Number.isInteger(port) && port > 0 && port <= 65535;
}

function hashProjectPath(projectDir: string): number {
  let hash = 0;
  for (const char of projectDir) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function getFallbackPort(projectDir: string): number {
  return DEFAULT_BROWSER_PORT + (hashProjectPath(projectDir) % 200);
}

function getCandidatePorts(projectDir: string, configuredPort?: number): number[] {
  const preferredPort = configuredPort ?? getFallbackPort(projectDir);
  const seen = new Set<number>();
  const ports: number[] = [];

  function add(port?: number) {
    if (!isValidPort(port) || seen.has(port)) return;
    seen.add(port);
    ports.push(port);
  }

  add(configuredPort);
  add(preferredPort);

  for (let offset = 1; ports.length < PORT_SEARCH_LIMIT && offset < PORT_SEARCH_LIMIT; offset++) {
    add(preferredPort + offset);
    add(preferredPort - offset);
  }

  return ports;
}

async function getConfiguredBrowserPort(projectDir: string): Promise<number | undefined> {
  try {
    const output = await runBacklog(["config", "get", "defaultPort"], projectDir);
    const port = Number.parseInt(output.trim(), 10);
    return isValidPort(port) ? port : undefined;
  } catch {
    return undefined;
  }
}

async function ensureBacklogProject(projectDir: string): Promise<void> {
  await runBacklog(["overview"], projectDir);
}

async function probeBrowserPort(port: number): Promise<{ reachable: boolean; looksLikeBacklog: boolean }> {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: HOST,
        port,
        path: "/",
        timeout: PROBE_TIMEOUT_MS,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          if (body.length < PROBE_BODY_LIMIT) {
            body += chunk.slice(0, PROBE_BODY_LIMIT - body.length);
          }
        });

        response.on("end", () => {
          const looksLikeBacklog =
            /<title>\s*Backlog\.md - Task Management\s*<\/title>/i.test(body) || /backlog-theme/i.test(body);

          resolve({ reachable: true, looksLikeBacklog });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy();
      resolve({ reachable: false, looksLikeBacklog: false });
    });

    request.on("error", () => {
      resolve({ reachable: false, looksLikeBacklog: false });
    });
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, HOST);
  });
}

async function waitForBrowserReady(
  port: number,
  exitPromise: Promise<BrowserExitResult>,
): Promise<{ ready: boolean; exit?: BrowserExitResult }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    const probe = await probeBrowserPort(port);
    if (probe.reachable) {
      return { ready: true };
    }

    const waitResult = await Promise.race([
      sleep(STARTUP_POLL_INTERVAL_MS).then(() => null),
      exitPromise.then((result) => result),
    ]);

    if (waitResult) {
      return { ready: false, exit: waitResult };
    }
  }
  return { ready: false };
}

async function startBrowserServer(
  projectDir: string,
  port: number,
): Promise<{ child: ChildProcess; exitPromise: Promise<BrowserExitResult> }> {
  const { backlogPath } = getProjectConfig();
  return new Promise((resolve, reject) => {
    const child = spawn(backlogPath, ["browser", "--port", String(port), "--no-open"], {
      cwd: projectDir,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, FORCE_COLOR: "0" }, // suppress ANSI color codes for background launcher output
    });

    const exitPromise = new Promise<BrowserExitResult>((resolveExit) => {
      child.once("exit", (code, signal) => {
        resolveExit({ code, signal });
      });
    });

    child.once("spawn", () => {
      child.unref();
      resolve({ child, exitPromise });
    });

    child.once("error", (error) => {
      reject(error);
    });
  });
}

export async function ensureBrowserServer(projectDir: string, cachedPort?: number): Promise<BrowserLaunchResult> {
  await ensureBacklogProject(projectDir);

  const configuredPort = await getConfiguredBrowserPort(projectDir);

  if (isValidPort(cachedPort)) {
    const cachedProbe = await probeBrowserPort(cachedPort);
    if (cachedProbe.reachable && cachedProbe.looksLikeBacklog) {
      return { port: cachedPort, url: `http://${HOST}:${cachedPort}`, reused: true };
    }
  }

  const candidates = getCandidatePorts(projectDir, configuredPort);

  for (const port of candidates) {
    const probe = await probeBrowserPort(port);
    if (probe.reachable) {
      if (probe.looksLikeBacklog) {
        return { port, url: `http://${HOST}:${port}`, reused: true };
      }
      continue;
    }

    if (!(await isPortAvailable(port))) {
      continue;
    }

    const { child, exitPromise } = await startBrowserServer(projectDir, port);
    const ready = await waitForBrowserReady(port, exitPromise);

    if (ready.ready) {
      return { port, url: `http://${HOST}:${port}`, reused: false };
    }

    if (ready.exit) {
      const exitDetails =
        ready.exit.code !== null ? `code ${ready.exit.code}` : `signal ${ready.exit.signal ?? "unknown"}`;
      throw new Error(`Backlog browser exited before becoming ready (${exitDetails})`);
    }

    child.kill();
  }

  throw new Error(
    configuredPort
      ? `Unable to start Backlog browser near configured port ${configuredPort}`
      : "Unable to find an available port for Backlog browser",
  );
}
