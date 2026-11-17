# Development and AI assistance

The project owner requested a practical learning environment for a friend studying company configuration and preparing for interviews. Feedback shaped the guided Academy, chapter progress, sidebar explanations, LAN support, and the separate Implementation Lab.

OpenAI Codex assisted with code, schema design, tests, debugging, and documentation. The owner set the requirements and reviewed the experience through iterative feedback. This repository should be presented as an AI-assisted project; it does not imply that the owner wrote every line by hand or that the simulator proves professional Workday implementation experience.

The development workflow uses observable outcomes: inspect the code, make a change, run the relevant checks, exercise it in the browser, and record what remains incomplete. Tests include rejected operations and cross-account boundaries as well as successful tasks. Screenshots show the original application using synthetic fixtures.

## Working on the repository

Read [`AGENTS.md`](../AGENTS.md) before framework changes. The installed Next.js documentation is the reference for its APIs and conventions. Install from the lockfile and keep runtime data outside Git.

For a code change:

1. Identify the affected permission and persistence boundary.
2. Add a regression test when behavior, authorization, or stored outcomes change.
3. Run `pnpm typecheck` and the relevant service or browser tests.
4. Run the full suites and a production build before a release that changes authentication or shared workflows.
5. Update the handbook when setup, behavior, or limits change.

`pnpm test` uses `prisma/test.db`. Playwright starts its own server on port 3001 and seeds `prisma/e2e.db`. Avoid running simultaneous copies of the same suite against the same file.

For a useful bug report, include the current role, page, exact error, expected result, and shortest reproducible steps. Use fictional names and omit cookies, passwords, database files, and private source material. Follow [SECURITY.md](../SECURITY.md) for security concerns.

## Publication rules

The public `handbook/` contains original descriptions of application behavior. `docs/` and `research/` remain local and ignored because they may contain private or source-derived material. Do not force-add them. The same restriction applies to reference PDFs, user-supplied source screenshots, extracted indexes, environment files, and databases.

New public screenshots must come from the simulator with synthetic data. Review the image itself before committing it. Original diagrams and banners are acceptable; vendor logos and source-document pages are not part of the project's assets.
