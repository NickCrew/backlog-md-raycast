import { Action, ActionPanel, Color, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import { listMilestones, Milestone } from "./milestones-data";

export function formatMilestoneOption(m: Milestone): string {
  return m.id !== m.title
    ? `${m.id} - ${m.title} (${m.doneCount}/${m.totalCount})`
    : `${m.title} (${m.doneCount}/${m.totalCount})`;
}

export default function MilestonePicker({
  projectDir,
  navigationTitle,
  actionTitle,
  onSelect,
}: {
  projectDir: string;
  navigationTitle: string;
  actionTitle: string;
  onSelect: (milestone: Milestone) => void;
}) {
  const { pop } = useNavigation();
  const [showCompleted, setShowCompleted] = useState(false);
  const { isLoading, data = [] } = usePromise(async (cwd: string) => listMilestones(cwd), [projectDir], {
    execute: !!projectDir,
    onError: (error) => {
      showToast({ style: Toast.Style.Failure, title: "Failed to load milestones", message: error.message });
    },
  });

  const visible = showCompleted ? data : data.filter((m) => !m.completed);
  const active = visible.filter((m) => !m.completed);
  const completed = visible.filter((m) => m.completed);

  const toggleAction = (
    <Action
      title={showCompleted ? "Hide Completed" : "Show Completed"}
      icon={showCompleted ? Icon.EyeDisabled : Icon.Eye}
      shortcut={{ modifiers: ["cmd"], key: "h" }}
      onAction={() => setShowCompleted((v) => !v)}
    />
  );

  return (
    <List isLoading={isLoading} navigationTitle={navigationTitle} searchBarPlaceholder="Search milestones...">
      <List.Section title="Active" subtitle={`${active.length}`}>
        {active.map((m) => (
          <MilestoneRow
            key={m.id}
            milestone={m}
            onSelect={() => {
              onSelect(m);
              pop();
            }}
            actionTitle={actionTitle}
            toggleAction={toggleAction}
          />
        ))}
      </List.Section>
      {showCompleted ? (
        <List.Section title="Completed" subtitle={`${completed.length}`}>
          {completed.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              onSelect={() => {
                onSelect(m);
                pop();
              }}
              actionTitle={actionTitle}
              toggleAction={toggleAction}
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function MilestoneRow({
  milestone,
  onSelect,
  actionTitle,
  toggleAction,
}: {
  milestone: Milestone;
  onSelect: () => void;
  actionTitle: string;
  toggleAction: React.ReactNode;
}) {
  const percent = milestone.totalCount > 0 ? Math.round((milestone.doneCount / milestone.totalCount) * 100) : 0;
  const progressColor = milestone.completed
    ? Color.Green
    : percent >= 75
      ? Color.Blue
      : percent >= 25
        ? Color.Yellow
        : Color.SecondaryText;

  return (
    <List.Item
      title={milestone.title}
      subtitle={milestone.id !== milestone.title ? milestone.id : undefined}
      icon={{
        source: milestone.completed ? Icon.CheckCircle : Icon.Bullseye,
        tintColor: progressColor,
      }}
      keywords={[milestone.id]}
      accessories={[
        { tag: { value: `${milestone.doneCount}/${milestone.totalCount}`, color: progressColor } },
        { text: `${percent}%` },
      ]}
      actions={
        <ActionPanel>
          <Action title={actionTitle} icon={Icon.Bullseye} onAction={onSelect} />
          {toggleAction}
        </ActionPanel>
      }
    />
  );
}
