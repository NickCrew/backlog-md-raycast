import { Form, ActionPanel, Action, List, showToast, Toast, popToRoot, Icon, useNavigation } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { existsSync } from "fs";
import { useEffect, useState } from "react";
import { BacklogTaskSummary, listTaskSummaries, runBacklog } from "./backlog";
import { useActiveProject } from "./preferences";

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
  parent?: string;
  dependsOn?: string;
  plan?: string;
  notes?: string;
  finalSummary?: string;
  references?: string[];
  documents?: string[];
  noDodDefaults?: boolean;
}

function formatTaskOption(task: BacklogTaskSummary): string {
  const priority =
    task.priority && task.priority !== "none" ? task.priority[0].toUpperCase() + task.priority.slice(1) : undefined;
  const details = [task.status, priority].filter(Boolean).join(" · ");
  return details ? `${task.id} - ${task.title} (${details})` : `${task.id} - ${task.title}`;
}

function TaskPicker({
  projectDir,
  navigationTitle,
  actionTitle,
  onSelect,
  excludedTaskIds = [],
}: {
  projectDir: string;
  navigationTitle: string;
  actionTitle: string;
  onSelect: (task: BacklogTaskSummary) => void;
  excludedTaskIds?: string[];
}) {
  const { pop } = useNavigation();
  const [searchText, setSearchText] = useState("");
  const { isLoading, data = [] } = usePromise(async (cwd: string) => listTaskSummaries(cwd), [projectDir], {
    execute: !!projectDir,
    onError: (error) => {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load tasks",
        message: error.message,
      });
    },
  });

  const excluded = new Set(excludedTaskIds);
  const normalizedSearch = searchText.trim().toLowerCase();
  const tasks = data.filter((task) => {
    if (excluded.has(task.id)) return false;
    if (!normalizedSearch) return true;

    return [task.id, task.title, task.status, task.priority].some((value) =>
      value?.toLowerCase().includes(normalizedSearch),
    );
  });

  return (
    <List
      isLoading={isLoading}
      navigationTitle={navigationTitle}
      searchBarPlaceholder="Search tasks..."
      filtering={false}
      onSearchTextChange={setSearchText}
      throttle
    >
      {tasks.map((task) => (
        <List.Item
          key={task.id}
          title={task.title}
          subtitle={task.id}
          accessories={[
            { text: task.status },
            ...(task.priority && task.priority !== "none" ? [{ text: task.priority }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action
                title={actionTitle}
                onAction={() => {
                  onSelect(task);
                  pop();
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default function Command() {
  const [titleError, setTitleError] = useState<string | undefined>();
  const [activeProject, setActiveProject, config] = useActiveProject();
  const [parentTask, setParentTask] = useState<BacklogTaskSummary | undefined>();
  const [dependencyTasks, setDependencyTasks] = useState<BacklogTaskSummary[]>([]);
  const [manualParentId, setManualParentId] = useState("");
  const [manualDependencyIds, setManualDependencyIds] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]);
  const [documentFiles, setDocumentFiles] = useState<string[]>([]);

  // Dynamic list fields
  const [acItems, setAcItems] = useState<string[]>([""]);
  const [dodItems, setDodItems] = useState<string[]>([]);

  useEffect(() => {
    setParentTask(undefined);
    setDependencyTasks([]);
    setManualParentId("");
    setManualDependencyIds("");
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
    const parentId = values.parent?.trim() || parentTask?.id;
    if (parentId) {
      args.push("--parent", parentId);
    }

    // Dependencies
    const dependsOn = Array.from(
      new Set([
        ...dependencyTasks.map((task) => task.id),
        ...(values.dependsOn || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ]),
    );
    if (dependsOn.length > 0) {
      args.push("--depends-on", dependsOn.join(","));
    }

    const plan = (values.plan as string)?.trim();
    if (plan) {
      args.push("--plan", plan);
    }

    const notes = (values.notes as string)?.trim();
    if (notes) {
      args.push("--notes", notes);
    }

    const finalSummary = (values.finalSummary as string)?.trim();
    if (finalSummary) {
      args.push("--final-summary", finalSummary);
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

    const references = ((values.references as string[]) || []).filter((file) => existsSync(file));
    for (const file of references) {
      args.push("--ref", file);
    }

    const documents = ((values.documents as string[]) || []).filter((file) => existsSync(file));
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
              target={
                <TaskPicker
                  projectDir={activeProject}
                  navigationTitle="Select Parent Task"
                  actionTitle="Use as Parent Task"
                  excludedTaskIds={dependencyTasks.map((task) => task.id)}
                  onSelect={(task) => {
                    setParentTask(task);
                    setManualParentId("");
                  }}
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
            <Action
              title="Add Acceptance Criterion"
              icon={Icon.Plus}
              shortcut={{ modifiers: ["cmd"], key: "a" }}
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
        title="Parent Task"
        text={
          parentTask ? formatTaskOption(parentTask) : "None selected. Use Select Parent Task from the actions menu."
        }
      />
      <Form.TextField
        id="parent"
        title="Parent Task ID"
        value={manualParentId}
        onChange={(value) => {
          setManualParentId(value);
          if (value.trim()) {
            setParentTask(undefined);
          }
        }}
        placeholder="Optional manual fallback, e.g. task-42"
      />
      <Form.Description
        title="Depends On"
        text={
          dependencyTasks.length > 0
            ? dependencyTasks.map((task) => `- ${formatTaskOption(task)}`).join("\n")
            : "None selected. Use Add Dependency from the actions menu."
        }
      />
      <Form.TextField
        id="dependsOn"
        title="Dependency IDs"
        value={manualDependencyIds}
        onChange={setManualDependencyIds}
        placeholder="Optional manual fallback, e.g. task-1, task-2"
      />

      <Form.Separator />

      {/* ── Acceptance Criteria (dynamic) ── */}
      <Form.Description text="Acceptance Criteria  ⌘A to add" />
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

      {/* ── Plan & Summary ── */}
      <Form.TextArea id="plan" title="Plan" placeholder="Implementation plan..." />
      <Form.TextArea id="notes" title="Implementation Notes" placeholder="Implementation notes..." />
      <Form.TextArea
        id="finalSummary"
        title="Final Summary"
        placeholder="What should be true when this task is done?"
      />

      <Form.Separator />

      {/* ── References ── */}
      <Form.FilePicker
        id="references"
        title="References"
        value={referenceFiles}
        onChange={setReferenceFiles}
        allowMultipleSelection
        canChooseDirectories={false}
        info="Files added here are submitted as --ref"
      />
      <Form.Description
        title="Selected References"
        text={
          referenceFiles.length > 0
            ? referenceFiles.map((file) => `- \`${file}\``).join("\n")
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
        info="Files added here are submitted as --doc"
      />
      <Form.Description
        title="Selected Documents"
        text={
          documentFiles.length > 0
            ? documentFiles.map((file) => `- \`${file}\``).join("\n")
            : "No documents selected yet."
        }
      />
    </Form>
  );
}
