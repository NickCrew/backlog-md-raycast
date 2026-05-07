import { Action, ActionPanel, List, showToast, Toast, useNavigation } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import { BacklogTaskSummary, listTaskSummaries } from "./backlog";

export function formatTaskOption(task: BacklogTaskSummary): string {
  const priority =
    task.priority && task.priority !== "none" ? task.priority[0].toUpperCase() + task.priority.slice(1) : undefined;
  const details = [task.status, priority].filter(Boolean).join(" · ");
  return details ? `${task.id} - ${task.title} (${details})` : `${task.id} - ${task.title}`;
}

export default function TaskPicker({
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
