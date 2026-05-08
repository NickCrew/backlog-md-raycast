import { List, ActionPanel, Action, Icon, Color, showToast, Toast, confirmAlert, Alert } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import { EditTaskLoader } from "./edit-task";
import { OpenBrowserAction } from "./open-browser";
import TaskDetail, { demoteTask, setTaskStatus } from "./task-detail";
import { getProjectName, useActiveProject } from "./preferences";
import { BacklogTaskSummary, listTaskSummaries } from "./backlog";

const STATUS_ICONS: Record<string, { icon: Icon; color: Color }> = {
  "to do": { icon: Icon.Circle, color: Color.SecondaryText },
  "in progress": { icon: Icon.CircleProgress50, color: Color.Blue },
  done: { icon: Icon.CheckCircle, color: Color.Green },
  blocked: { icon: Icon.XMarkCircle, color: Color.Red },
};

const PRIORITY_TAGS: Record<string, Color> = {
  high: Color.Red,
  medium: Color.Orange,
  low: Color.SecondaryText,
};

const FILTER_OPTIONS = ["All", "To Do", "In Progress", "Done", "Blocked"];
const PRIORITY_FILTERS = ["All", "High", "Medium", "Low"];

function groupTasksByStatus(tasks: BacklogTaskSummary[]): Record<string, BacklogTaskSummary[]> {
  return tasks.reduce<Record<string, BacklogTaskSummary[]>>((sections, task) => {
    sections[task.status] = sections[task.status] || [];
    sections[task.status].push(task);
    return sections;
  }, {});
}

export default function Command() {
  const [activeProject, setActiveProject, config] = useActiveProject();

  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const { isLoading, data, revalidate } = usePromise(
    async (cwd: string, status: string, priority: string) => {
      const tasks = await listTaskSummaries(cwd, { status, priority });
      return groupTasksByStatus(tasks);
    },
    [activeProject, statusFilter, priorityFilter],
    {
      execute: !!activeProject,
      onError: (error) => {
        showToast({ style: Toast.Style.Failure, title: "Failed to list tasks", message: error.message });
      },
    },
  );

  const sections = data || {};
  const projectName = getProjectName(config, activeProject);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Filter tasks..."
      searchBarAccessory={
        config.projects.length > 1 ? (
          <List.Dropdown
            tooltip="Switch Project"
            value={activeProject}
            onChange={(val) => {
              setActiveProject(val);
              setStatusFilter("All");
              setPriorityFilter("All");
            }}
          >
            {config.projects.map((p) => (
              <List.Dropdown.Item key={p.path} title={p.name} value={p.path} />
            ))}
          </List.Dropdown>
        ) : undefined
      }
    >
      {Object.entries(sections).map(([status, tasks]) => (
        <List.Section key={status} title={status} subtitle={`${tasks.length}`}>
          {tasks.map((task) => {
            const statusStyle = STATUS_ICONS[status.toLowerCase()] || {
              icon: Icon.Circle,
              color: Color.SecondaryText,
            };
            const priorityColor = PRIORITY_TAGS[task.priority] || Color.SecondaryText;

            return (
              <List.Item
                key={task.id}
                title={task.title}
                subtitle={task.id}
                icon={{ source: statusStyle.icon, tintColor: statusStyle.color }}
                accessories={[{ tag: { value: task.priority, color: priorityColor } }]}
                keywords={[task.id, task.priority, task.status]}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="View Details"
                      icon={Icon.Eye}
                      target={<TaskDetail taskId={task.id} projectDir={activeProject} onRefresh={revalidate} />}
                    />
                    <Action.Push
                      title="Edit Task"
                      icon={Icon.Pencil}
                      shortcut={{ modifiers: ["cmd"], key: "e" }}
                      target={<EditTaskLoader taskId={task.id} projectDir={activeProject} onComplete={revalidate} />}
                    />
                    <OpenBrowserAction projectDir={activeProject} projectName={projectName} />
                    <Action.CopyToClipboard title="Copy Task ID" content={task.id} />
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                      onAction={revalidate}
                    />
                    <Action
                      title="Demote to Draft"
                      icon={Icon.ArrowDown}
                      style={Action.Style.Destructive}
                      onAction={async () => {
                        const ok = await confirmAlert({
                          title: "Demote to draft?",
                          message: `${task.id} will be moved back to drafts and removed from the active task list.`,
                          primaryAction: { title: "Demote", style: Alert.ActionStyle.Destructive },
                        });
                        if (!ok) return;
                        await demoteTask(task.id, activeProject);
                        revalidate();
                      }}
                    />
                    <ActionPanel.Section title="Set Status">
                      {task.status.toLowerCase() !== "in progress" && (
                        <Action
                          title="Start (in Progress)"
                          icon={Icon.CircleProgress50}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
                          onAction={async () => {
                            await setTaskStatus(task.id, "in progress", activeProject);
                            revalidate();
                          }}
                        />
                      )}
                      {task.status.toLowerCase() !== "done" && (
                        <Action
                          title="Complete (Done)"
                          icon={Icon.CheckCircle}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
                          onAction={async () => {
                            await setTaskStatus(task.id, "done", activeProject);
                            revalidate();
                          }}
                        />
                      )}
                      {task.status.toLowerCase() !== "to do" && (
                        <Action
                          title="Move to to Do"
                          icon={Icon.Circle}
                          onAction={async () => {
                            await setTaskStatus(task.id, "to do", activeProject);
                            revalidate();
                          }}
                        />
                      )}
                      {task.status.toLowerCase() !== "blocked" && (
                        <Action
                          title="Mark Blocked"
                          icon={Icon.XMarkCircle}
                          onAction={async () => {
                            await setTaskStatus(task.id, "blocked", activeProject);
                            revalidate();
                          }}
                        />
                      )}
                    </ActionPanel.Section>
                    <ActionPanel.Section title="Filter by Status">
                      {FILTER_OPTIONS.map((s) => (
                        <Action
                          key={`status-${s}`}
                          title={`Status: ${s}`}
                          icon={statusFilter === s ? Icon.CheckCircle : Icon.Circle}
                          onAction={() => setStatusFilter(s)}
                        />
                      ))}
                    </ActionPanel.Section>
                    <ActionPanel.Section title="Filter by Priority">
                      {PRIORITY_FILTERS.map((p) => (
                        <Action
                          key={`priority-${p}`}
                          title={`Priority: ${p}`}
                          icon={priorityFilter === p ? Icon.CheckCircle : Icon.Circle}
                          onAction={() => setPriorityFilter(p)}
                        />
                      ))}
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      ))}
    </List>
  );
}
