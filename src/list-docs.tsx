import { Action, ActionPanel, Detail, Icon, List, showToast, Toast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { DocSummary, listDocs, readDocFile } from "./docs-data";
import { OpenBrowserAction } from "./open-browser";
import { getProjectName, useActiveProject } from "./preferences";

export default function Command() {
  const [activeProject, setActiveProject, config] = useActiveProject();

  const { isLoading, data, revalidate } = usePromise(async (cwd: string) => listDocs(cwd), [activeProject], {
    execute: !!activeProject,
    onError: (error) => {
      showToast({ style: Toast.Style.Failure, title: "Failed to list docs", message: error.message });
    },
  });

  const docs = data ?? [];
  const projectName = getProjectName(config, activeProject);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Filter docs..."
      searchBarAccessory={
        config.projects.length > 1 ? (
          <List.Dropdown tooltip="Switch Project" value={activeProject} onChange={setActiveProject}>
            {config.projects.map((p) => (
              <List.Dropdown.Item key={p.path} title={p.name} value={p.path} />
            ))}
          </List.Dropdown>
        ) : undefined
      }
    >
      <List.Section title="Docs" subtitle={`${docs.length}`}>
        {docs.map((doc) => (
          <DocListItem
            key={doc.id}
            doc={doc}
            projectDir={activeProject}
            projectName={projectName}
            onRefresh={revalidate}
          />
        ))}
      </List.Section>
    </List>
  );
}

function DocListItem({
  doc,
  projectDir,
  projectName,
  onRefresh,
}: {
  doc: DocSummary;
  projectDir: string;
  projectName?: string;
  onRefresh: () => void;
}) {
  return (
    <List.Item
      title={doc.title}
      subtitle={doc.id}
      icon={Icon.Document}
      keywords={[doc.id]}
      actions={
        <ActionPanel>
          <Action.Push
            title="View Doc"
            icon={Icon.Eye}
            target={<DocDetail docId={doc.id} projectDir={projectDir} onRefresh={onRefresh} />}
          />
          <OpenBrowserAction projectDir={projectDir} projectName={projectName} />
          <Action.CopyToClipboard title="Copy Doc ID" content={doc.id} />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={onRefresh}
          />
        </ActionPanel>
      }
    />
  );
}

export function DocDetail({
  docId,
  projectDir,
  onRefresh,
}: {
  docId: string;
  projectDir: string;
  onRefresh?: () => void;
}) {
  const { isLoading, data, revalidate, error } = usePromise(
    async (id: string, cwd: string) => readDocFile(id, cwd),
    [docId, projectDir],
    {
      onError: (err) => {
        showToast({ style: Toast.Style.Failure, title: "Failed to load doc", message: err.message });
      },
    },
  );

  if (error) {
    return <Detail markdown={`# Error\n\n${error.message}`} navigationTitle={docId} />;
  }

  const markdown = data ? `# ${data.title}\n\n${data.body}` : isLoading ? "Loading..." : "";

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={data?.title ?? docId}
      markdown={markdown}
      metadata={
        data ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="ID" text={data.id} />
            {data.type ? <Detail.Metadata.Label title="Type" text={data.type} /> : null}
            {data.created ? <Detail.Metadata.Label title="Created" text={data.created} /> : null}
            <Detail.Metadata.Label title="File" text={data.filePath} />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          {data ? <Action.ShowInFinder path={data.filePath} /> : null}
          {data ? <Action.CopyToClipboard title="Copy Doc ID" content={data.id} /> : null}
          {data ? <Action.CopyToClipboard title="Copy File Path" content={data.filePath} /> : null}
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={() => {
              revalidate();
              onRefresh?.();
            }}
          />
        </ActionPanel>
      }
    />
  );
}
