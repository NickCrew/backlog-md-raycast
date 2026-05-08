import { Form, ActionPanel, Action, showToast, Toast, Icon, useNavigation } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useEffect, useState } from "react";
import { loadTask, TaskData } from "./task-data";
import { BacklogTaskSummary, listTaskSummaries, runBacklog } from "./backlog";
import TaskPicker, { formatTaskOption } from "./task-picker";
import MilestonePicker, { formatMilestoneOption } from "./milestone-picker";
import { listMilestones, Milestone } from "./milestones-data";

const PRIORITIES = [
  { title: "None", value: "" },
  { title: "High", value: "high" },
  { title: "Medium", value: "medium" },
  { title: "Low", value: "low" },
];

const STATUSES = [
  { title: "To Do", value: "to do" },
  { title: "In Progress", value: "in progress" },
  { title: "Done", value: "done" },
  { title: "Blocked", value: "blocked" },
];

interface ChecklistEntry {
  index: number; // 1-based, matches the CLI's --check-ac/--remove-ac semantics
  checked: boolean;
  text: string;
}

function parseChecklist(lines: string[]): ChecklistEntry[] {
  return lines.map((raw, i) => {
    const m = raw.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    return {
      index: i + 1,
      checked: m ? m[1].toLowerCase() === "x" : false,
      text: m ? m[2] : raw.replace(/^-\s*/, ""),
    };
  });
}

