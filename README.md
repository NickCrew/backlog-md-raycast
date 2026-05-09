# Backlog.md Manager

Manage your [Backlog.md](https://www.npmjs.com/package/backlog.md) tasks, milestones, and docs directly from Raycast. Browse, create, search, edit, manage milestones, and open the browser UI across multiple projects without leaving Raycast.

## Prerequisites

- **Backlog.md CLI** - install via `npm install -g backlog.md`
- At least one project initialized with `backlog init`

## Setup

On first launch, configure these extension preferences:

- **Project Directories** - comma-separated absolute paths to your Backlog.md projects, for example `/Users/you/Dev/ProjectA, /Users/you/Dev/ProjectB`. Tilde paths like `~/Dev/ProjectA` are also supported.
- **Backlog CLI Path** - absolute path to the `backlog` binary. It defaults to `/opt/homebrew/bin/backlog`.

## Commands

### List Tasks

Browse all tasks grouped by status (To Do, In Progress, Done, Blocked). Use the action panel to filter by status or priority. If you have multiple projects configured, switch between them with the dropdown in the search bar. The action panel also offers Demote to Draft to move an active task back into the drafts folder.

| Shortcut | Action                   |
| -------- | ------------------------ |
| `↵`      | View task details        |
| `⌘E`     | Edit task                |
| `⇧⌘S`    | Start task (In Progress) |
| `⇧⌘D`    | Complete task (Done)     |
| `⌘R`     | Refresh list             |

### Create Task

Create tasks with the full Raycast form. Pick a parent task, dependencies, and milestone through dedicated pickers (Command-Option-P for parent, Command-Shift-P for a dependency, Command-Option-M for milestone); add acceptance criteria (Command-Option-A) and Definition of Done items (Command-D); attach references and supporting documents through file pickers. Implementation plan, notes, and final summary are filled in by the agent that picks up the task — use Edit Task for those.

### Edit Task

Edit any field of an existing task from a pre-populated form:

- **Basic fields** — title, description, status, priority, labels, assignee
- **Acceptance Criteria & Definition of Done** — toggle existing items via checkboxes, mark items for removal via tag picker, and add new items inline (Command-Option-A / Command-D)
- **Dependencies** — add via the shared task picker (Command-Shift-P), remove the most recent (Option-Shift-P)
- **Milestone** — assign or change via picker (Command-Option-M); clear via the action panel
- **Plan, Notes, Final Summary** — Plan replaces in place. For Notes and Final Summary, you can either append a paragraph (preserves existing content) or replace the whole field

### Search Tasks

Full-text search across tasks. Results show status and priority at a glance and support the same detail, edit, and demote actions as the list command.

### List Docs

Browse the project's Backlog.md documents and read them with a metadata sidebar (ID, type, created date, file path). Open a doc in Finder or copy its ID directly from the action panel.

### Open Browser

Launch the Backlog.md browser UI for the current active project. The command reuses the last known live browser port for that project when possible, otherwise it prefers the project's configured `defaultPort` and falls back to a stable free port near the Backlog default. Pass an optional **Project Name** argument at launch to target a specific configured project regardless of the current active selection.

## Multi-Project Support

The extension remembers your last selected project across launches using Raycast's persistent cache. Switch projects from the dropdown in any list view, and Open Browser will follow the same active project on the next launch unless overridden by the launch argument.
