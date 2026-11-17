# Security review

Review date: 17 November 2026. Scope: this repository's local application, API handlers, workflow services, database controls, and dependency graph. The review combines source inspection, package advisory queries, service regression tests, and browser/API tests.

This is an AI-assisted self-assessment. It is not an independent penetration test, ISO certification, or proof that every vulnerability has been found. The review uses [OWASP Top 10:2025](https://top10.owasp.org/2025/) for application risk categories. [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) informs the risk-management discussion; that standard concerns an organization's information security management system, which a code review cannot certify.

## Intended use and trust boundaries

The supported use case is a local machine or trusted practice network containing synthetic records. The browser is untrusted: selecting a role or hiding a control is not authorization. API routes resolve the session, and services check permissions, scope, and project ownership before acting.

The operating system user and database administrator are trusted. They can read or replace SQLite files, modify code, and bypass application controls. Practice accounts are public demo identities with a shared password. The pre-login account list is intentional. The simulator does not authenticate a real person's identity.

Assets include saved learning work, project configuration, session tokens, synthetic worker data, and audit history. Credible failure cases include cross-project access, unauthorized approval, salary disclosure, duplicate completion, stale writes, malformed imports, session misuse, and loss of the local database.

## Findings and changes

| Finding                                                                            | Treatment                                                                                                       | Evidence                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Next.js 16.4.0 had five reported advisories, including critical findings           | Updated to 16.4.5 and changed the lockfile                                                                      | Package audit and production build; see verification    |
| Password hashes used one fixed salt                                                | New hashes use a random 16-byte salt with scrypt; successful legacy sign-ins migrate the stored hash            | `lib/password.ts`, session route, security service test |
| Sign-in lacked a throttle and malformed JSON could escape the normal response path | Added a bounded per-account attempt window, strict credential lengths, and a controlled 400 response            | `lib/login-limit.ts`, session route, security tests     |
| Mutation bodies were read without an application size limit                        | Added streamed byte limits: 4 KiB for sign-in and 1 MiB for other JSON mutations                                | `lib/request-json.ts`, route handlers, byte-count tests |
| Browser defenses were incomplete                                                   | Added anti-framing, MIME sniffing, referrer, permissions, and limited CSP headers; API responses use `no-store` | `next.config.ts`, HTTP regression test                  |
| Cross-site fetch metadata was not considered                                       | Reject `Sec-Fetch-Site: cross-site` as well as mismatched Origin                                                | `lib/origin.ts`, negative request tests                 |
| CSV formula protection differed between exports and missed some prefixes           | Shared cell escaping neutralizes formula markers, leading whitespace, and control-character prefixes            | `lib/csv.ts`, both export paths, regression test        |

The framework advisory IDs returned by the package audit were `GHSA-2464-fhr4-w9xw`, `GHSA-p3m5-59mp-jv5r`, `GHSA-673q-mjm6-r5xr`, `GHSA-mfr8-8qww-v76h`, and `GHSA-vc7v-qv4w-wrv8`. The update removes those findings from the installed graph. This does not assert that each vulnerable feature was reachable in this application.

## OWASP Top 10:2025 mapping

The status describes evidence and limits, not a category certification or a universal pass.

| Category                                   | Checks and implemented controls                                                                                                     | Remaining limit                                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control                  | Negative role and organization tests; project ownership; employee self-access; report salary projection; cross-site mutation checks | Sandbox personas are owner-controlled simulations. Shared logins share projects. Requests without Origin remain allowed for non-browser clients.                                      |
| A02 Security Misconfiguration              | Localhost default; ignored environment files; security headers; generic route errors                                                | LAN HTTP remains supported. No hardened reverse proxy or deployment configuration is supplied. CSP restricts framing, objects, base URLs, and forms, but is not a full script policy. |
| A03 Software Supply Chain Failures         | Frozen lockfile, package audit, patched Next.js, review of tracked publication files                                                | One high-severity development dependency advisory remains; details below. No independent dependency provenance audit was performed.                                                   |
| A04 Cryptographic Failures                 | Random session tokens, SHA-256 token storage, per-password scrypt salts, timing-safe digest comparison                              | SQLite is unencrypted. HTTP does not protect network traffic. Legacy hashes remain until the next successful login or reset.                                                          |
| A05 Injection                              | Zod validation, Prisma queries, React text rendering, CSV formula neutralization, bounded CSV parser                                | No exhaustive fuzzing or spreadsheet-client compatibility study. Fixed raw SQL is used for migrations and audit triggers, not interpolated user input.                                |
| A06 Insecure Design                        | Configuration snapshots, unique request keys, state checks, release evidence, atomic completion, validation before import           | Fixed demo roles and shared credentials are a teaching design, not a production identity model.                                                                                       |
| A07 Authentication Failures                | Expiring HttpOnly/SameSite sessions, logout revocation, credential validation, per-account throttling                               | No MFA, personal registration, password recovery, or distributed rate limit. Local HTTP cookies cannot be Secure.                                                                     |
| A08 Software or Data Integrity Failures    | Project version conflicts, unique constraints, transaction rollback, configuration hashes, immutable audit triggers                 | Host administrators can alter the database and audit controls. No signed releases or external audit anchoring.                                                                        |
| A09 Security Logging and Alerting Failures | Mutation audit trails and several denied-operation audit paths are tested                                                           | No centralized alerts or comprehensive authentication-event monitoring. Console errors are local diagnostics, not an incident-response system.                                        |
| A10 Mishandling of Exceptional Conditions  | Malformed credential tests, bounded request parsing, all-or-nothing imports, rejected duplicate actions and stale writes            | No sustained load, slow-client, disk-full, process-crash, or recovery fault-injection campaign.                                                                                       |

## Open risk register

Severity reflects potential impact outside the intended local practice setting. These risks remain open; listing a mitigation is not evidence that it has been implemented.

| ID  | Risk                                                                                                                                    | Current restriction or mitigation                                                                                              | Required follow-up                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| R1  | High: shared demo credentials and discoverable accounts allow anyone with network access to assume a role                               | Synthetic data; local or trusted-network use                                                                                   | Replace demo identity with personal accounts and appropriate MFA before public hosting                |
| R2  | High: HTTP and an unencrypted database expose data to network or host access                                                            | Restrict the network and filesystem; avoid real data                                                                           | Enforce TLS, trusted proxy configuration, secure cookies, and storage protection for a hosted service |
| R3  | High advisory in development tooling: `picomatch` 4.0.7 ReDoS, [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | Reached through Vitest/Vite tooling; no app endpoint accepts user-supplied glob patterns. Run tooling only with trusted inputs | Audit response reports no published patch. Recheck when updating tooling; full audit remains nonzero  |
| R4  | Moderate: per-account throttling is local to one process, can be bypassed across instances, and can temporarily deny a known account    | One-minute window and bounded map; single local server                                                                         | Shared rate-limit store, broader abuse controls, asynchronous password work, monitoring               |
| R5  | Moderate: local audit records and backups depend on the host owner                                                                      | SQL audit triggers; documented stop-and-backup procedure                                                                       | External logs, restore drills, retention policy, incident ownership                                   |
| R6  | Moderate: request byte limits do not bound slow uploads, request frequency, or total accumulated records                                | Local deployment; small exercise imports; project count limit                                                                  | Proxy timeouts, resource quotas, load tests, storage monitoring                                       |
| R7  | Moderate: limited CSP does not restrict script execution                                                                                | React escapes ordinary text; no inspected user-controlled HTML injection path                                                  | Nonce-based script policy and a broader XSS review before hostile public use                          |

## ISO/IEC 27001-informed control review

This is a project-level mapping of control themes, not a Statement of Applicability or a clause-by-clause conformance audit. No claim is made to implementing all Annex A controls. The full licensed standard was not used as a certification checklist.

| Control theme                          | Repository evidence                                                                 | Organizational work still required                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Scope and asset ownership              | Local-demo boundary, source map, synthetic-data policy                              | Named service and information owners; formal ISMS scope                        |
| Risk assessment and treatment          | Findings and open risk register above                                               | Approved risk criteria, assigned owners, due dates, and acceptance decisions   |
| Access management                      | Server policies, project ownership, session expiry, negative access tests           | Joiner/mover/leaver procedures, personal identities, periodic access review    |
| Secure development and change control  | Versioned migrations, locked dependencies, service/browser tests, documented review | Independent review policy, protected releases, controlled production promotion |
| Vulnerability management               | Dated dependency audit and tracked unresolved advisory                              | Monitoring cadence, remediation targets, escalation process                    |
| Logging and incident management        | Audit events and reporting instructions in SECURITY.md                              | Alerting, incident roles, response exercises, retention decisions              |
| Backup and continuity                  | Local backup and restore instructions                                               | Scheduled protected backups, tested recovery objectives, continuity plan       |
| Supplier and information handling      | Third-party notices, excluded private inputs, original public assets                | Supplier assessments and organizational handling agreements                    |
| Performance evaluation and improvement | Reproducible tests and dated review record                                          | Management review, independent internal audit, corrective-action tracking      |

## Reproduce the review

Run the commands in [verification](verification.md). Inspect `tests/security.test.ts`, `tests/e2e/security.spec.ts`, and the negative authorization cases in the existing workflow suites. Re-run dependency checks at the time of use; an advisory database is a dated source, not a permanent guarantee.

No external system was attacked or scanned. The review did not include an independent DAST scanner, production penetration testing, or formal ISO assessment.
