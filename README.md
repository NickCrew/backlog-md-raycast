# Backlog.md Manager

Manage your [Backlog.md](https://www.npmjs.com/package/backlog.md) tasks directly from Raycast. Browse, create, search, edit, change status, and open the browser UI across multiple projects without leaving Raycast.

## Prerequisites

- **Backlog.md CLI** - install via `npm install -g backlog.md`
- At least one project initialized with `backlog init`

## Setup

On first launch, configure these extension preferences:

- **Project Directories** - comma-separated absolute paths to your Backlog.md projects, for example `/Users/you/Dev/ProjectA, /Users/you/Dev/ProjectB`. Tilde paths like `~/Dev/ProjectA` are also supported.
- **Backlog CLI Path** - absolute path to the `backlog` binary. It defaults to `/opt/homebrew/bin/backlog`.

## Commands

### List Tasks

Browse tasks grouped by status with status and priority filters. Use Enter to view task details, Command-E to edit a task directly, Shift-Command-S to start a task, Shift-Command-D to complete a task, and Command-R to refresh.

### Create Task

Create tasks with the full Raycast form, including parent and dependency pickers, separate Plan / Implementation Notes / Final Summary fields, acceptance criteria, Definition of Done items, and file-backed references and documents.

### Search Tasks

Search tasks through the Backlog.md index. Results show status and priority at a glance, and support the same detail and edit flows as the list command.

### Open Browser

Launch the Backlog.md browser UI for the current active project. The command reuses the last known live browser port for that project when possible, otherwise it prefers the project's configured `defaultPort` and falls back to a stable free port near the Backlog default.

## Multi-Project Support

The extension remembers your last selected project across launches using Raycast's persistent cache. Switch projects from the dropdown in List, Search, or Create, and Open Browser will follow that same active project on the next launch.
