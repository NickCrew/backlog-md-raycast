import { Form, ActionPanel, Action, showToast, Toast, popToRoot, Icon } from "@raycast/api";
import { existsSync } from "fs";
import { relative } from "path";
import { useEffect, useState } from "react";
import { BacklogTaskSummary, runBacklog } from "./backlog";
import { useActiveProject } from "./preferences";
import TaskPicker, { formatTaskOption } from "./task-picker";
import MilestonePicker, { formatMilestoneOption } from "./milestone-picker";
import { Milestone } from "./milestones-data";

const PRIORITIES = [
  { title: "None", value: "" },
  { title: "High", value: "high" },
  { title: "Medium", value: "medium" },
  { title: "Low", value: "low" },
];

interface CreateTaskValues extends Record<string, unknown> {
  title: string;
  description?: string;
  priority?: string;
  labels?: string;
  assignee?: string;
  isDraft?: boolean;
  references?: string[];
  documents?: string[];
  noDodDefaults?: boolean;
}

function toProjectRelativePath(projectDir: string, filePath: string): string {
  const relativePath = relative(projectDir, filePath);
  return relativePath || ".";
}

export default function Command() {
  const [titleError, setTitleError] = useState<string | undefined>();
  const [activeProject, setActiveProject, config] = useActiveProject();
  const [parentTask, setParentTask] = useState<BacklogTaskSummary | undefined>();
  const [dependencyTasks, setDependencyTasks] = useState<BacklogTaskSummary[]>([]);
  const [milestone, setMilestone] = useState<Milestone | undefined>();
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]);
  const [documentFiles, setDocumentFiles] = useState<string[]>([]);

  // Dynamic list fields
  const [acItems, setAcItems] = useState<string[]>([""]);
  const [dodItems, setDodItems] = useState<string[]>([]);

  useEffect(() => {
    setParentTask(undefined);
    setDependencyTasks([]);
    setMilestone(undefined);
    setReferenceFiles([]);
    setDocumentFiles([]);
  }, [activeProject]);

  async function handleSubmit(values: CreateTaskValues) {
    const title = (values.title || "").trim();
    if (!title) {
      setTitleError("Title is required");
      return;
    }

    const args: string[] = ["task", "create", title];

    const description = (values.description as string)?.trim();
    if (description) {
      args.push("--description", description);
    }

    const priority = values.priority as string;
    if (priority) {
      args.push("--priority", priority);
    }

    const labels = (values.labels as string)?.trim();
    if (labels) {
      const cleaned = labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(",");
      if (cleaned) args.push("--labels", cleaned);
    }

    const assignee = (values.assignee as string)?.trim();
    if (assignee) {
      args.push("--assignee", assignee);
    }

    if (values.isDraft) {
      args.push("--draft");
    }

    // Parent task
    if (parentTask) {
      args.push("--parent", parentTask.id);
    }

    // Dependencies
    if (dependencyTasks.length > 0) {
      args.push("--depends-on", dependencyTasks.map((task) => task.id).join(","));
    }

    // Milestone
    if (milestone) {
      args.push("--milestone", milestone.id);
    }

    // Acceptance criteria (multiple --ac flags)
    for (let i = 0; i < acItems.length; i++) {
      const val = (values[`ac-${i}`] as string)?.trim();
      if (val) args.push("--ac", val);
    }

    // Definition of Done (multiple --dod flags)
    if (values.noDodDefaults) {
      args.push("--no-dod-defaults");
    }
    for (let i = 0; i < dodItems.length; i++) {
      const val = (values[`dod-${i}`] as string)?.trim();
      if (val) args.push("--dod", val);
    }

    const references = ((values.references as string[]) || [])
      .filter((file) => existsSync(file))
      .map((file) => toProjectRelativePath(activeProject, file));
    for (const file of references) {
      args.push("--ref", file);
    }

    const documents = ((values.documents as string[]) || [])
      .filter((file) => existsSync(file))
      .map((file) => toProjectRelativePath(activeProject, file));
    for (const file of documents) {
      args.push("--doc", file);
    }

    args.push("--plain");

    try {
      await showToast({ style: Toast.Style.Animated, title: "Creating task..." });

      const output = await runBacklog(args, activeProject);

      const idMatch = output.match(/(?:task|TASK)[-\s]?(\S+)/i);
      const taskId = idMatch ? idMatch[1] : undefined;

      await showToast({
        style: Toast.Style.Success,
        title: "Task created",
        message: taskId ? `Task ${taskId}` : undefined,
      });

      popToRoot();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to create task",
        message: message.split("\n")[0],
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Task" onSubmit={handleSubmit} />
          <ActionPanel.Section title="Add Fields">
            <Action.Push
              title={parentTask ? "Change Parent Task" : "Select Parent Task"}
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd", "opt"], key: "p" }}
              target={
                <TaskPicker
                  projectDir={activeProject}
                  navigationTitle="Select Parent Task"
                  actionTitle="Use as Parent Task"
                  excludedTaskIds={dependencyTasks.map((task) => task.id)}
                  onSelect={(task) => setParentTask(task)}
                />
              }
            />
            <Action.Push
              title="Add Dependency"
              icon={Icon.Plus}
              shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
              target={
                <TaskPicker
                  projectDir={activeProject}
                  navigationTitle="Add Dependency"
                  actionTitle="Add Dependency"
                  excludedTaskIds={[...(parentTask ? [parentTask.id] : []), ...dependencyTasks.map((task) => task.id)]}
                  onSelect={(task) => setDependencyTasks((current) => [...current, task])}
                />
              }
            />
            <Action.Push
              title={milestone ? "Change Milestone" : "Set Milestone"}
              icon={Icon.Bullseye}
              shortcut={{ modifiers: ["cmd", "opt"], key: "m" }}
              target={
                <MilestonePicker
                  projectDir={activeProject}
                  navigationTitle="Select Milestone"
                  actionTitle="Use as Milestone"
                  onSelect={(m) => setMilestone(m)}
                />
              }
            />
            <Action
              title="Add Acceptance Criterion"
              icon={Icon.Plus}
              shortcut={{ modifiers: ["cmd", "opt"], key: "a" }}
              onAction={() => setAcItems([...acItems, ""])}
            />
            <Action
              title="Add Definition of Done Item"
              icon={Icon.Plus}
              shortcut={{ modifiers: ["cmd"], key: "d" }}
              onAction={() => setDodItems([...dodItems, ""])}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Remove Fields">
            {parentTask ? (
              <Action
                title="Clear Parent Task"
                icon={Icon.Minus}
                style={Action.Style.Destructive}
                onAction={() => setParentTask(undefined)}
              />
            ) : null}
            {dependencyTasks.length > 0 ? (
              <Action
                title="Remove Last Dependency"
                icon={Icon.Minus}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["opt", "shift"], key: "p" }}
                onAction={() => setDependencyTasks((current) => current.slice(0, -1))}
              />
            ) : null}
            {milestone ? (
              <Action
                title="Clear Milestone"
                icon={Icon.Minus}
                style={Action.Style.Destructive}
                onAction={() => setMilestone(undefined)}
              />
            ) : null}
            <Action
              title="Remove Last Acceptance Criterion"
              icon={Icon.Minus}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
              onAction={() => acItems.length > 0 && setAcItems(acItems.slice(0, -1))}
            />
            <Action
              title="Remove Last Definition of Done"
              icon={Icon.Minus}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["opt", "shift"], key: "d" }}
              onAction={() => dodItems.length > 0 && setDodItems(dodItems.slice(0, -1))}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      {/* ── Project ── */}
      {config.projects.length > 1 && (
        <Form.Dropdown id="project" title="Project" value={activeProject} onChange={setActiveProject}>
          {config.projects.map((p) => (
            <Form.Dropdown.Item key={p.path} title={p.name} value={p.path} />
          ))}
        </Form.Dropdown>
      )}

      {/* ── Core ── */}
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Task title"
        error={titleError}
        onChange={() => titleError && setTitleError(undefined)}
        autoFocus
      />
      <Form.TextArea id="description" title="Description" placeholder="Describe the task..." />

      <Form.Separator />

      {/* ── Metadata ── */}
      <Form.Dropdown id="priority" title="Priority" defaultValue="">
        {PRIORITIES.map((p) => (
          <Form.Dropdown.Item key={p.value} title={p.title} value={p.value} />
        ))}
      </Form.Dropdown>
      <Form.TextField id="labels" title="Labels" placeholder="bug, frontend (comma-separated)" />
      <Form.TextField id="assignee" title="Assignee" placeholder="Assignee name" />
      <Form.Checkbox id="isDraft" title="Draft" label="Create as draft" defaultValue={false} />

      <Form.Separator />

      {/* ── Relationships ── */}
      <Form.Description
        key={`parent-${parentTask?.id ?? "none"}`}
        title="Parent Task"
        text={
          parentTask
            ? formatTaskOption(parentTask)
            : "None selected. ⌘⌥P, or use Select Parent Task from the actions menu."
        }
      />
      <Form.Description
        key={`deps-${dependencyTasks.map((t) => t.id).join(",") || "none"}`}
        title="Depends On"
        text={
          dependencyTasks.length > 0
            ? dependencyTasks.map((task) => `- ${formatTaskOption(task)}`).join("\n")
            : "None selected. ⌘⇧P, or use Add Dependency from the actions menu."
        }
      />
      <Form.Description
        key={`milestone-${milestone?.id ?? "none"}`}
        title="Milestone"
        text={milestone ? formatMilestoneOption(milestone) : "None. ⌘⌥M, or use Set Milestone from the actions menu."}
      />

      <Form.Separator />

      {/* ── Acceptance Criteria (dynamic) ── */}
      <Form.Description text="Acceptance Criteria  ⌘⌥A to add" />
      {acItems.map((_, i) => (
        <Form.TextField key={`ac-${i}`} id={`ac-${i}`} title={`AC ${i + 1}`} placeholder="Criterion..." />
      ))}

      {/* ── Definition of Done (dynamic) ── */}
      <Form.Description text="Definition of Done  ⌘D to add" />
      <Form.Checkbox id="noDodDefaults" title="" label="Skip default DoD items" defaultValue={false} />
      {dodItems.map((_, i) => (
        <Form.TextField key={`dod-${i}`} id={`dod-${i}`} title={`DoD ${i + 1}`} placeholder="Done criterion..." />
      ))}

      <Form.Separator />

      {/* ── References ── */}
      <Form.FilePicker
        id="references"
        title="References"
        value={referenceFiles}
        onChange={setReferenceFiles}
        allowMultipleSelection
        canChooseDirectories={false}
        info="Raycast chooses the picker folder; selected files are submitted as project-relative --ref paths"
      />
      <Form.Description
        title="Selected References"
        text={
          referenceFiles.length > 0
            ? referenceFiles.map((file) => `- \`${toProjectRelativePath(activeProject, file)}\``).join("\n")
            : "No references selected yet."
        }
      />

      <Form.Separator />

      {/* ── Documents ── */}
      <Form.FilePicker
        id="documents"
        title="Documents"
        value={documentFiles}
        onChange={setDocumentFiles}
        allowMultipleSelection
        canChooseDirectories={false}
        info="Raycast chooses the picker folder; selected files are submitted as project-relative --doc paths"
      />
      <Form.Description
        title="Selected Documents"
        text={
          documentFiles.length > 0
            ? documentFiles.map((file) => `- \`${toProjectRelativePath(activeProject, file)}\``).join("\n")
            : "No documents selected yet."
        }
      />
    </Form>
  );
}
