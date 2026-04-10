import { execFile } from "child_process";
import { promisify } from "util";
import { getProjectConfig } from "./preferences";

const execFileAsync = promisify(execFile);

export interface BacklogTaskSummary {
  id: string;
  title: string;
  priority: string;
  status: string;
}

export async function runBacklog(args: string[], cwd: string): Promise<string> {
  const { backlogPath } = getProjectConfig();

  const { stdout } = await execFileAsync(backlogPath, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: 15000,
  });

  return stdout;
}

export function parseTaskSummaries(output: string): BacklogTaskSummary[] {
  const tasks: BacklogTaskSummary[] = [];
  let currentStatus = "";

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.endsWith(":") && !trimmed.startsWith("[")) {
      currentStatus = trimmed.slice(0, -1);
      continue;
    }

    const match = trimmed.match(/^\[(\w+)\]\s+([\w-]+)\s+-\s+(.+)$/);
    if (!match || !currentStatus) continue;

    tasks.push({
      priority: match[1].toLowerCase(),
      id: match[2],
      title: match[3],
      status: currentStatus,
    });
  }

  return tasks;
}

export async function listTaskSummaries(
  cwd: string,
  filters: { status?: string; priority?: string } = {},
): Promise<BacklogTaskSummary[]> {
  const args = ["task", "list", "--plain"];

  if (filters.status && filters.status !== "All") {
    args.push("--status", filters.status);
  }

  if (filters.priority && filters.priority !== "All") {
    args.push("--priority", filters.priority.toLowerCase());
  }

  const stdout = await runBacklog(args, cwd);
  return parseTaskSummaries(stdout);
}
