# Backlog.md Manager Changelog

## [Milestones, Docs & Editing Improvements] - {PR_MERGE_DATE}

### New Features

- **List Docs** — browse Backlog.md documents with a metadata sidebar (ID, type, created date, file path)
- **Milestone Picker** — assign milestones from Create Task and Edit Task, with progress tracking and active/completed filtering
- **Demote to Draft** — move active tasks back into the drafts folder from List and Search views
- **Open Browser launch argument** — pass an optional project name to target a specific configured project regardless of the active selection
- **Smart browser launcher** — reuses the last live port for a project when possible
- **Task-surface browser actions** — open the Backlog.md browser UI directly from the task list and detail views

### Improvements

- **Edit Task** — manage acceptance criteria and Definition of Done (toggle, add, remove via tag picker); pick dependencies via shared task picker; append or replace modes for Notes and Final Summary
- **Create Task** — parent, dependency, and milestone pickers (Command-Option-P, Command-Shift-P, Command-Option-M); streamlined to focus on definition fields, leaving Plan / Notes / Final Summary to the Edit Task flow
- **Task Detail** — shows additional Backlog.md fields in the metadata sidebar

### Fixes

- **Edit Task** — clearing priority to None no longer silently sends `--priority low`
- **Edit Task** — milestone change detection now compares on the resolved milestone id rather than the raw string from the task file, so a picked milestone whose title happens to match the original is no longer skipped
- **Create Task** — the Add Acceptance Criterion keyboard shortcut now works inside form fields (was Command-A, which collided with macOS text-field "Select All"; now Command-Option-A)
- **Open Browser** — when the project-name launch argument matches more than one configured project, the command now surfaces the ambiguous candidates instead of silently picking the first match

## [Initial Release] - 2026-04-28

### New

- **List Tasks** — browse tasks grouped by status with filtering by status and priority
- **Create Task** — full form with all CLI options, dynamic repeating fields, and drag-and-drop file attachments
- **Search Tasks** — full-text search across tasks ranked by relevance
- **Task Detail** — markdown view with metadata sidebar, labels, dependencies, and acceptance criteria
- **Edit Task** — modify title, description, status, priority, labels, assignee, and notes from a pre-populated form
- **Quick Status Changes** — set task status directly from the list or detail view via keyboard shortcuts
- **Multi-Project Support** — switch between multiple Backlog.md projects with the selection remembered across launches
