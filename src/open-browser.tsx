import {
  Action,
  ActionPanel,
  closeMainWindow,
  Detail,
  Icon,
  open,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { ensureBrowserServer } from "./browser";
import { useActiveProject } from "./preferences";

type LaunchState =
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string; port: number; url: string }
  | { kind: "error"; message: string };

export default function Command() {
  const [activeProject, , config] = useActiveProject();
  const [knownPorts, setKnownPorts] = useCachedState<Record<string, number>>("browser-ports", {});
  const [state, setState] = useState<LaunchState>({
    kind: "loading",
    message: "Preparing Backlog browser...",
  });
  const [retryCount, setRetryCount] = useState(0);
  const knownPortsRef = useRef(knownPorts);

  useEffect(() => {
    knownPortsRef.current = knownPorts;
  }, [knownPorts]);

  const projectName = useMemo(
    () => config.projects.find((candidate) => candidate.path === activeProject)?.name ?? activeProject,
    [config.projects, activeProject],
  );

  useEffect(() => {
    let cancelled = false;
    let activeToast: Toast | undefined;

    async function launchBrowser() {
      if (!activeProject) {
        if (!cancelled) {
          setState({ kind: "error", message: "No active Backlog project is configured." });
        }
        return;
      }

      if (!cancelled) {
        setState({ kind: "loading", message: `Opening browser for ${projectName}...` });
      }

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Opening Backlog browser",
        message: projectName,
      });
      activeToast = toast;
      if (cancelled) return;

      try {
        const result = await ensureBrowserServer(activeProject, knownPortsRef.current[activeProject]);
        if (cancelled) return;

        setKnownPorts((current) => ({ ...(current ?? {}), [activeProject]: result.port }));

        toast.style = Toast.Style.Success;
        toast.title = result.reused ? "Opened existing Backlog browser" : "Started Backlog browser";
        toast.message = `${projectName} on :${result.port}`;

        setState({
          kind: "success",
          message: result.reused
            ? `Opened existing browser for ${projectName} on port ${result.port}.`
            : `Started browser for ${projectName} on port ${result.port}.`,
          port: result.port,
          url: result.url,
        });

        await open(result.url);
        if (cancelled) return;
        await closeMainWindow();
        if (cancelled) return;
        await showHUD(`Backlog browser: ${projectName} (${result.port})`);
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
  }, [activeProject, projectName, retryCount, setKnownPorts]);

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