export default function EditTask({
  task,
  projectDir,
  onComplete,
}: {
  task: TaskData;
  projectDir: string;
  onComplete?: () => void;
}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const acEntries = parseChecklist(task.acceptanceCriteria);
  const dodEntries = parseChecklist(task.definitionOfDone);

  const [acNewSlots, setAcNewSlots] = useState<string[]>([]);
  const [dodNewSlots, setDodNewSlots] = useState<string[]>([]);

  const [dependencyTasks, setDependencyTasks] = useState<BacklogTaskSummary[]>(() =>
    task.dependencies.map((id) => ({ id, title: id, priority: "", status: "" })),
  );

  // Enrich placeholder dependency entries (initially seeded with id-as-title) with
  // their real summaries once we've loaded the project's task list.
  const { data: allTasks } = usePromise(async (cwd: string) => listTaskSummaries(cwd), [projectDir], {
    execute: !!projectDir,
  });
  useEffect(() => {
    if (!allTasks) return;
    const byId = new Map(allTasks.map((t) => [t.id, t]));
    setDependencyTasks((current) => current.map((d) => byId.get(d.id) ?? d));
  }, [allTasks]);

  // Milestone: task.milestone is whatever string the file recorded — could be id or title.
  // Seed with a placeholder, then swap in the real Milestone object when the list loads.
  // Track the resolved original id separately so the change-detection at submit time
  // compares on identity rather than string-matching against id-or-title.
  const [milestone, setMilestone] = useState<Milestone | undefined>(() =>
    task.milestone
      ? { id: task.milestone, title: task.milestone, doneCount: 0, totalCount: 0, completed: false }
      : undefined,
  );
  const [originalMilestoneId, setOriginalMilestoneId] = useState<string | undefined>(() => task.milestone || undefined);
  const { data: allMilestones } = usePromise(async (cwd: string) => listMilestones(cwd), [projectDir], {
    execute: !!projectDir,
  });
  useEffect(() => {
    if (!allMilestones || !task.milestone) return;
    const match =
      allMilestones.find((m) => m.id === task.milestone) ?? allMilestones.find((m) => m.title === task.milestone);
    if (match) {
      setOriginalMilestoneId(match.id);
      // Only enrich if the user hasn't replaced the placeholder by picking a different milestone.
      setMilestone((current) => (current && current.id === task.milestone ? match : current));
    }
  }, [allMilestones, task.milestone]);

  async function handleSubmit(values: Record<string, unknown>) {
    setIsSubmitting(true);
    const args: string[] = ["task", "edit", task.id];
    const baseLength = args.length;

    const title = (values.title as string)?.trim();
    if (title && title !== task.title) {
      args.push("--title", title);
    }

    const status = values.status as string;
    if (status && status !== task.status.toLowerCase()) {
      args.push("--status", status);
    }

    const priority = values.priority as string;
    if (priority && priority !== task.priority) {
      args.push("--priority", priority);
    }

    const assignee = (values.assignee as string)?.trim();
    if (assignee !== (task.assignee || "")) {
      args.push("--assignee", assignee || "");
    }

    const labels = (values.labels as string)?.trim();
    const currentLabels = task.labels.join(", ");
    if (labels !== currentLabels) {
      args.push("--label", labels || "");
    }

    const description = (values.description as string)?.trim();
    if (description !== (task.description || "")) {
      args.push("--description", description || "");
    }

    const plan = (values.plan as string)?.trim();
    if (plan !== (task.implementationPlan || "")) {
      args.push("--plan", plan || "");
    }

    // For notes and final summary, append wins over replace when both are non-empty —
    // avoids the CLI seeing two conflicting flags for the same field.
    const notesAppend = (values.notesAppend as string)?.trim();
    const notesReplace = (values.notesReplace as string)?.trim();
    if (notesAppend) {
      args.push("--append-notes", notesAppend);
    } else if (notesReplace !== (task.notes || "")) {
      args.push("--notes", notesReplace || "");
    }

    const summaryAppend = (values.finalSummaryAppend as string)?.trim();
    const summaryReplace = (values.finalSummaryReplace as string)?.trim();
    if (summaryAppend) {
      args.push("--append-final-summary", summaryAppend);
    } else if (summaryReplace !== (task.finalSummary || "")) {
      args.push("--final-summary", summaryReplace || "");
    }

    const newDepIds = dependencyTasks.map((t) => t.id);
    const originalDepIds = task.dependencies;
    const depsChanged =
      newDepIds.length !== originalDepIds.length || newDepIds.some((id, i) => id !== originalDepIds[i]);
    if (depsChanged) {
      args.push("--depends-on", newDepIds.join(","));
    }

    // Milestone: compare on the resolved original id (set during enrichment) rather than
    // the raw task.milestone string, which may be an id-or-title that collides with another
    // milestone's title and silently skip a real change.
    if (!milestone && originalMilestoneId) {
      args.push("--clear-milestone");
    } else if (milestone && milestone.id !== originalMilestoneId) {
      args.push("--milestone", milestone.id);
    }

    const removedAcIndices = new Set((values.removeAc as string[] | undefined)?.map((s) => Number(s)) ?? []);
    const removedDodIndices = new Set((values.removeDod as string[] | undefined)?.map((s) => Number(s)) ?? []);

    for (const entry of acEntries) {
      if (removedAcIndices.has(entry.index)) continue;
      const checked = Boolean(values[`ac-${entry.index}`]);
      if (checked && !entry.checked) args.push("--check-ac", String(entry.index));
      else if (!checked && entry.checked) args.push("--uncheck-ac", String(entry.index));
    }
    for (const entry of dodEntries) {
      if (removedDodIndices.has(entry.index)) continue;
      const checked = Boolean(values[`dod-${entry.index}`]);
      if (checked && !entry.checked) args.push("--check-dod", String(entry.index));
      else if (!checked && entry.checked) args.push("--uncheck-dod", String(entry.index));
    }

    // Removals: descending so earlier-index removals don't shift later ones in the CLI
    [...removedAcIndices].sort((a, b) => b - a).forEach((i) => args.push("--remove-ac", String(i)));
    [...removedDodIndices].sort((a, b) => b - a).forEach((i) => args.push("--remove-dod", String(i)));

    for (let i = 0; i < acNewSlots.length; i++) {
      const text = (values[`ac-new-${i}`] as string)?.trim();
      if (text) args.push("--ac", text);
    }
    for (let i = 0; i < dodNewSlots.length; i++) {
      const text = (values[`dod-new-${i}`] as string)?.trim();
      if (text) args.push("--dod", text);
    }

    if (args.length === baseLength) {
      showToast({ style: Toast.Style.Success, title: "No changes to save" });
      setIsSubmitting(false);
      return;
    }

    args.push("--plain");

    try {
      await showToast({ style: Toast.Style.Animated, title: "Updating task..." });
      await runBacklog(args, projectDir);
      await showToast({ style: Toast.Style.Success, title: "Task updated", message: task.id });
      onComplete?.();
      pop();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await showToast({ style: Toast.Style.Failure, title: "Failed to update task", message: message.split("\n")[0] });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      navigationTitle={`Edit ${task.id}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Changes" icon={Icon.Check} onSubmit={handleSubmit} />
          <Action.Push
            title="Add Dependency"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
            target={
              <TaskPicker
                projectDir={projectDir}
                navigationTitle="Add Dependency"
                actionTitle="Add Dependency"
                excludedTaskIds={[task.id, ...dependencyTasks.map((d) => d.id)]}
                onSelect={(picked) => setDependencyTasks((current) => [...current, picked])}
              />
            }
          />
          {dependencyTasks.length > 0 ? (
            <Action
              title="Remove Last Dependency"
              icon={Icon.Minus}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["opt", "shift"], key: "p" }}
              onAction={() => setDependencyTasks((current) => current.slice(0, -1))}
            />
          ) : null}
          <Action.Push
            title={milestone ? "Change Milestone" : "Set Milestone"}
            icon={Icon.Bullseye}
            shortcut={{ modifiers: ["cmd", "opt"], key: "m" }}
            target={
              <MilestonePicker
                projectDir={projectDir}
                navigationTitle="Select Milestone"
                actionTitle="Use as Milestone"
                onSelect={(m) => setMilestone(m)}
              />
            }
          />
          {milestone ? (
            <Action
              title="Clear Milestone"
              icon={Icon.Minus}
              style={Action.Style.Destructive}
              onAction={() => setMilestone(undefined)}
            />
          ) : null}
          <Action
            title="Add Acceptance Criterion"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["cmd", "opt"], key: "a" }}
            onAction={() => setAcNewSlots((slots) => [...slots, ""])}
          />
          <Action
            title="Add Definition of Done Item"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["cmd"], key: "d" }}
            onAction={() => setDodNewSlots((slots) => [...slots, ""])}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" defaultValue={task.title} />
      <Form.TextArea id="description" title="Description" defaultValue={task.description} />
      <Form.Separator />
      <Form.Dropdown id="status" title="Status" defaultValue={task.status.toLowerCase()}>
        {STATUSES.map((s) => (
          <Form.Dropdown.Item key={s.value} title={s.title} value={s.value} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="priority" title="Priority" defaultValue={task.priority}>
        {PRIORITIES.map((p) => (
          <Form.Dropdown.Item key={p.value} title={p.title} value={p.value} />
        ))}
      </Form.Dropdown>
      <Form.TextField id="labels" title="Labels" defaultValue={task.labels.join(", ")} />
      <Form.TextField id="assignee" title="Assignee" defaultValue={task.assignee} />

      <Form.Separator />
      <Form.Description
        key={`deps-${dependencyTasks.map((t) => t.id).join(",") || "none"}`}
        title="Depends On"
        text={
          dependencyTasks.length > 0
            ? dependencyTasks.map((d) => `- ${formatTaskOption(d)}`).join("\n")
            : "None. ⌘⇧P, or use Add Dependency from the actions menu."
        }
      />
      <Form.Description
        key={`milestone-${milestone?.id ?? "none"}`}
        title="Milestone"
        text={milestone ? formatMilestoneOption(milestone) : "None. ⌘⌥M, or use Set Milestone from the actions menu."}
      />

      <Form.Separator />
      <Form.Description text="Acceptance Criteria  ⌘⌥A to add" />
      {acEntries.map((entry) => (
        <Form.Checkbox
          key={`ac-${entry.index}`}
          id={`ac-${entry.index}`}
          title={`AC ${entry.index}`}
          label={entry.text}
          defaultValue={entry.checked}
        />
      ))}
      {acEntries.length > 0 ? (
        <Form.TagPicker id="removeAc" title="Remove" placeholder="Select criteria to delete">
          {acEntries.map((entry) => (
            <Form.TagPicker.Item
              key={`ac-rm-${entry.index}`}
              value={String(entry.index)}
              title={`AC ${entry.index}: ${entry.text}`}
            />
          ))}
        </Form.TagPicker>
      ) : null}
      {acNewSlots.map((_, i) => (
        <Form.TextField key={`ac-new-${i}`} id={`ac-new-${i}`} title={`New AC ${i + 1}`} placeholder="Criterion..." />
      ))}

      <Form.Separator />
      <Form.Description text="Definition of Done  ⌘D to add" />
      {dodEntries.map((entry) => (
        <Form.Checkbox
          key={`dod-${entry.index}`}
          id={`dod-${entry.index}`}
          title={`DoD ${entry.index}`}
          label={entry.text}
          defaultValue={entry.checked}
        />
      ))}
      {dodEntries.length > 0 ? (
        <Form.TagPicker id="removeDod" title="Remove" placeholder="Select items to delete">
          {dodEntries.map((entry) => (
            <Form.TagPicker.Item
              key={`dod-rm-${entry.index}`}
              value={String(entry.index)}
              title={`DoD ${entry.index}: ${entry.text}`}
            />
          ))}
        </Form.TagPicker>
      ) : null}
      {dodNewSlots.map((_, i) => (
        <Form.TextField
          key={`dod-new-${i}`}
          id={`dod-new-${i}`}
          title={`New DoD ${i + 1}`}
          placeholder="Done criterion..."
        />
      ))}

      <Form.Separator />
      <Form.TextArea id="plan" title="Plan" defaultValue={task.implementationPlan} info="Replaces existing plan" />
      <Form.TextArea
        id="notesAppend"
        title="Append Notes"
        placeholder="Add a paragraph to the existing notes..."
        info="Appended to existing notes. Preferred for in-progress updates."
      />
      <Form.TextArea
        id="notesReplace"
        title="Replace Notes"
        defaultValue={task.notes}
        info="Replaces all existing notes. Ignored if Append Notes is filled."
      />
      <Form.TextArea
        id="finalSummaryAppend"
        title="Append Final Summary"
        placeholder="Add to the final summary..."
        info="Appended to existing summary."
      />
      <Form.TextArea
        id="finalSummaryReplace"
        title="Replace Final Summary"
        defaultValue={task.finalSummary}
        info="Replaces existing summary. Ignored if Append Final Summary is filled."
      />
    </Form>
  );
}

export function EditTaskLoader({
  taskId,
  projectDir,
  onComplete,
}: {
  taskId: string;
  projectDir: string;
  onComplete?: () => void;
}) {
  const { isLoading, data, error, revalidate } = usePromise(
    async (id: string, cwd: string) => loadTask(id, cwd),
    [taskId, projectDir],
    {
      onError: (error) => {
        showToast({ style: Toast.Style.Failure, title: "Failed to load task", message: error.message });
      },
    },
  );

  if (error) {
    return (
      <Form
        navigationTitle={`Edit ${taskId}`}
        actions={
          <ActionPanel>
            <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
          </ActionPanel>
        }
      >
        <Form.Description title="Unable to Load Task" text={error.message} />
      </Form>
    );
  }

  if (isLoading || !data) {
    return (
      <Form isLoading={isLoading} navigationTitle={`Edit ${taskId}`}>
        <Form.Description title="Loading" text="Loading task details..." />
      </Form>
    );
  }

  return <EditTask task={data} projectDir={projectDir} onComplete={onComplete} />;
}
