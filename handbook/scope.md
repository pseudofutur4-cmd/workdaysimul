# Capability boundaries

| Area                    | Implemented exercise                                                                       | Boundary                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Core staffing           | Hire approvals, worker creation, onboarding; additional staffing workflows in Practice Lab | Reduced sequential workflows, not the full vendor business-process framework       |
| Access                  | Role/domain policy, organization scope, salary restrictions, project ownership             | Local demo accounts; no enterprise identity federation or inherited security model |
| Academy                 | Eleven guided topics, five chapters, saved progress                                        | Teaching coverage varies by topic; some modules use reduced local exercises        |
| Implementation          | Eight chapters, one two-company brief, editable foundation and process settings            | Fixed sandbox roles and a deliberately bounded configuration schema                |
| Data conversion         | CSV mapping, validation, atomic import, reconciliation                                     | Small local batches; no vendor EIB runtime                                         |
| Reporting               | Worker projections by persona, scope, date, and salary grant                               | No general report designer or production analytics engine                          |
| Integrations and Studio | Local exercise results and CSV/JSON exchange                                               | No remote transport, real credentials, or Studio execution engine                  |
| Releases                | Acceptance evidence, configuration diff, Test/Production snapshots, restore                | No actual tenant provisioning, deployment pipeline, or infrastructure automation   |
| Interview preparation   | Eight saved responses and reflection prompts                                               | Response coverage is not expert grading or certification                           |
| Security                | Server authorization, session checks, audit controls, security regression tests            | Local practice deployment; remaining risks are documented separately               |

The interface uses original components with familiar enterprise task and navigation patterns. It does not reproduce an official tenant exactly. A real organization's setup depends on licensed product capabilities, its requirements, and implementation governance outside this simulator.

Country and currency choices are labels in the learning model. The app does not implement statutory payroll, tax, compliance advice, or currency conversion. Use synthetic data throughout.

Public conceptual references are linked in [`lib/implementation-catalog.ts`](../lib/implementation-catalog.ts). They provide background for learning topics; the behavior of this application is defined by its code and tests. The repository does not redistribute private source documents or proprietary assets.
