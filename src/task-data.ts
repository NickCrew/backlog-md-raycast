import { runBacklog } from "./backlog";

export interface TaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  created: string;
  labels: string[];
  milestone: string;
  assignee: string;
  parent: string;
  subtasks: string[];
  description: string;
  acceptanceCriteria: string[];
  definitionOfDone: string[];
  implementationPlan: string;
  dependencies: string[];
  references: string[];
  documentation: string[];
  notes: string;
  finalSummary: string;
  filePath: string;
}

function parseTaskView(output: string): TaskData {
  const task: TaskData = {
    id: "",
    title: "",
    status: "",
    priority: "",
    created: "",
    labels: [],
    milestone: "",
    assignee: "",
    parent: "",
    subtasks: [],
    description: "",
    acceptanceCriteria: [],
    definitionOfDone: [],
    implementationPlan: "",
    dependencies: [],
    references: [],
    documentation: [],
    notes: "",
    finalSummary: "",
    filePath: "",
  };

  const lines = output.split("\n");
  let currentSection = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("File:")) {
      task.filePath = trimmed.replace("File:", "").trim();
      continue;
    }

    if (trimmed.startsWith("Task ") && trimmed.includes(" - ")) {
      const titleMatch = trimmed.match(/^Task\s+([\w-]+)\s+-\s+(.+)$/);
      if (titleMatch) {
        task.id = titleMatch[1];
        task.title = titleMatch[2];
      }
      continue;
    }

    if (trimmed.match(/^=+$/) || trimmed.match(/^-+$/)) continue;

    if (trimmed === "Description:") {
      currentSection = "description";
      continue;
    }
    if (trimmed === "Acceptance Criteria:") {
      currentSection = "ac";
      continue;
    }
    if (trimmed === "Definition of Done:") {
      currentSection = "dod";
      continue;
    }
    if (trimmed === "Implementation Plan:") {
      currentSection = "plan";
      continue;
    }
    if (trimmed === "Implementation Notes:") {
      currentSection = "notes";
      continue;
    }
    if (trimmed === "Final Summary:") {
      currentSection = "finalSummary";
      continue;
    }
    if (trimmed === "Dependencies:") {
      currentSection = "dependencies";
      continue;
    }
    if (trimmed === "References:") {
      currentSection = "references";
      continue;
    }
    if (trimmed === "Documentation:") {
      currentSection = "documentation";
      continue;
    }

    if (trimmed.startsWith("Status:")) {
      task.status = trimmed
        .replace("Status:", "")
        .replace(/[○●◐✕]/g, "")
        .trim();
      continue;
    }
    if (trimmed.startsWith("Priority:")) {
      task.priority = trimmed.replace("Priority:", "").trim().toLowerCase();
      continue;
    }
    if (trimmed.startsWith("Created:")) {
      task.created = trimmed.replace("Created:", "").trim();
      continue;
    }
    if (trimmed.startsWith("Labels:")) {
      task.labels = trimmed
        .replace("Labels:", "")
        .trim()
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean);
      continue;
    }
    if (trimmed.startsWith("Milestone:")) {
      task.milestone = trimmed.replace("Milestone:", "").trim();
      continue;
    }
    if (trimmed.startsWith("Assignee:")) {
      task.assignee = trimmed.replace("Assignee:", "").trim();
      continue;
    }
    if (!currentSection && trimmed.startsWith("Parent:")) {
      task.parent = trimmed.replace("Parent:", "").trim();
      continue;
    }
    if (trimmed === "Subtasks:" || /^Subtasks\s*\(\d+\):$/.test(trimmed)) {
      currentSection = "subtasks";
      continue;
    }
    if (!currentSection && trimmed.startsWith("Dependencies:")) {
      task.dependencies = trimmed
        .replace("Dependencies:", "")
        .trim()
        .split(",")
        .map((dep) => dep.trim())
        .filter(Boolean);
      continue;
    }
    if (!currentSection && trimmed.startsWith("References:")) {
      const reference = trimmed.replace("References:", "").trim();
      task.references = reference ? [reference] : [];
      continue;
    }
    if (!currentSection && trimmed.startsWith("Documentation:")) {
      const documentation = trimmed.replace("Documentation:", "").trim();
      task.documentation = documentation ? [documentation] : [];
      continue;
    }

    if (currentSection === "description" && trimmed) {
      task.description += (task.description ? "\n" : "") + trimmed;
    }
    if (currentSection === "plan" && trimmed) {
      task.implementationPlan += (task.implementationPlan ? "\n" : "") + trimmed;
    }
    if (currentSection === "notes" && trimmed) {
      task.notes += (task.notes ? "\n" : "") + trimmed;
    }
    if (currentSection === "finalSummary" && trimmed) {
      task.finalSummary += (task.finalSummary ? "\n" : "") + trimmed;
    }
    if ((currentSection === "ac" || currentSection === "dod") && trimmed.startsWith("- [")) {
      (currentSection === "ac" ? task.acceptanceCriteria : task.definitionOfDone).push(trimmed);
    }
    if (currentSection === "subtasks" && trimmed.startsWith("-")) {
      task.subtasks.push(trimmed.replace(/^-\s*/, ""));
    }
    if (currentSection === "dependencies" && trimmed.startsWith("-")) {
      task.dependencies.push(trimmed.replace(/^-\s*/, ""));
    }
    if (currentSection === "references" && trimmed.startsWith("-")) {
      task.references.push(trimmed.replace(/^-\s*/, ""));
    }
    if (currentSection === "documentation" && trimmed.startsWith("-")) {
      task.documentation.push(trimmed.replace(/^-\s*/, ""));
    }
  }

  return task;
}

export async function loadTask(taskId: string, projectDir: string): Promise<TaskData> {
  const stdout = await runBacklog(["task", "view", taskId, "--plain"], projectDir);
  return parseTaskView(stdout);
}
