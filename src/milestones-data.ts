import { runBacklog } from "./backlog";

export interface Milestone {
  id: string;
  title: string;
  doneCount: number;
  totalCount: number;
  completed: boolean;
}

export function parseMilestones(output: string): Milestone[] {
  const milestones: Milestone[] = [];
  let section: "active" | "completed" | "" = "";

  for (const raw of output.split("\n")) {
    if (/^Active milestones/i.test(raw)) {
      section = "active";
      continue;
    }
    if (/^Completed milestones/i.test(raw)) {
      section = "completed";
      continue;
    }
    if (!section) continue;

    const trimmed = raw.trim();
    if (!trimmed) continue;
    // Skip the "(collapsed, use --show-completed to list)" marker line
    if (trimmed.startsWith("(")) continue;

    const m = trimmed.match(/^(.+?): (.+) \((\d+)\/(\d+) done\)$/);
    if (!m) continue;

    const id = m[1].trim();
    let title = m[2].trim();
    // The CLI sometimes prefixes the title with "<id> - " — strip it for display.
    const redundantPrefix = `${id} - `;
    if (title.startsWith(redundantPrefix)) title = title.slice(redundantPrefix.length);

    milestones.push({
      id,
      title,
      doneCount: Number(m[3]),
      totalCount: Number(m[4]),
      completed: section === "completed",
    });
  }

  return milestones;
}

export async function listMilestones(projectDir: string): Promise<Milestone[]> {
  const stdout = await runBacklog(["milestone", "list", "--plain", "--show-completed"], projectDir);
  return parseMilestones(stdout);
}
