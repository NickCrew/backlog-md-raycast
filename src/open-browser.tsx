import {
  Action,
  ActionPanel,
  closeMainWindow,
  Detail,
  Icon,
  LaunchProps,
  open,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import { ensureBrowserServer } from "./browser";
import { getProjectConfig, getProjectName, ProjectConfig, useActiveProject } from "./preferences";

type LaunchState =
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string; port: number; url: string }
  | { kind: "error"; message: string };

type OpenBrowserArguments = { projectName?: string };

// Returns the configured projects matching the query.
// - []        : nothing matches
// - [project] : exact match (preferred), or single substring match
// - [a, b...] : multiple substring matches — caller must surface the ambiguity
function resolveProjectByName(config: ProjectConfig, query: string): { path: string; name: string }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const exact = config.projects.find((p) => p.name.toLowerCase() === needle);
  if (exact) return [exact];
  return config.projects.filter((p) => p.name.toLowerCase().includes(needle));
}

export default function Command(props: LaunchProps<{ arguments: OpenBrowserArguments }>) {
  const [activeProject, , config] = useActiveProject();
  const requested = props.arguments?.projectName?.trim();

  if (requested) {
    const matches = resolveProjectByName(config, requested);

    if (matches.length === 0) {
      const available = config.projects.map((p) => p.name).join(", ") || "(none configured)";
      return (
        <Detail
          navigationTitle="Open Browser"
          markdown={`# Project not found\n\nNo configured project matches **${requested}**.\n\nAvailable projects: ${available}`}
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      );
    }

    if (matches.length > 1) {
      const candidates = matches.map((p) => `- **${p.name}**`).join("\n");
      return (
        <Detail
          navigationTitle="Open Browser"
          markdown={`# Multiple projects match\n\n**${requested}** matches more than one configured project. Be more specific:\n\n${candidates}`}
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      );
    }

    const match = matches[0];
    return <OpenBrowserView projectDir={match.path} projectName={match.name} />;
  }

  return <OpenBrowserView projectDir={activeProject} projectName={getProjectName(config, activeProject)} />;
}

export function OpenBrowserAction({ projectDir, projectName }: { projectDir: string; projectName?: string }) {
  return (
    <Action.Push
      title="Open Browser"
      icon={Icon.Globe}
      shortcut={{ modifiers: ["cmd"], key: "o" }}
      target={<OpenBrowserView projectDir={projectDir} projectName={projectName} />}
    />
  );
}

export function OpenBrowserView({
  projectDir,
  projectName: initialProjectName,
}: {
  projectDir?: string;
  projectName?: string;
}) {
  const config = getProjectConfig();
  const [knownPorts, setKnownPorts] = useCachedState<Record<string, number>>("browser-ports", {});
  const [state, setState] = useState<LaunchState>({
    kind: "loading",
    message: "Preparing Backlog browser...",
  });
  const [retryCount, setRetryCount] = useState(0);
  const knownPortsRef = useRef(knownPorts);
  const projectNameRef = useRef("");

  useEffect(() => {
    knownPortsRef.current = knownPorts;
  }, [knownPorts]);

  const effectiveProjectDir = projectDir ?? config.projects[0]?.path ?? "";
  const projectName = initialProjectName ?? getProjectName(config, effectiveProjectDir) ?? effectiveProjectDir;

  useEffect(() => {
    projectNameRef.current = projectName;
  }, [projectName]);

  useEffect(() => {
    let cancelled = false;
    let activeToast: Toast | undefined;

    async function launchBrowser() {
      if (!effectiveProjectDir) {
        if (!cancelled) {
          setState({ kind: "error", message: "No active Backlog project is configured." });
        }
        return;
      }

      if (!cancelled) {
        setState({ kind: "loading", message: `Opening browser for ${projectNameRef.current}...` });
      }

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Opening Backlog browser",
        message: projectNameRef.current,
      });
      activeToast = toast;
      if (cancelled) return;

      try {
        const result = await ensureBrowserServer(effectiveProjectDir, knownPortsRef.current[effectiveProjectDir]);
        if (cancelled) return;

        setKnownPorts((current) => ({ ...current, [effectiveProjectDir]: result.port }));

        toast.style = Toast.Style.Success;
        toast.title = result.reused ? "Opened existing Backlog browser" : "Started Backlog browser";
        toast.message = `${projectNameRef.current} on :${result.port}`;

        setState({
          kind: "success",
          message: result.reused
            ? `Opened existing browser for ${projectNameRef.current} on port ${result.port}.`
            : `Started browser for ${projectNameRef.current} on port ${result.port}.`,
          port: result.port,
          url: result.url,
        });

        await open(result.url);
        if (cancelled) return;
        await closeMainWindow();
        if (cancelled) return;
        await showHUD(`Backlog browser: ${projectNameRef.current} (${result.port})`);
      } catch (error) {
        if (cancelled) return;

        const message = error instanceof Error ? error.message : String(error);
        toast.style = Toast.Style.Failure;
        toast.title = "Failed to open Backlog browser";
        toast.message = message.split("\n")[0];
        setState({ kind: "error", message });
      }
    }

    launchBrowser();

    return () => {
      cancelled = true;
      void activeToast?.hide();
    };
  }, [effectiveProjectDir, retryCount, setKnownPorts]);

  const markdown = [
    "# Open Backlog Browser",
    projectName ? `Project: **${projectName}**` : "",
    state.kind === "loading" ? state.message : "",
    state.kind === "success" ? `${state.message}\n\nURL: ${state.url}` : "",
    state.kind === "error" ? `Failed to open browser.\n\n${state.message}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Detail
      isLoading={state.kind === "loading"}
      navigationTitle="Open Browser"
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Retry" icon={Icon.ArrowClockwise} onAction={() => setRetryCount((count) => count + 1)} />
          {state.kind === "success" ? <Action.OpenInBrowser title="Open Again" url={state.url} /> : null}
          {state.kind === "success" ? <Action.CopyToClipboard title="Copy URL" content={state.url} /> : null}
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            shortcut={{ modifiers: ["cmd"], key: "," }}
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    />
  );
}
