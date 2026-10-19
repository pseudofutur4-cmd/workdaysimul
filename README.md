# workdaysimul · HCM Practice Lab

An independent, locally runnable HCM learning simulator with original application code and synthetic company data. Not affiliated with or endorsed by Workday. This Development Preview does not provide an official tenant, certification or complete product parity.

## Two learning modes

**Practice Lab:** use a fictional environment as HR, Manager or Employee. Practice Hire approvals and onboarding, staffing, recruiting, compensation, absence, benefits and learning, with saved data and audit history. The Academy offers eleven guided topics with numbered instructions and highlighted controls.

**Implementation Lab:** build a fictional company from an empty, isolated project. Eight chapters cover discovery, organizations, staffing, security, conditional Hire, worker conversion, reporting and simulated releases. Configuration changes drive a persistent company sandbox. Inspect the architecture map, diagnose faults in three troubleshooting copies, save interview explanations and download a synthetic implementation portfolio.

Project ownership follows the signed-in practice account. People sharing an account share its projects. Sandbox identities are explicit simulations inside a project. Existing seeded Practice Lab data remains separate.

## Run locally

Requirements: Node.js 24 and pnpm 11.25.0. No Workday account, paid service, source document or runtime internet connection is required.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

On macOS/Linux use `cp .env.example .env` instead of `Copy-Item`. Open [the local app](http://127.0.0.1:3000). Sign in as `hr` with the synthetic demo password `Practice123!`; the selector also lists Manager, Employee and other practice accounts.

For the implementation journey, select **Implementation Lab** in the header, create an empty project, and start Chapter 1. Save the foundation objects before referencing them in later chapters. Configure access and the Hire route, then use Company sandbox to submit and approve a Hire. Convert the sample workers, run a local exchange, and gather acceptance evidence before releasing configuration to simulated Test/Production.

## Checks and production build

```powershell
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm start
```

Browser tests use installed Google Chrome (`channel: chrome`). Service and browser tests use separate SQLite databases. Latest verification: **45 service tests and 27 browser regression tests passed**, including new implementation journeys, targeted axe/mobile checks, production build and local/LAN browser smoke. The final implementation-only browser rerun also passed 3/3 after scroll refinements.

SQLite practice data is stored at `prisma/practice.db`. Stop the server before copying it for backup. `pnpm practice:reset` deliberately replaces the synthetic practice data; use it only when you intend to reset progress and transactions.

To share a local production build on a trusted LAN, run it with your machine's current LAN address:

```powershell
pnpm build
pnpm exec next start --hostname YOUR_LAN_IP --port 3002
```

Your friend opens `http://YOUR_LAN_IP:3002`. Windows Firewall and your network configuration control access. The demo accounts and shared database are designed for local practice.

## Implemented boundaries

- Original reduced configuration editors and sequential workflows; no official Workday screen or tenant parity claim.
- Implementation configuration, Hire/worker outcomes, release snapshots, evidence and audit are persisted locally.
- Reports and local exchanges apply server-side scope, effective-date and field-permission checks.
- Integration examples generate local CSV/JSON; they do not contact third-party systems or reproduce EIB/Studio runtimes.
- Release tools promote configuration between simulated environments; they do not provision infrastructure or deploy to Workday.
- Interview response coverage and reflection prompts are learning aids, not expert correctness grading.

Public concept references include Workday's [organization setup considerations](https://doc.workday.com/admin-guide/en-us/manage-workday/organizations/ivq1568755825744.html), [business process setup considerations](https://doc.workday.com/admin-guide/en-us/manage-workday/business-processes/business-process-framework-concepts/khy1593557050505.html) and [deployment overview](https://community-content.workday.com/en-us/public/learn/resources/customer-deployment/launch-flex-overview.html). Application behavior and instructional tools are independently implemented teaching simplifications.

This public repository contains original code, tests, schema/migrations and setup instructions. Local research, source-derived documentation, private reference inputs, source images, extracted document indexes, environment secrets and databases are excluded. See LICENSE, DISCLAIMER and THIRD_PARTY_NOTICES.md.
