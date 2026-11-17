# Setup and operation

## Fresh installation

Use the commands in the [README](../README.md#run-locally). The project was developed on Windows with Node.js 24 and pnpm 11.25.0. Cross-platform commands are supplied, but macOS and Linux have not been verified in this review.

`pnpm install --frozen-lockfile` installs the locked dependency graph and generates the Prisma client through `postinstall`. Copy `.env.example` to `.env` before applying migrations. The default `DATABASE_URL="file:./practice.db"` resolves to `prisma/practice.db` through the Prisma schema.

`pnpm db:migrate` applies versioned migrations. `pnpm db:seed` replaces the synthetic dataset, including learning progress and implementation projects. A new seed contains 300 workers, 25 supervisory organizations, 360 positions, 40 pre-hires, 12 requisitions, and 10 pending approvals.

## Daily use

Run `pnpm dev` and visit `http://127.0.0.1:3000`. For an optimized local build:

```sh
pnpm build
pnpm start
```

Stop the server with Ctrl+C. Do not run development and production servers on the same port or build into a directory that an active server is using.

All seeded accounts use `Practice123!`. Choose the required role in the account selector. `hr` is the HR Administrator; `security` is the Security Administrator. Manager accounts have organization scopes. Select the manager assigned to the transaction instead of assuming any manager can approve it.

The account switch is a real sign-in change in Practice Lab. Inside Implementation Lab, sandbox identities are simulated personas within a project owned by the signed-in account. They do not create separate authenticated users. Friends who share a login also share that login's projects and progress.

Sessions expire after eight hours. Saved work remains in SQLite when the browser closes. Unsaved form edits do not.

## Share on a trusted network

Build the app, find the host computer's LAN IP, then bind the server to that address:

```sh
pnpm exec next start --hostname YOUR_LAN_IP --port 3002
```

On Windows, `ipconfig` shows the active Wi-Fi or Ethernet IPv4 address. Your friend opens `http://YOUR_LAN_IP:3002`. Their `localhost` refers to their own computer, not yours. Keep the host awake and the server running. If a firewall prompt appears, restrict access to the trusted private network. Do not enable router port forwarding for this demo.

HTTP LAN access is supported for synthetic practice. It does not encrypt credentials or session traffic. The [security review](security-review.md) explains the limits; a public service needs a different deployment and identity setup.

## Back up and reset

Stop every process using the practice database before copying it. Keep a backup of `prisma/practice.db` outside Git and record the application commit used with it. To restore, stop the app and replace the working database with that backup, then apply any required migrations before restarting. If SQLite sidecar files remain after shutdown, use SQLite's backup tooling instead of copying an inconsistent set of files.

`pnpm practice:reset` deliberately replaces all synthetic practice data. There is no application undo for a reset. A project portfolio download contains learning evidence; it is not a complete database backup or a supported restore file.

## Troubleshooting

| Symptom                                 | Check or action                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Browser cannot connect                  | Confirm the server is running and use the address printed in its terminal. Check the port and firewall for LAN access. |
| Port already in use                     | Stop the server you started on that port, or start this instance on a different port.                                  |
| Missing tables or Prisma client error   | Check `.env`, run `pnpm db:migrate`, and run `pnpm exec prisma generate`. Seed only if a reset is intended.            |
| Empty account selector on a new install | Run `pnpm db:seed` once after migration.                                                                               |
| Stale implementation project message    | Save or copy any unsaved notes, then use Refresh project. Another tab may have saved a newer version.                  |
| Approval missing                        | Check the pending step, current account, organization assignment, and process permission.                              |
| Report missing a worker                 | Check effective date and organization scope. Salary requires its own grant.                                            |
| Release blocked                         | Run current acceptance checks and inspect the missing Hire, conversion, exchange, or matching Test release evidence.   |
| Too many sign-in attempts               | Wait one minute. The local throttle limits attempts per account.                                                       |
| Browser tests fail to launch            | Install Google Chrome. Playwright uses the `chrome` channel and reserves port 3001.                                    |

For an update, back up the database first, pull the code, install with the frozen lockfile, apply migrations, and rebuild. Do not seed an existing database as part of a normal update.
