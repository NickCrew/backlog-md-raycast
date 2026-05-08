import { Detail, ActionPanel, Action, Icon, Color, showToast, Toast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { runBacklog } from "./backlog";
import EditTask from "./edit-task";
import { OpenBrowserAction } from "./open-browser";
import { getProjectConfig, getProjectName } from "./preferences";
import { loadTask, TaskData } from "./task-data";

const PRIORITY_COLORS: Record<string, Color> = {
  high: Color.Red,
  medium: Color.Orange,
  low: Color.SecondaryText,
};

const QUICK_STATUSES = [
  { title: "To Do", value: "to do", icon: Icon.Circle },
  { title: "In Progress", value: "in progress", icon: Icon.CircleProgress50 },
  { title: "Done", value: "done", icon: Icon.CheckCircle },
  { title: "Blocked", value: "blocked", icon: Icon.XMarkCircle },
];

function buildMarkdown(task: TaskData): string {
  const parts: string[] = [];

  parts.push(`# ${task.id} — ${task.title}\n`);

  if (task.description) {
    parts.push(task.description + "\n");
  }

  if (task.acceptanceCriteria.length > 0) {
    parts.push("## Acceptance Criteria\n");
    for (const ac of task.acceptanceCriteria) parts.push(ac);
    parts.push("");
  }

  if (task.definitionOfDone.length > 0 && !task.definitionOfDone[0].includes("No Definition of Done")) {
    parts.push("## Definition of Done\n");
    for (const dod of task.definitionOfDone) parts.push(dod);
    parts.push("");
  }

  if (task.implementationPlan) {
    parts.push("## Implementation Plan\n");
    parts.push(task.implementationPlan + "\n");
  }

  if (task.notes) {
    parts.push("## Implementation Notes\n");
    parts.push(task.notes + "\n");
  }

  if (task.finalSummary) {
    parts.push("## Final Summary\n");
    parts.push(task.finalSummary + "\n");
  }

  if (task.references.length > 0) {
    parts.push("## References\n");
    for (const ref of task.references) parts.push(`- ${ref}`);
    parts.push("");
  }

  if (task.documentation.length > 0) {
    parts.push("## Documentation\n");
    for (const doc of task.documentation) parts.push(`- ${doc}`);
    parts.push("");
  }

  if (task.subtasks.length > 0) {
    parts.push("## Subtasks\n");
    for (const subtask of task.subtasks) parts.push(`- ${subtask}`);
    parts.push("");
  }

  return parts.join("\n");
}

export async function setTaskStatus(taskId: string, status: string, projectDir: string) {
  await showToast({ style: Toast.Style.Animated, title: `Setting ${taskId} to ${status}...` });
  try {
    await runBacklog(["task", "edit", taskId, "--status", status, "--plain"], projectDir);
    await showToast({ style: Toast.Style.Success, title: `${taskId} → ${status}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await showToast({ style: Toast.Style.Failure, title: "Failed to update status", message: message.split("\n")[0] });
  }
}

export async function demoteTask(taskId: string, projectDir: string) {
  await showToast({ style: Toast.Style.Animated, title: `Demoting ${taskId}...` });
  try {
    await runBacklog(["task", "demote", taskId], projectDir);
    await showToast({ style: Toast.Style.Success, title: `${taskId} demoted to draft` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await showToast({ style: Toast.Style.Failure, title: "Failed to demote", message: message.split("\n")[0] });
  }
}

export default function TaskDetail({
  taskId,
  projectDir,
  onRefresh,
}: {
  taskId: string;
  projectDir: string;
  onRefresh?: () => void;
}) {
  const projectName = getProjectName(getProjectConfig(), projectDir);
  const { isLoading, data, revalidate } = usePromise(
    async (id: string, cwd: string) => {
      return loadTask(id, cwd);
    },
    [taskId, projectDir],
    {
      onError: (error) => {
        showToast({ style: Toast.Style.Failure, title: "Failed to load task", message: error.message });
      },
    },
  );

  const task = data;
  const markdown = task ? buildMarkdown(task) : "Loading...";

  const refresh = () => {
    revalidate();
    onRefresh?.();
  };

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={task ? `${task.id} — ${task.title}` : taskId}
      markdown={markdown}
      metadata={
        task ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Status" text={task.status} />
            <Detail.Metadata.Label
              title="Priority"
              text={task.priority || "none"}
              icon={{ source: Icon.Signal3, tintColor: PRIORITY_COLORS[task.priority] || Color.SecondaryText }}
            />
            {task.parent ? <Detail.Metadata.Label title="Parent" text={task.parent} /> : null}
            {task.assignee ? <Detail.Metadata.Label title="Assignee" text={task.assignee} /> : null}
            {task.milestone ? <Detail.Metadata.Label title="Milestone" text={task.milestone} /> : null}
            {task.created ? <Detail.Metadata.Label title="Created" text={task.created} /> : null}
            {task.labels.length > 0 ? (
              <Detail.Metadata.TagList title="Labels">
                {task.labels.map((label) => (
                  <Detail.Metadata.TagList.Item key={label} text={label} color={Color.Blue} />
                ))}
              </Detail.Metadata.TagList>
            ) : null}
            {task.dependencies.length > 0 ? (
              <>
                <Detail.Metadata.Separator />
                <Detail.Metadata.TagList title="Dependencies">
                  {task.dependencies.map((dep) => (
                    <Detail.Metadata.TagList.Item key={dep} text={dep} color={Color.Orange} />
                  ))}
                </Detail.Metadata.TagList>
              </>
            ) : null}
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          {task && (
            <Action.Push
              title="Edit Task"
              icon={Icon.Pencil}
              shortcut={{ modifiers: ["cmd"], key: "e" }}
              target={<EditTask task={task} projectDir={projectDir} onComplete={refresh} />}
            />
          )}
          <OpenBrowserAction projectDir={projectDir} projectName={projectName} />
          {task?.filePath && <Action.Open title="Open Task File" target={task.filePath} icon={Icon.Document} />}
          <Action.CopyToClipboard title="Copy Task ID" content={taskId} />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={refresh}
          />
          {task && (
            <ActionPanel.Section title="Set Status">
              {QUICK_STATUSES.filter((s) => s.value !== task.status.toLowerCase()).map((s) => (
                <Action
                  key={s.value}
                  title={s.title}
                  icon={s.icon}
                  onAction={async () => {
                    await setTaskStatus(taskId, s.value, projectDir);
                    refresh();
                  }}
                />
              ))}
            </ActionPanel.Section>
          )}
        </ActionPanel>
      }
    />
  );
}
