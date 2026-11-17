# Verification record

Review date: 17 November 2026. Environment: Windows, Node.js 24, pnpm 11.25.0, Google Chrome, Next.js 16.4.5. Results apply to the repository revision accompanying this document, not future dependency versions or deployments.

## Commands and results

| Check                                | Command                    | Result                                                        |
| ------------------------------------ | -------------------------- | ------------------------------------------------------------- |
| Route generation and type checking   | `pnpm typecheck`           | Passed                                                        |
| Service and utility regression tests | `pnpm test`                | 50 passed across five test files                              |
| Browser and API journeys             | `pnpm test:e2e`            | 28 passed; includes targeted accessibility and HTTP security checks                                      |
| Production compilation               | `pnpm build`               | Passed using isolated `.next-release` output                  |
| Production dependency advisories     | `pnpm audit --prod --json` | No reported advisories at review time                         |
| All dependency advisories            | `pnpm audit --json`        | One high-severity development dependency finding; exit code 1 |

The development finding is `picomatch` 4.0.7, [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). The advisory response reports no published patch. It is documented in the [risk register](security-review.md#open-risk-register), not suppressed or treated as a passing full audit.

## What the tests establish

The service suites exercise workflow transitions and persistence, including denied approvals, organization and ownership boundaries, salary projection, duplicate requests, immutable audit records, atomic import behavior, version conflicts, release requirements, and troubleshooting copies.

The security utility suite checks password salts and legacy verification, login-window expiry, cross-site request rejection, streamed JSON byte limits, and CSV formula handling. The HTTP test covers response headers, malformed credentials, cross-origin sign-in rejection, successful session use, and logout revocation.

Browser journeys cover native Hire and onboarding across practice accounts, Academy coaching and saved progress, implementation configuration and release, other HR tasks, navigation without login flashes, and the LAN-compatible request-key fallback. Selected views have automated axe checks, keyboard checks, and mobile layout assertions. This is not a complete accessibility conformance audit.

Service tests use `prisma/test.db`. The Playwright server applies migrations and seeds `prisma/e2e.db` on port 3001. Each suite owns its test database; neither resets `prisma/practice.db`.

## Failures found during this review

The first service run passed 44 of 45 tests. The absence test used November 2026 dates that had passed, so the application's future-date validation correctly rejected the request. The fixture now chooses a future Monday and derives the overlapping dates from it.

The first browser launch stopped because the installed Next.js 16.4.0 had a security advisory warning. The package audit identified five framework advisories. Updating to 16.4.5 removed those findings, and the production build passed after the update.

## Screenshot provenance

The overview, architecture map, and release screenshots show this original simulator with synthetic data from `tests/e2e/implementation.spec.ts` and `tests/implementation-fixture.ts`. They do not contain reference PDFs, vendor tenant screenshots, or real employee records. The banner is an original SVG stored alongside them.

## Limits

No coverage percentage, performance benchmark, macOS/Linux validation, independent penetration test, or complete WCAG conformance claim is made. Package audits detect known reported vulnerabilities in the resolved graph; they do not prove application security. See the security review for the threat model and untested failure conditions.
