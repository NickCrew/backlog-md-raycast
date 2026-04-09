# Repository Guidelines

## Project Structure & Module Organization

This repository is a Raycast extension for managing Backlog.md tasks. Command entrypoints live in `src/` and map closely to the commands declared in `package.json`, for example `src/list-tasks.tsx`, `src/create-task.tsx`, and `src/search-tasks.tsx`. Shared CLI and preference logic lives in utility modules such as `src/backlog.ts` and `src/preferences.ts`. Static assets are stored in `assets/`, extension metadata lives in `metadata/`, and setup and usage notes belong in `README.md`.

## Build, Test, and Development Commands

- `npm run dev` starts `ray develop` for local extension development in Raycast.
- `npm run build` runs `ray build` and should pass before opening a PR.
- `npm run lint` runs Raycast's ESLint checks.
- `npm run fix-lint` applies safe lint fixes.
- `npm run publish` publishes to the Raycast Store; do not use `npm publish`.

Local validation is currently `npm run lint && npm run build`, followed by a manual smoke test in Raycast against at least one configured Backlog.md project.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation, double quotes, and a 120-character line width, matching `.prettierrc`. Keep command files in kebab-case to match Raycast command names, and keep exported helpers in camelCase. Prefer small, focused modules and shared helpers for CLI interaction and parsing.

When invoking the Backlog CLI, use argument arrays with `execFile` rather than shell interpolation. This extension executes user-configured binaries and project paths, so shell-safe process handling is required.

## Testing Guidelines

There is no dedicated automated test suite yet. For every change, run `npm run lint` and `npm run build`, then manually verify the affected command in Raycast. If you add automated tests, place them beside the source file as `*.test.ts` or `*.test.tsx` and keep them deterministic and CLI-mockable.

## Commit & Pull Request Guidelines

Follow Conventional Commits as seen in history, for example `fix(create-task): eliminate shell injection` and `feat(extension): initial Backlog.md Manager`. Keep commits atomic. Use `cortex git commit "<type>(scope): summary" <files...>` or `cortex git patch` for partial hunks; do not use broad staging.

PRs should include a short summary, linked issue or task when available, the exact validation commands run, and screenshots or short recordings for visible Raycast UI changes.
