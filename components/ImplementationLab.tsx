"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Coach from "./Coach";
import {
  implementationChapters,
  implementationSources,
  previewActors,
  previewRoles,
  recommendedObjects,
  defaultMapping,
  sampleWorkerCsv,
  type ImplementationConfig,
  type SandboxHireInput,
} from "@/lib/implementation-catalog";
import { newRequestKey } from "@/lib/request-key";

type Row = Record<string, any>;
type Project = Row & {
  id: string;
  name: string;
  version: number;
  config: ImplementationConfig;
};
type Command = (c: Row, message?: string) => Promise<any>;
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const objectNames = {
  companies: "Companies",
  locations: "Locations",
  costCenters: "Cost centers",
  orgs: "Supervisory organizations",
  profiles: "Job profiles",
  positions: "Positions",
};
const explanation: Record<string, string> = {
  companies:
    "Legal entities support legal reporting. This exercise uses fictional France and Sweden companies.",
  locations:
    "Locations describe where work takes place. A location is separate from a management hierarchy.",
  costCenters:
    "Cost centers belong to a company and provide a costing dimension independent of a manager.",
  orgs: "Build one root and a child. Each organization has one staffing model; use one example of each model for this capstone.",
  profiles:
    "A job profile describes a type of work and belongs to a job family.",
  positions:
    "A seat belongs to a Position Management organization and references a job profile and location.",
};
const labels: Record<string, string> = {
  id: "Reference ID",
  name: "Name",
  country: "Country",
  currency: "Currency",
  companyId: "Company",
  costCenterId: "Cost center",
  parentId: "Superior organization",
  staffing: "Staffing model",
  family: "Job family",
  orgId: "Supervisory organization",
  profileId: "Job profile",
  locationId: "Location",
};
export default function ImplementationLab({
  path,
  userId,
  permitted,
}: {
  path: string;
  userId: string;
  permitted: boolean;
}) {
  const router = useRouter(),
    id = path.split("/")[2],
    section = path.split("/")[3] ?? "brief";
  const [projects, setProjects] = useState<Row[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [draft, setDraft] = useState<ImplementationConfig | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [guide, setGuide] = useState(false);
  const pauseGuide = useCallback(() => setGuide(false), []);
  useEffect(() => {
    if (!guide) window.scrollTo({ top: 0, behavior: "instant" });
    setNotice("");
    setError("");
  }, [section]);
  const guard = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const refresh = useCallback(
    async (replaceDraft = false) => {
      const r = await fetch(
        "/api/implementation" + (id ? "?id=" + encodeURIComponent(id) : ""),
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (!mounted.current) return;
      if (id) {
        setProject(d);
        setDraft((old) => (replaceDraft || !old ? clone(d.config) : old));
      } else setProjects(d.projects);
      setLoading(false);
    },
    [id],
  );
  useEffect(() => {
    if (permitted)
      refresh().catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [refresh, permitted]);
  const command: Command = async (
    command,
    message = "Saved to your implementation project.",
  ) => {
    if (!project || guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/implementation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, version: project.version, command }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await refresh(command.action === "save" || command.action === "restore");
      if (mounted.current) setNotice(message);
      return d.result;
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
      throw e;
    } finally {
      guard.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const safely = (c: Row, message?: string) =>
    command(c, message).catch(() => undefined);
  const save = (c: ImplementationConfig) =>
    command({ action: "save", config: c });
  if (!permitted)
    return (
      <section className="impl-page">
        <h1>Implementation Lab</h1>
        <p>This practice account does not have access to the learning lab.</p>
      </section>
    );
  if (!id)
    return (
      <div className="impl-page">
        <section className="impl-hero">
          <div>
            <span className="impl-kicker">
              IMPLEMENTATION LAB · FROM REQUIREMENTS TO RELEASE
            </span>
            <h1>
              Build the environment.
              <br />
              Understand every decision.
            </h1>
            <p>
              A fictional client. An empty project. A company you configure,
              test, and bring to life.
            </p>
            <div className="impl-hero-tags">
              <span>8 practical chapters</span>
              <span>Isolated company sandbox</span>
              <span>Interview preparation</span>
            </div>
          </div>
          <div className="impl-architecture-mini" aria-hidden="true">
            <span>CLIENT REQUIREMENTS</span>
            <b>Organizations</b>
            <div>
              <b>Security</b>
              <b>Staffing</b>
            </div>
            <b>Business processes</b>
            <span>TEST → VALIDATE → RELEASE</span>
          </div>
        </section>
        <div className="impl-start-grid">
          <section className="impl-card">
            <span className="impl-kicker">YOUR FIRST ENGAGEMENT</span>
            <h2>Vale Works: build a company</h2>
            <p>
              Design an HCM environment for a fictional 250-person group
              expanding across France and Sweden. Your first milestone: hire its
              first new colleague through the process you configured.
            </p>
            <ul>
              <li>Two legal entities and a coherent organization hierarchy</li>
              <li>
                Position and Job Management, scoped roles and separate
                permissions
              </li>
              <li>
                Conditional approvals, onboarding, conversion and release
                evidence
              </li>
            </ul>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (guard.current) return;
                guard.current = true;
                setBusy(true);
                setError("");
                try {
                  const name = String(
                    new FormData(e.currentTarget).get("name"),
                  );
                  const r = await fetch("/api/implementation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "create", name }),
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  router.push(`/implementation/${d.result.id}/brief`);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  guard.current = false;
                  setBusy(false);
                }
              }}
            >
              <label>
                Project name
                <input
                  name="name"
                  required
                  minLength={3}
                  maxLength={80}
                  defaultValue="Vale Works — my implementation"
                />
              </label>
              <button className="primary" disabled={busy}>
                Create empty project →
              </button>
            </form>
          </section>
          <section className="impl-card">
            <span className="impl-kicker">PICK UP WHERE YOU LEFT OFF</span>
            <h2>Your implementation projects</h2>
            <p>
              Saved for this practice account. People sharing an account also
              share its projects. Each project has its own configuration,
              workers, releases and history.
            </p>
            {loading ? (
              <p role="status">Loading projects…</p>
            ) : projects.length ? (
              <div className="impl-project-list">
                {projects.map((p) => (
                  <Link href={`/implementation/${p.id}/brief`} key={p.id}>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        Saved revision {p.version} ·{" "}
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </small>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="impl-empty">
                Your first project starts with no configured company or worker.
              </p>
            )}
            <p className="impl-boundary">
              Independent configuration simulator. Existing Practice Lab data
              stays separate. No official tenant is provisioned.
            </p>
          </section>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <section className="impl-card">
          <h2>Your implementation path</h2>
          <div className="impl-path-preview">
            {implementationChapters.map((ch, i) => (
              <div key={ch.id}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>{ch.title}</strong>
                <small>{ch.objective}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  if (!project || !draft)
    return (
      <section className="impl-page" aria-busy={loading}>
        <h1>Implementation Lab</h1>
        {error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <Link href="/implementation">Return to projects</Link>
          </>
        ) : (
          <p role="status">Opening your implementation project…</p>
        )}
      </section>
    );
  const dirty = JSON.stringify(draft) !== JSON.stringify(project.config);
  const chapter = implementationChapters.find((c) => c.id === section),
    chapterIndex = implementationChapters.findIndex((c) => c.id === section);
  const completed = project.chapters.filter((c: Row) => c.complete).length;
  const nav = (target: string) => `/implementation/${id}/${target}`;
  const guideIndex = Math.min(15, project.guideStep);
  const guideChapter = implementationChapters[Math.floor(guideIndex / 2)];
  const guideOnTask = guide && section === guideChapter.id;
  const guideSelector =
    guideIndex % 2 === 0
      ? `[data-impl="chapter-${guideChapter.id}"]`
      : `[data-impl="task-${guideChapter.id}"]`;
  const guideReady = () =>
    !!document.querySelector(guideSelector) &&
    (guideIndex % 2 === 0 ||
      project.chapters[Math.floor(guideIndex / 2)]?.complete);
  return (
    <div className="impl-page impl-project">
      <div className="impl-project-heading">
        <div>
          <Link href="/implementation" className="impl-back">
            ← All projects
          </Link>
          <span className="impl-kicker">
            VALE WORKS · IMPLEMENTATION ENGAGEMENT
          </span>
          <h1>{project.name}</h1>
          <p>
            {completed} / 8 chapters evidenced <span>·</span> Development
            revision {project.version} <span>·</span>{" "}
            {dirty ? "Unsaved changes" : "All configuration saved"}
          </p>
        </div>
        <div className="impl-project-actions">
          <label>
            Learning mode
            <select
              aria-label="Implementation learning mode"
              value={project.learningMode}
              disabled={busy}
              onChange={(e) => {
                setGuide(false);
                safely({
                  action: "progress",
                  mode: e.target.value,
                  step: project.guideStep,
                });
              }}
            >
              <option>Guided</option>
              <option>Independent</option>
              <option>Assessment</option>
            </select>
          </label>
          <button
            disabled={busy}
            onClick={() => {
              if (
                !dirty ||
                confirm(
                  "Load the latest saved configuration? Unsaved configuration edits will be replaced.",
                )
              )
                refresh(true).catch((e) => setError(e.message));
            }}
          >
            Refresh project
          </button>
        </div>
      </div>
      <div
        className="impl-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={8}
        aria-valuenow={completed}
        aria-label={`${completed} of 8 chapters evidenced`}
      >
        <span style={{ width: `${(completed / 8) * 100}%` }} />
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button
            aria-label="Dismiss implementation error"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="impl-workspace">
        <aside className="impl-chapter-nav">
          <span className="impl-kicker">IMPLEMENTATION PATH</span>
          <nav aria-label="Implementation chapters">
            {project.chapters.map((ch: Row, i: number) => (
              <Link
                href={nav(ch.id)}
                aria-current={section === ch.id ? "step" : undefined}
                key={ch.id}
              >
                <span
                  className={
                    ch.complete
                      ? "impl-chapter-number done"
                      : "impl-chapter-number"
                  }
                >
                  {ch.complete ? "✓" : String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{ch.short}</strong>
                  <small>
                    {ch.complete ? "Evidence recorded" : "To build"}
                  </small>
                </span>
              </Link>
            ))}
          </nav>
          <div className="impl-tools-nav">
            <span className="impl-kicker">YOUR WORKBENCH</span>
            {[
              ["blueprint", "Architecture map"],
              ["sandbox", "Company sandbox"],
              ["interview", "Interview room"],
              ["troubleshooting", "Troubleshooting"],
              ["evidence", "Evidence & history"],
            ].map(([key, label]) => (
              <Link
                href={nav(key)}
                aria-current={section === key ? "page" : undefined}
                key={key}
              >
                {label}
                <span>↗</span>
              </Link>
            ))}
          </div>
          <p className="impl-boundary">
            Architect access to your own synthetic project. Sandbox identities
            are simulations inside this account.
          </p>
        </aside>
        <div className="impl-main" key={section}>
          {chapter && (
            <>
              <section className="impl-lesson" data-impl={`chapter-${section}`}>
                <div className="impl-lesson-top">
                  <span className="impl-kicker">
                    CHAPTER {chapterIndex + 1} OF 8 · ABOUT {chapter.minutes}{" "}
                    MIN
                  </span>
                  <span className="impl-status">
                    {project.chapters[chapterIndex].complete
                      ? "Evidence recorded"
                      : "Build & verify"}
                  </span>
                </div>
                <h2>{chapter.title}</h2>
                <p className="impl-objective">{chapter.objective}</p>
                {project.learningMode !== "Assessment" && (
                  <>
                    <p>{chapter.explain}</p>
                    <div className="impl-assignment">
                      <strong>Your assignment</strong>
                      <p>{chapter.task}</p>
                    </div>
                  </>
                )}
                <div className="impl-lesson-footer">
                  <a
                    href={
                      implementationSources.find(
                        (s) => s.id === chapter.source,
                      )!.url
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source & concept reference ↗
                  </a>
                  {project.learningMode === "Guided" && (
                    <button
                      onClick={() => {
                        const step = chapterIndex * 2;
                        safely(
                          {
                            action: "progress",
                            mode: project.learningMode,
                            step,
                          },
                          "Guide ready. Follow the highlighted assignment.",
                        ).then(() => setGuide(true));
                      }}
                      disabled={busy}
                    >
                      Guide this chapter
                    </button>
                  )}
                </div>
              </section>
              <section data-impl={`task-${section}`} className="impl-task">
                {section === "brief" && (
                  <>
                    <div className="impl-card impl-brief">
                      <span className="impl-kicker">
                        CLIENT BRIEF · FICTIONAL COMPANY
                      </span>
                      <h3>“Help us build a foundation we can grow with.”</h3>
                      <p>
                        Vale Works plans for 250 workers across France and
                        Sweden. Build two legal entities with locations and cost
                        centers, one supervisory root and a child. France uses
                        Position Management; Sweden uses Job Management.
                      </p>
                      <p>
                        HR initiates Hire. The assigned Manager approves. Annual
                        pay at or above your chosen threshold requires
                        additional HR Partner approval. HR performs a final
                        review. Completion creates at least two onboarding
                        tasks.
                      </p>
                      <p>
                        Managers see their assigned organization only. Employee
                        salary and approval access must be denied. Convert a
                        small worker sample, reconcile it, and prove a local
                        outbound exchange. Release only after a completed Hire
                        and a passing test suite.
                      </p>
                      <p>
                        <strong>Scope:</strong> configure a small representative
                        dataset. The lab does not require 250 manual worker
                        entries.
                      </p>
                    </div>
                    <section className="impl-card">
                      <h3>Record your design decisions</h3>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          save(draft).catch(() => undefined);
                        }}
                      >
                        {(
                          ["organization", "security", "acceptance"] as const
                        ).map((k) => (
                          <label key={k}>
                            {k === "organization"
                              ? "Organization design and rationale"
                              : k === "security"
                                ? "Access boundaries and responsible roles"
                                : "Acceptance criteria and evidence"}
                            <textarea
                              minLength={40}
                              maxLength={3000}
                              required
                              rows={4}
                              value={draft.design[k]}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  design: {
                                    ...draft.design,
                                    [k]: e.target.value,
                                  },
                                })
                              }
                              placeholder="Explain your decision in at least 40 characters."
                            />
                          </label>
                        ))}
                        <button className="primary" disabled={busy}>
                          Save design decisions
                        </button>
                      </form>
                    </section>
                  </>
                )}
                {section === "foundations" && (
                  <ObjectEditors
                    config={draft}
                    save={save}
                    busy={busy}
                    groups={["companies", "locations", "costCenters", "orgs"]}
                  />
                )}
                {section === "staffing" && (
                  <ObjectEditors
                    config={draft}
                    save={save}
                    busy={busy}
                    groups={["profiles", "positions"]}
                  />
                )}
                {section === "security" && (
                  <SecurityEditor
                    config={draft}
                    onChange={setDraft}
                    onSave={() => save(draft)}
                    busy={busy}
                  />
                )}
                {section === "process" && (
                  <>
                    <ProcessEditor
                      config={draft}
                      onChange={setDraft}
                      onSave={() =>
                        save({
                          ...draft,
                          hire: {
                            ...draft.hire,
                            onboarding: draft.hire.onboarding
                              .map((t) => t.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      busy={busy}
                    />
                    <Link className="button primary" href={nav("sandbox")}>
                      Test your Hire in the company sandbox →
                    </Link>
                    <p className="impl-help">
                      This chapter is evidenced by a completed Development Hire
                      using the current Hire configuration. Changing staffing,
                      roles, security or process rules requires new Hire
                      evidence.
                    </p>
                  </>
                )}
                {section === "data" && (
                  <DataWorkbench
                    project={project}
                    command={command}
                    busy={busy}
                  />
                )}
                {section === "reporting" && (
                  <ReportingWorkbench
                    project={project}
                    config={draft}
                    onChange={setDraft}
                    save={() => save(draft)}
                    command={command}
                    busy={busy}
                  />
                )}
                {section === "launch" && (
                  <ReleaseWorkbench
                    project={project}
                    command={command}
                    busy={busy}
                  />
                )}
              </section>
              {project.learningMode !== "Assessment" && (
                <details className="impl-reflection">
                  <summary>
                    Think like an implementer: {chapter.question}
                  </summary>
                  <p>{chapter.hint}</p>
                  <Link href={nav("interview")}>
                    Record your explanation in the Interview room →
                  </Link>
                </details>
              )}
              <div className="impl-chapter-pagination">
                {chapterIndex > 0 ? (
                  <Link href={nav(implementationChapters[chapterIndex - 1].id)}>
                    ← {implementationChapters[chapterIndex - 1].short}
                  </Link>
                ) : (
                  <span />
                )}
                {chapterIndex < 7 ? (
                  <Link href={nav(implementationChapters[chapterIndex + 1].id)}>
                    Next: {implementationChapters[chapterIndex + 1].short} →
                  </Link>
                ) : (
                  <Link href={nav("interview")}>
                    Defend your implementation →
                  </Link>
                )}
              </div>
            </>
          )}
          {section === "blueprint" && <ArchitectureMap project={project} />}
          {section === "sandbox" && (
            <CompanySandbox project={project} command={command} busy={busy} />
          )}
          {section === "interview" && (
            <InterviewRoom project={project} command={command} busy={busy} />
          )}
          {section === "evidence" && <EvidenceRoom project={project} />}
          {section === "troubleshooting" && (
            <TroubleshootingRoom
              project={project}
              command={command}
              busy={busy}
              onOpen={(result) =>
                router.push(`/implementation/${result.id}/${result.section}`)
              }
            />
          )}
          {!chapter &&
            ![
              "blueprint",
              "sandbox",
              "interview",
              "evidence",
              "troubleshooting",
            ].includes(section) && (
              <section className="impl-card">
                <h2>Choose a chapter</h2>
                <Link href={nav("brief")}>Start with the client brief</Link>
              </section>
            )}
        </div>
      </div>
      {guideOnTask && (
        <Coach
          name={`Implementation · Chapter ${Math.floor(guideIndex / 2) + 1}`}
          index={guideIndex}
          total={16}
          step={{
            title:
              guideIndex % 2 === 0
                ? guideChapter.title
                : "Build and verify this chapter",
            text:
              guideIndex % 2 === 0
                ? guideChapter.explain
                : guideChapter.task +
                  " The next step unlocks when saved project evidence satisfies this chapter.",
            selector: guideSelector,
            ready: guideReady,
            nextLabel: guideIndex === 15 ? "Finish guide" : "Next step",
          }}
          onPause={pauseGuide}
          onBack={() => {
            const step = Math.max(0, guideIndex - 1);
            safely({
              action: "progress",
              mode: project.learningMode,
              step,
            }).then(() =>
              router.push(nav(implementationChapters[Math.floor(step / 2)].id)),
            );
          }}
          onNext={() => {
            if (guideIndex === 15) {
              setGuide(false);
              return;
            }
            const step = guideIndex + 1;
            safely({
              action: "progress",
              mode: project.learningMode,
              step,
            }).then(() =>
              router.push(nav(implementationChapters[Math.floor(step / 2)].id)),
            );
          }}
        />
      )}
      {guide && !guideOnTask && (
        <div className="impl-guide-resume" role="status">
          Your guide is on Chapter {Math.floor(guideIndex / 2) + 1}.
          <Link href={nav(guideChapter.id)}>Return to guided chapter →</Link>
          <button onClick={() => setGuide(false)}>Pause guide</button>
        </div>
      )}
    </div>
  );
}

type ObjectGroup = keyof typeof objectNames;
function ObjectEditors({
  config,
  save,
  groups,
  busy,
}: {
  config: ImplementationConfig;
  save: (c: ImplementationConfig) => Promise<any>;
  groups: ObjectGroup[];
  busy: boolean;
}) {
  const [edit, setEdit] = useState<{
      group: ObjectGroup;
      value: Row;
      original?: string;
    } | null>(null),
    [error, setError] = useState("");
  const recommended = (g: ObjectGroup): Row => {
    const keys = {
      companies: "company",
      locations: "location",
      costCenters: "costCenter",
      orgs: "org",
      profiles: "profile",
      positions: "position",
    } as const;
    const base: Row = { ...recommendedObjects[keys[g]] };
    if (
      ["companies", "locations", "costCenters", "orgs"].includes(g) &&
      config[g].some((x) => x.id.endsWith("FR"))
    ) {
      for (const key of Object.keys(base))
        if (typeof base[key] === "string")
          base[key] = base[key]
            .replaceAll("FR", "SE")
            .replaceAll("France", "Sweden")
            .replaceAll("Paris", "Stockholm");
      if (g === "companies") base.currency = "SEK";
      if (g === "orgs") {
        base.parentId = "SUP-FR";
        base.staffing = "Job Management";
      }
    }
    if (g === "positions" && config.positions.some((p) => p.id === "POS-001")) {
      base.id = `POS-${String(config.positions.length + 1).padStart(3, "0")}`;
      base.name = "Operations Analyst — another seat";
    }
    return base;
  };
  const options = (key: string) => {
    if (key === "country")
      return [
        { id: "FR", name: "France" },
        { id: "SE", name: "Sweden" },
        { id: "US", name: "United States" },
      ];
    if (key === "currency")
      return ["EUR", "SEK", "USD"].map((id) => ({ id, name: id }));
    if (key === "staffing")
      return ["Position Management", "Job Management"].map((id) => ({
        id,
        name: id,
      }));
    const ref: Record<string, ObjectGroup> = {
      companyId: "companies",
      costCenterId: "costCenters",
      parentId: "orgs",
      orgId: "orgs",
      profileId: "profiles",
      locationId: "locations",
    };
    return ref[key]
      ? config[ref[key]].filter(
          (x) => key !== "parentId" || x.id !== edit?.original,
        )
      : undefined;
  };
  return (
    <>
      {groups.map((group) => (
        <section className="impl-card" key={group}>
          <div className="impl-card-heading">
            <div>
              <h3>{objectNames[group]}</h3>
              <p>{explanation[group]}</p>
            </div>
            <button
              disabled={busy}
              onClick={() => {
                setError("");
                setEdit({ group, value: recommended(group) });
              }}
            >
              Add{" "}
              {group === "companies"
                ? "company"
                : group === "orgs"
                  ? "organization"
                  : group === "costCenters"
                    ? "cost center"
                    : group === "profiles"
                      ? "job profile"
                      : group === "positions"
                        ? "position"
                        : "location"}
            </button>
          </div>
          {config[group].length ? (
            <div className="impl-object-list">
              {config[group].map((item: Row) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.id} {item.staffing ? `· ${item.staffing}` : ""}
                      {item.companyId ? ` · ${item.companyId}` : ""}
                      {item.parentId ? ` · reports to ${item.parentId}` : ""}
                    </small>
                  </span>
                  <button
                    aria-label={`Edit ${item.id}`}
                    disabled={busy}
                    onClick={() =>
                      setEdit({ group, value: { ...item }, original: item.id })
                    }
                  >
                    Edit
                  </button>
                  <button
                    aria-label={`Remove ${item.id}`}
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${item.id}? References must be corrected before testing.`,
                        )
                      )
                        save({
                          ...config,
                          [group]: config[group].filter(
                            (x) => x.id !== item.id,
                          ),
                        }).catch((e) => setError(e.message));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="impl-empty">
              No {objectNames[group].toLowerCase()} configured yet.
            </p>
          )}
          {edit?.group === group && (
            <form
              className="impl-inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                const value = Object.fromEntries(new FormData(e.currentTarget));
                const list = [...config[group]] as Row[];
                if (edit.original)
                  list[list.findIndex((x) => x.id === edit.original)] = value;
                else list.push(value);
                try {
                  await save({ ...config, [group]: list });
                  setEdit(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <h4>
                {edit.original
                  ? `Edit ${edit.original}`
                  : "Create a configuration object"}
              </h4>
              <p className="impl-help">
                Suggested values are editable. Save each object to create its
                references.
              </p>
              <div className="impl-form-grid">
                {Object.entries(edit.value).map(([key, value]) => (
                  <label key={key}>
                    {labels[key] ?? key}
                    {options(key) ? (
                      <select
                        name={key}
                        defaultValue={String(value)}
                        required={key !== "parentId"}
                      >
                        <option value="">
                          {key === "parentId"
                            ? "No superior — root organization"
                            : "Select a reference"}
                        </option>
                        {options(key)!.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} · {o.id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={key}
                        defaultValue={String(value)}
                        required
                        minLength={2}
                        maxLength={key === "id" ? 40 : 100}
                        readOnly={!!edit.original && key === "id"}
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="impl-actions">
                <button className="primary" disabled={busy}>
                  Save object
                </button>
                <button type="button" onClick={() => setEdit(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
function SecurityEditor({
  config,
  onChange,
  onSave,
  busy,
}: {
  config: ImplementationConfig;
  onChange: (c: ImplementationConfig) => void;
  onSave: () => Promise<any>;
  busy: boolean;
}) {
  return (
    <>
      <section className="impl-card">
        <h3>Role assignments</h3>
        <p>
          Assign a sandbox identity to the organizations it supports. Manager
          scope is exact in this lab; hierarchy inheritance is not modeled.
        </p>
        {config.orgs.length ? (
          <div className="impl-scroll">
            <table>
              <caption>Organization role assignments</caption>
              <thead>
                <tr>
                  <th>Identity</th>
                  {config.orgs.map((o) => (
                    <th key={o.id}>{o.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewActors.map((a) => (
                  <tr key={a.id}>
                    <th>
                      {a.name}
                      <small>{a.role}</small>
                    </th>
                    {config.orgs.map((o) => (
                      <td key={o.id}>
                        <input
                          aria-label={`${a.role} assigned to ${o.id}`}
                          type="checkbox"
                          checked={config.assignments.some(
                            (x) => x.actorId === a.id && x.orgId === o.id,
                          )}
                          onChange={(e) =>
                            onChange({
                              ...config,
                              assignments: e.target.checked
                                ? [
                                    ...config.assignments,
                                    { actorId: a.id, orgId: o.id },
                                  ]
                                : config.assignments.filter(
                                    (x) =>
                                      x.actorId !== a.id || x.orgId !== o.id,
                                  ),
                            })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Create organizations in Chapter 2 first.</p>
        )}
      </section>
      <section className="impl-card">
        <h3>Separate data access from process participation</h3>
        <p>
          All grants begin denied. Configure only the access the client
          requires. The Integration User runs local exchanges; Employee
          self-view is limited to worker reference SELF-001.
        </p>
        <div className="impl-scroll">
          <table>
            <caption>Sandbox role security policies</caption>
            <thead>
              <tr>
                <th>Role</th>
                <th>
                  View workers
                  <br />
                  <small>Data domain</small>
                </th>
                <th>
                  View salary
                  <br />
                  <small>Data domain</small>
                </th>
                <th>
                  Initiate Hire
                  <br />
                  <small>Process policy</small>
                </th>
                <th>
                  Approve Hire
                  <br />
                  <small>Process policy</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {config.policies.map((p, i) => (
                <tr key={p.role}>
                  <th>{p.role}</th>
                  {(["workers", "salary", "initiate", "approve"] as const).map(
                    (key) => (
                      <td key={key}>
                        <input
                          type="checkbox"
                          aria-label={`${p.role} ${key}`}
                          checked={p[key]}
                          onChange={(e) =>
                            onChange({
                              ...config,
                              policies: config.policies.map((x, j) =>
                                j === i ? { ...x, [key]: e.target.checked } : x,
                              ),
                            })
                          }
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => onSave().catch(() => undefined)}
        >
          Save security configuration
        </button>
      </section>
    </>
  );
}
function ProcessEditor({
  config,
  onChange,
  onSave,
  busy,
}: {
  config: ImplementationConfig;
  onChange: (c: ImplementationConfig) => void;
  onSave: () => Promise<any>;
  busy: boolean;
}) {
  const h = config.hire;
  return (
    <section className="impl-card">
      <h3>Hire Employee definition</h3>
      <p>
        This original editor configures the local simulator's route. HR's final
        review may be performed by the initiating HR identity; the first
        approval must be independent.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave().catch(() => undefined);
        }}
      >
        <div className="impl-form-grid">
          <label>
            First approval role
            <select
              value={h.firstApprover}
              onChange={(e) =>
                onChange({
                  ...config,
                  hire: {
                    ...h,
                    firstApprover: e.target.value as typeof h.firstApprover,
                  },
                })
              }
            >
              <option>Manager</option>
              <option>HR Partner</option>
            </select>
          </label>
          <label>
            Additional HR Partner review at annual salary
            <input
              type="number"
              min={0}
              max={1000000}
              value={h.partnerThreshold}
              onChange={(e) =>
                onChange({
                  ...config,
                  hire: { ...h, partnerThreshold: Number(e.target.value) },
                })
              }
            />
            <small>
              0 disables this condition. Teaching amounts are in the company's
              currency; no FX conversion.
            </small>
          </label>
        </div>
        <label className="impl-check">
          <input
            type="checkbox"
            checked={h.finalReview}
            onChange={(e) =>
              onChange({
                ...config,
                hire: { ...h, finalReview: e.target.checked },
              })
            }
          />{" "}
          Require final HR review
        </label>
        <label>
          Onboarding tasks — one per line
          <textarea
            aria-label="Onboarding tasks"
            rows={4}
            value={h.onboarding.join("\n")}
            onChange={(e) =>
              onChange({
                ...config,
                hire: { ...h, onboarding: e.target.value.split("\n") },
              })
            }
            placeholder={"Confirm personal details\nReview welcome checklist"}
          />
        </label>
        <div
          className="impl-flow"
          role="group"
          aria-label="Configured Hire route"
        >
          <span>HR initiates</span>
          <span>→</span>
          <strong>{h.firstApprover}</strong>
          {h.partnerThreshold > 0 && h.firstApprover !== "HR Partner" && (
            <>
              <span>→</span>
              <strong>
                HR Partner if pay ≥ {h.partnerThreshold.toLocaleString()}
              </strong>
            </>
          )}
          {h.finalReview && (
            <>
              <span>→</span>
              <strong>HR review</strong>
            </>
          )}
          <span>→</span>
          <strong>Worker + onboarding</strong>
        </div>
        <button className="primary" disabled={busy}>
          Save Hire definition
        </button>
      </form>
    </section>
  );
}
function DataWorkbench({
  project,
  command,
  busy,
}: {
  project: Project;
  command: Command;
  busy: boolean;
}) {
  const [csv, setCsv] = useState(sampleWorkerCsv),
    [mapping, setMapping] = useState(defaultMapping),
    [preview, setPreview] = useState<Row | null>(null);
  const header =
    csv
      .split(/\r?\n/)[0]
      ?.split(",")
      .map((x) => x.trim()) ?? [];
  const imports = project.workers.filter(
    (w: Row) => w.source === "Import" && w.environment === "Development",
  );
  const run = async (commit: boolean) => {
    try {
      const result = await command(
        { action: "import", csv, mapping, commit },
        commit
          ? "Worker conversion committed atomically. Inspect saved target records below."
          : "Preview validated. No workers were imported.",
      );
      if (result) setPreview(result);
    } catch {
      /* parent renders failure */
    }
  };
  return (
    <>
      <section className="impl-card">
        <h3>Worker conversion workbench</h3>
        <p>
          Use synthetic data only. The suggested sample references SUP-SE,
          JP-ANALYST and LOC-SE. Adjust it to your actual reference IDs. This is
          a local CSV converter, not Workday EIB.
        </p>
        <label>
          Source CSV
          <textarea
            aria-label="Source CSV"
            className="impl-code"
            rows={7}
            maxLength={100000}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <details>
          <summary>Field mapping</summary>
          <div className="impl-form-grid">
            {Object.entries(mapping).map(([key, value]) => (
              <label key={key}>
                {key}
                <select
                  value={value}
                  onChange={(e) => {
                    setMapping({ ...mapping, [key]: e.target.value });
                    setPreview(null);
                  }}
                >
                  {[...new Set([...header, value])].map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
        <div className="impl-actions">
          <button disabled={busy} onClick={() => run(false)}>
            Validate import
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !preview ||
              preview.errors.length > 0 ||
              preview.committed > 0
            }
            onClick={() => run(true)}
          >
            Commit validated import
          </button>
        </div>
        {preview && (
          <div className="impl-import-result" role="status">
            <strong>
              {preview.total} source rows · {preview.valid} valid ·{" "}
              {preview.errors.length} rejected · {preview.committed} committed
            </strong>
            {preview.errors.map((e: Row) => (
              <p key={e.row}>
                Row {e.row}: {e.message}
              </p>
            ))}
          </div>
        )}
      </section>
      <section className="impl-card">
        <h3>Reconciliation: saved converted workers</h3>
        <p>
          {imports.length} workers persisted in Development. Preview rows do not
          count as converted workers.
        </p>
        <WorkerTable workers={imports} />
      </section>
    </>
  );
}
function ReportingWorkbench({
  project,
  config,
  onChange,
  save,
  command,
  busy,
}: {
  project: Project;
  config: ImplementationConfig;
  onChange: (c: ImplementationConfig) => void;
  save: () => Promise<any>;
  command: Command;
  busy: boolean;
}) {
  const [report, setReport] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [actor, setActor] = useState("hr"),
    [asOf, setAsOf] = useState(today()),
    [org, setOrg] = useState(""),
    [output, setOutput] = useState<Row | null>(null);
  const runReport = async () => {
    setError("");
    setReport(null);
    try {
      const q = new URLSearchParams({
        id: project.id,
        report: "true",
        actorId: actor,
        environment: "Development",
        asOf,
        ...(org ? { orgId: org } : {}),
      });
      const r = await fetch("/api/implementation?" + q);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setReport(d);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <section className="impl-card">
        <h3>Report configuration</h3>
        <label>
          Report name
          <input
            value={config.report.name}
            onChange={(e) =>
              onChange({
                ...config,
                report: { ...config.report, name: e.target.value },
              })
            }
          />
        </label>
        <label className="impl-check">
          <input
            type="checkbox"
            checked={config.report.includeSalary}
            onChange={(e) =>
              onChange({
                ...config,
                report: { ...config.report, includeSalary: e.target.checked },
              })
            }
          />{" "}
          Include annual salary — requires a separate data grant
        </label>
        <h3>Outbound exchange configuration</h3>
        <label className="impl-check">
          <input
            type="checkbox"
            checked={config.integration.enabled}
            onChange={(e) =>
              onChange({
                ...config,
                integration: {
                  ...config.integration,
                  enabled: e.target.checked,
                },
              })
            }
          />{" "}
          Enable local worker exchange
        </label>
        <label>
          Output format
          <select
            value={config.integration.format}
            onChange={(e) =>
              onChange({
                ...config,
                integration: {
                  ...config.integration,
                  format: e.target.value as "CSV" | "JSON",
                },
              })
            }
          >
            <option>CSV</option>
            <option>JSON</option>
          </select>
        </label>
        <label className="impl-check">
          <input
            type="checkbox"
            checked={config.integration.includeSalary}
            onChange={(e) =>
              onChange({
                ...config,
                integration: {
                  ...config.integration,
                  includeSalary: e.target.checked,
                },
              })
            }
          />{" "}
          Include salary in the local exchange
        </label>
        <button
          className="primary"
          disabled={busy}
          onClick={() => save().catch(() => undefined)}
        >
          Save report & exchange configuration
        </button>
      </section>
      <section className="impl-card">
        <h3>Run the saved report</h3>
        <p>
          These controls preview configured sandbox identities. The server
          applies scope and field permissions before returning rows.
        </p>
        <div className="impl-form-grid">
          <label>
            Run as
            <select
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setReport(null);
              }}
            >
              {previewActors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.role} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            As-of date
            <input
              type="date"
              value={asOf}
              onChange={(e) => {
                setAsOf(e.target.value);
                setReport(null);
              }}
            />
          </label>
          <label>
            Organization filter
            <select
              value={org}
              onChange={(e) => {
                setOrg(e.target.value);
                setReport(null);
              }}
            >
              <option value="">All permitted organizations</option>
              {project.config.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button disabled={busy} onClick={runReport}>
          Run scoped report
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {report && (
          <>
            <h4>
              {report.name} · {report.rows.length} rows
            </h4>
            <WorkerTable workers={report.rows} />
          </>
        )}
      </section>
      <section className="impl-card">
        <h3>Launch the local exchange</h3>
        <p>
          Runs as Integration User with its saved assignments and grants.
          Generates local output and a persistent run record.
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            setOutput(null);
            try {
              const result = await command(
                { action: "exchange", environment: "Development", asOf },
                "Local exchange completed. Output and run evidence saved.",
              );
              if (result) setOutput(result);
            } catch {}
          }}
        >
          Run outbound exchange
        </button>
        {output && (
          <>
            <p>
              {output.count} workers · {output.format} · {output.identity}
            </p>
            <pre className="impl-code">{output.output}</pre>
            <ul>
              {output.log.map((line: string) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Download
              data={output.output}
              name={`worker-exchange.${output.format.toLowerCase()}`}
              label="Download local output"
            />
          </>
        )}
      </section>
    </>
  );
}
function ReleaseWorkbench({
  project,
  command,
  busy,
}: {
  project: Project;
  command: Command;
  busy: boolean;
}) {
  const latest = project.evidence.find((e: Row) => e.kind === "Suite"),
    checks = latest?.result.checks ?? [];
  return (
    <>
      <section className="impl-card">
        <h3>Acceptance suite</h3>
        <p>
          Ten behavioral and configuration checks run against saved
          configuration. A separate persisted Hire proves worker creation. A
          configuration change makes previous evidence historical.
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            command(
              { action: "suite" },
              "Acceptance results saved. Inspect failures and return to the relevant chapter.",
            ).catch(() => undefined)
          }
        >
          Run acceptance suite
        </button>
        {latest && (
          <>
            <p className="impl-status">
              {latest.current
                ? "Current configuration"
                : "Historical configuration — rerun required"}{" "}
              · {checks.filter((c: Row) => c.passed).length} / {checks.length}{" "}
              checks pass
            </p>
            <ul className="impl-check-results">
              {checks.map((c: Row) => (
                <li key={c.id} className={c.passed ? "pass" : "fail"}>
                  <span>{c.passed ? "✓" : "!"}</span>
                  <div>
                    <strong>{c.title}</strong>
                    <p>{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="impl-card">
        <h3>Configuration releases</h3>
        <p>
          Development → Test → simulated Production. Only configuration is
          promoted; workers and in-flight processes stay in their environment.
          This is a teaching release model, not an official Workday migration
          tool.
        </p>
        <div className="impl-actions">
          <button
            disabled={busy}
            onClick={() =>
              command(
                { action: "promote", stage: "Test" },
                "Test configuration snapshot created.",
              ).catch(() => undefined)
            }
          >
            Promote to Test
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              command(
                { action: "promote", stage: "Production" },
                "Simulated Production configuration snapshot created.",
              ).catch(() => undefined)
            }
          >
            Promote to Production
          </button>
        </div>
        {project.releases.length ? (
          <div className="impl-release-list">
            {project.releases.map((r: Row) => (
              <div key={r.id}>
                <strong>{r.stage}</strong>
                <span>
                  Source revision {r.sourceVersion} ·{" "}
                  {r.configHash.slice(0, 10)}
                </span>
                <span>
                  {r.configHash === project.hash
                    ? "Matches Development"
                    : "Differs from Development"}
                </span>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Restore this configuration to Development? Existing workers remain and referenced objects must still exist.",
                      )
                    )
                      command(
                        { action: "restore", releaseId: r.id },
                        "Release configuration restored to Development. Runtime data preserved.",
                      ).catch(() => undefined);
                  }}
                >
                  Restore to Development
                </button>
                <details>
                  <summary>Configuration diff from Development</summary>
                  <ConfigDiff before={r.config} after={project.config} />
                </details>
              </div>
            ))}
          </div>
        ) : (
          <p className="impl-empty">
            No releases yet. A current passing suite, completed Development
            Hire, committed worker conversion and current nonempty exchange are
            required.
          </p>
        )}
      </section>
    </>
  );
}
function ArchitectureMap({ project }: { project: Project }) {
  const c = project.config;
  return (
    <>
      <section className="impl-lesson">
        <span className="impl-kicker">YOUR CONFIGURATION, CONNECTED</span>
        <h2>Architecture map</h2>
        <p>
          Follow the references from legal structure to worker outcomes. Counts
          and identifiers come from your saved project.
        </p>
      </section>
      <div className="impl-blueprint">
        <div className="impl-map-row">
          <MapNode
            title="Legal foundation"
            count={c.companies.length}
            lines={c.companies.map((x) => `${x.id} · ${x.country}`)}
          />
          <MapNode
            title="Locations & costing"
            count={c.locations.length + c.costCenters.length}
            lines={[...c.locations, ...c.costCenters].map((x) => x.id)}
          />
        </div>
        <span className="impl-map-arrow" aria-hidden="true">
          ↓
        </span>
        <MapNode
          title="Supervisory hierarchy"
          count={c.orgs.length}
          lines={c.orgs.map(
            (o) =>
              `${o.parentId ? o.parentId + " → " : "ROOT → "}${o.id} · ${o.staffing}`,
          )}
        />
        <span className="impl-map-arrow" aria-hidden="true">
          ↓
        </span>
        <div className="impl-map-row">
          <MapNode
            title="Staffing references"
            count={c.profiles.length + c.positions.length}
            lines={c.positions.map(
              (x) => `${x.id} → ${x.profileId} → ${x.orgId}`,
            )}
          />
          <MapNode
            title="Organizational roles"
            count={c.assignments.length}
            lines={c.assignments.map(
              (x) =>
                `${previewActors.find((a) => a.id === x.actorId)?.role} → ${x.orgId}`,
            )}
          />
        </div>
        <span className="impl-map-arrow" aria-hidden="true">
          ↓
        </span>
        <MapNode
          title="Hire definition & consequences"
          count={c.hire.onboarding.length}
          lines={[
            `First approval: ${c.hire.firstApprover}`,
            `Partner threshold: ${c.hire.partnerThreshold || "disabled"}`,
            `Final HR review: ${c.hire.finalReview ? "yes" : "no"}`,
            ...c.hire.onboarding.map((x) => `Onboarding: ${x}`),
          ]}
        />
      </div>
      <section className="impl-card">
        <h3>Dependency findings</h3>
        {project.findings.length ? (
          <ul>
            {project.findings.map((f: Row, i: number) => (
              <li key={i}>
                <strong>{f.area}:</strong> {f.message}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No structural dependency errors found. Run the acceptance suite to
            check the client's behavioral requirements.
          </p>
        )}
      </section>
    </>
  );
}
function MapNode({
  title,
  count,
  lines,
}: {
  title: string;
  count: number;
  lines: string[];
}) {
  return (
    <section className="impl-map-node">
      <span className="impl-kicker">{count} CONFIGURED</span>
      <h3>{title}</h3>
      {lines.length ? (
        <ul>
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p>Configure this layer in the chapters.</p>
      )}
    </section>
  );
}
function CompanySandbox({
  project,
  command,
  busy,
}: {
  project: Project;
  command: Command;
  busy: boolean;
}) {
  const [actor, setActor] = useState("hr"),
    [environment, setEnvironment] = useState("Development"),
    [comment, setComment] = useState(
      "Reviewed against the client requirements",
    ),
    [requestKey, setRequestKey] = useState(() => newRequestKey());
  const release = project.releases.find((r: Row) => r.stage === environment),
    c: ImplementationConfig | undefined =
      environment === "Development" ? project.config : release?.config;
  const workers = project.workers.filter(
      (w: Row) => w.environment === environment,
    ),
    hires = project.hires.filter((h: Row) => h.environment === environment);
  const base = c?.positions.find(
    (p) =>
      !workers.some((w: Row) => w.positionId === p.id) &&
      !hires.some(
        (h: Row) => h.status === "Pending" && h.payload.positionId === p.id,
      ),
  );
  const [orgId, setOrgId] = useState("");
  const org =
    c?.orgs.find((o) => o.id === orgId) ??
    c?.orgs.find((o) => o.id === base?.orgId) ??
    c?.orgs[0];
  return (
    <>
      <section className="impl-lesson">
        <span className="impl-kicker">
          COMPANY SANDBOX · CONFIGURATION IN ACTION
        </span>
        <h2>Bring your environment to life</h2>
        <p>
          Act through simulated identities to see how your own configuration
          behaves. Your real signed-in account remains the project architect.
          Records here stay separate from the seeded Practice Lab.
        </p>
        <div className="impl-form-grid">
          <label>
            Sandbox identity
            <select
              aria-label="Sandbox identity"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            >
              {previewActors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.role} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Environment
            <select
              aria-label="Sandbox environment"
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                setOrgId("");
              }}
            >
              <option>Development</option>
              <option>Test</option>
              <option>Production</option>
            </select>
          </label>
        </div>
      </section>
      {!c ? (
        <section className="impl-card">
          <p>Create a {environment} release in Chapter 8 first.</p>
        </section>
      ) : (
        <>
          <section className="impl-card">
            <h3>Hire Employee</h3>
            <p>
              Submitting reserves the seat. A worker is created only after all
              configured approvals. Configuration is frozen for each submitted
              Hire.
            </p>
            <form
              key={`${environment}:${project.hash}:${requestKey}`}
              onSubmit={async (e) => {
                e.preventDefault();
                const raw = Object.fromEntries(new FormData(e.currentTarget));
                const input = { ...raw, salary: Number(raw.salary) };
                try {
                  await command(
                    {
                      action: "hire",
                      actorId: actor,
                      environment,
                      input,
                      requestKey,
                    },
                    "Hire submitted. Switch the sandbox identity to the assigned approver.",
                  );
                  setRequestKey(newRequestKey());
                } catch {}
              }}
            >
              <div className="impl-form-grid">
                <label>
                  Worker reference ID
                  <input
                    name="externalId"
                    required
                    defaultValue={`HIRE-${String(workers.length + hires.length + 1).padStart(3, "0")}`}
                  />
                </label>
                <label>
                  Worker name
                  <input name="name" required defaultValue="Riley Brooks" />
                </label>
                <label>
                  Supervisory organization
                  <select
                    name="orgId"
                    value={org?.id ?? ""}
                    required
                    onChange={(e) => setOrgId(e.target.value)}
                  >
                    <option value="">Select an organization</option>
                    {c.orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} · {o.staffing}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Job profile
                  <select
                    name="profileId"
                    required
                    defaultValue={base?.profileId ?? c.profiles[0]?.id}
                  >
                    <option value="">Select a profile</option>
                    {c.profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <select
                    name="locationId"
                    required
                    defaultValue={base?.locationId ?? c.locations[0]?.id}
                  >
                    <option value="">Select a location</option>
                    {c.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Position
                  {org?.staffing === "Job Management" ? (
                    <>
                      <input name="positionId" value="" readOnly />
                      <small>Job Management: no seat required.</small>
                    </>
                  ) : (
                    <select
                      name="positionId"
                      required
                      defaultValue={base?.id ?? ""}
                    >
                      <option value="">Select an open seat</option>
                      {c.positions
                        .filter((p) => p.orgId === org?.id)
                        .map((p) => (
                          <option
                            key={p.id}
                            value={p.id}
                            disabled={
                              workers.some((w: Row) => w.positionId === p.id) ||
                              hires.some(
                                (h: Row) =>
                                  h.status === "Pending" &&
                                  h.payload.positionId === p.id,
                              )
                            }
                          >
                            {p.name} · {p.id}
                          </option>
                        ))}
                    </select>
                  )}
                </label>
                <label>
                  Annual salary
                  <input
                    name="salary"
                    type="number"
                    required
                    min={1}
                    max={1000000}
                    defaultValue={Math.max(60000, c.hire.partnerThreshold)}
                  />
                </label>
                <label>
                  Effective date
                  <input
                    name="effectiveDate"
                    type="date"
                    required
                    defaultValue={today()}
                  />
                </label>
              </div>
              <button className="primary" disabled={busy}>
                Submit sandbox Hire
              </button>
            </form>
          </section>
          <section className="impl-card">
            <h3>Process inbox & history</h3>
            <label>
              Decision comment
              <input
                value={comment}
                minLength={3}
                maxLength={1000}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            {hires.length ? (
              hires.map((h: Row) => (
                <article key={h.id} className="impl-hire">
                  <div className="impl-card-heading">
                    <div>
                      <strong>
                        {h.payload.name} · {h.payload.externalId}
                      </strong>
                      <p>
                        {h.payload.orgId} · {h.status} · configuration{" "}
                        {h.configHash.slice(0, 8)}
                      </p>
                    </div>
                    <span className="impl-status">
                      {h.assignee
                        ? `Assigned to ${previewActors.find((a) => a.id === h.assignee)?.role}`
                        : h.status}
                    </span>
                  </div>
                  <ol className="impl-history">
                    {h.history.map((event: Row, i: number) => (
                      <li key={i}>
                        <strong>
                          {
                            previewActors.find((a) => a.id === event.actor)
                              ?.role
                          }{" "}
                          · {event.action}
                        </strong>
                        <span>{event.detail}</span>
                      </li>
                    ))}
                  </ol>
                  {h.status === "Pending" && (
                    <div className="impl-actions">
                      {h.assignee === actor && (
                        <>
                          <button
                            className="primary"
                            disabled={busy || comment.trim().length < 3}
                            onClick={() =>
                              command(
                                {
                                  action: "act",
                                  hireId: h.id,
                                  actorId: actor,
                                  decision: "approve",
                                  comment,
                                },
                                "Decision saved. Inspect the next assignment or completed worker.",
                              ).catch(() => undefined)
                            }
                          >
                            Approve sandbox Hire
                          </button>
                          <button
                            disabled={busy || comment.trim().length < 3}
                            onClick={() =>
                              command(
                                {
                                  action: "act",
                                  hireId: h.id,
                                  actorId: actor,
                                  decision: "deny",
                                  comment,
                                },
                                "Hire denied. No worker or onboarding was created.",
                              ).catch(() => undefined)
                            }
                          >
                            Deny
                          </button>
                        </>
                      )}
                      {h.initiator === actor && (
                        <button
                          disabled={busy || comment.trim().length < 3}
                          onClick={() =>
                            command(
                              {
                                action: "act",
                                hireId: h.id,
                                actorId: actor,
                                decision: "cancel",
                                comment,
                              },
                              "Hire canceled. No worker was created.",
                            ).catch(() => undefined)
                          }
                        >
                          Cancel Hire
                        </button>
                      )}
                      {h.assignee !== actor && (
                        <small>
                          Switch sandbox identity to the assigned approver to
                          review this step.
                        </small>
                      )}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="impl-empty">
                No Hire events in this environment yet.
              </p>
            )}
          </section>
          <section className="impl-card">
            <h3>Architect inspection: persisted workers</h3>
            <p>
              As the project architect, you can inspect synthetic saved outcomes
              here. Use Chapter 7's report preview to test restricted identity
              visibility. Future-dated workers appear in this inspection;
              reports use their selected as-of date.
            </p>
            <WorkerTable workers={workers} />
            {workers
              .filter((w: Row) => w.onboarding.length)
              .map((w: Row) => (
                <div className="impl-onboarding" key={w.id}>
                  <h4>{w.name} · onboarding</h4>
                  {w.onboarding.map((t: Row) => (
                    <label className="impl-check" key={t.label}>
                      <input
                        type="checkbox"
                        checked={t.completed}
                        disabled={busy || t.completed || actor !== "hr"}
                        onChange={() =>
                          command(
                            {
                              action: "onboard",
                              actorId: actor,
                              workerId: w.id,
                              label: t.label,
                            },
                            "Onboarding task completed and audited.",
                          ).catch(() => undefined)
                        }
                      />
                      {t.label}
                      {t.completed ? " · Completed" : " · HR Admin action"}
                    </label>
                  ))}
                </div>
              ))}
          </section>
        </>
      )}
    </>
  );
}
function WorkerTable({ workers }: { workers: Row[] }) {
  const salary = workers.some((w) => "salary" in w);
  return workers.length ? (
    <div className="impl-scroll">
      <table>
        <caption>Saved worker records</caption>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Name</th>
            <th>Organization</th>
            <th>Job profile</th>
            <th>Effective date</th>
            {salary && <th>Annual salary</th>}
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.id ?? w.externalId}>
              <td>{w.externalId}</td>
              <td>{w.name}</td>
              <td>{w.orgId}</td>
              <td>{w.profileId}</td>
              <td>{w.effectiveDate}</td>
              {salary && (
                <td>
                  {typeof w.salary === "number"
                    ? w.salary.toLocaleString()
                    : ""}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="impl-empty">No saved rows in this scope.</p>
  );
}
function InterviewRoom({
  project,
  command,
  busy,
}: {
  project: Project;
  command: Command;
  busy: boolean;
}) {
  const previous = project.evidence.find((e: Row) => e.kind === "Interview"),
    [answers, setAnswers] = useState<Record<string, string>>(
      previous?.result.answers ?? {},
    );
  return (
    <>
      <section className="impl-lesson">
        <span className="impl-kicker">
          INTERVIEW ROOM · EXPLAIN YOUR OWN IMPLEMENTATION
        </span>
        <h2>Defend the decisions you made</h2>
        <p>
          Use actual objects, a failure you observed, and test evidence from
          this project. Save your responses, then compare them with the
          reflection checklist. Response coverage is not a correctness or
          certification score.
        </p>
        <p>
          <strong>Your current evidence:</strong>{" "}
          {project.config.companies.length} companies ·{" "}
          {project.config.orgs.length} supervisory organizations ·{" "}
          {project.hires.filter((h: Row) => h.status === "Completed").length}{" "}
          completed Hires · {project.releases.length} releases.
        </p>
      </section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          command(
            { action: "interview", answers },
            "Interview responses saved with reflection prompts.",
          ).catch(() => undefined);
        }}
      >
        {implementationChapters.map((ch, i) => (
          <section className="impl-card" key={ch.id}>
            <span className="impl-kicker">
              QUESTION {i + 1} · {ch.short}
            </span>
            <h3>{ch.question}</h3>
            <label>
              Your explanation
              <textarea
                aria-label={`Answer ${i + 1}`}
                rows={4}
                maxLength={3000}
                value={answers[ch.id] ?? ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [ch.id]: e.target.value })
                }
                placeholder="Explain the trade-off, your configuration, and the evidence you would show."
              />
            </label>
            {project.learningMode !== "Assessment" && (
              <details>
                <summary>Reflection checklist</summary>
                <p>{ch.hint}</p>
              </details>
            )}
          </section>
        ))}
        <button className="primary" disabled={busy}>
          Save interview responses
        </button>
      </form>
      {previous && (
        <section className="impl-card">
          <h3>Saved response coverage</h3>
          <p>
            {previous.result.responses.filter((r: Row) => r.answered).length} /
            8 responses attempted with at least 80 characters. Review technical
            accuracy with a qualified implementer.
          </p>
          {previous.result.responses.map((r: Row) => (
            <details key={r.chapter}>
              <summary>
                {r.answered ? "Attempted" : "Needs detail"}: {r.question}
              </summary>
              <p>{r.reflection}</p>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
function EvidenceRoom({ project }: { project: Project }) {
  return (
    <>
      <section className="impl-lesson">
        <span className="impl-kicker">TRACEABILITY & OBSERVABLE OUTCOMES</span>
        <h2>Evidence & history</h2>
        <p>
          Progress comes from saved configuration and transaction outcomes.
          Historical evidence is preserved when configuration changes.
        </p>
        <Download
          data={JSON.stringify(
            {
              name: project.name,
              config: project.config,
              hash: project.hash,
              chapters: project.chapters,
              releases: project.releases,
              hires: project.hires,
              workers: project.workers,
              evidence: project.evidence,
              events: project.events,
            },
            null,
            2,
          )}
          name="implementation-portfolio.json"
          label="Download implementation portfolio"
        />
      </section>
      <section className="impl-card">
        <h3>Saved evidence</h3>
        {project.evidence.length ? (
          project.evidence.map((e: Row) => (
            <details key={e.id}>
              <summary>
                {e.kind} · {new Date(e.createdAt).toLocaleString()} ·{" "}
                {e.current
                  ? "Current configuration"
                  : "Historical configuration"}
              </summary>
              <pre className="impl-code">
                {JSON.stringify(e.result, null, 2)}
              </pre>
            </details>
          ))
        ) : (
          <p>
            No evidence recorded yet. Run an import, exchange or acceptance
            suite.
          </p>
        )}
      </section>
      <section className="impl-card">
        <h3>Immutable project audit</h3>
        <ol className="impl-history">
          {project.events.map((e: Row) => (
            <li key={e.id}>
              <strong>
                #{e.id} · {e.action}
              </strong>
              <span>
                {new Date(e.createdAt).toLocaleString()} · {e.permission}
              </span>
              <details>
                <summary>Before & after</summary>
                <pre className="impl-code">
                  {JSON.stringify(
                    {
                      before: JSON.parse(e.before),
                      after: JSON.parse(e.after),
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </li>
          ))}
        </ol>
      </section>
      <section className="impl-card">
        <h3>Source register & fidelity boundaries</h3>
        {implementationSources.map((s) => (
          <p key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.id} · {s.title} ↗
            </a>
            <br />
            {s.note}
          </p>
        ))}
        <p>
          Original instructional interface. Exact field sets, access model,
          thresholds, CSV tooling, snapshot behavior, tests and release gates
          are reduced local teaching rules. No official Workday code, tenant,
          certification, EIB, Studio runtime or production deployment is
          supplied.
        </p>
      </section>
    </>
  );
}
function ConfigDiff({ before, after }: { before: Row; after: Row }) {
  const keys = Object.keys(after).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
  return keys.length ? (
    <ul className="impl-diff">
      {keys.map((k) => (
        <li key={k}>
          <strong>{k}</strong>
          <div>
            <pre className="impl-code">
              {JSON.stringify(before[k], null, 2)}
            </pre>
            <pre className="impl-code">{JSON.stringify(after[k], null, 2)}</pre>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p>No configuration differences.</p>
  );
}
function TroubleshootingRoom({
  project,
  command,
  busy,
  onOpen,
}: {
  project: Project;
  command: Command;
  busy: boolean;
  onOpen: (result: Row) => void;
}) {
  const drills = [
    {
      fault: "routing",
      title: "Hire cannot find its approver",
      symptom:
        "The process definition looks correct, but a Hire in the position-based organization cannot route to its first approver.",
      hint: "Inspect organizational role assignments separately from the business process policy.",
    },
    {
      fault: "privacy",
      title: "An unexpected salary grant",
      symptom:
        "A security review identifies employee salary access that conflicts with the client's access boundary.",
      hint: "Inspect the Employee data-domain grant. Approval permission is a separate decision.",
    },
    {
      fault: "reference",
      title: "A broken organization dependency",
      symptom:
        "A configuration passes basic field validation but fails the dependency check for organization costing.",
      hint: "Follow the supervisory organization to its cost center and check company ownership.",
    },
  ];
  return (
    <>
      <section className="impl-lesson">
        <span className="impl-kicker">
          TROUBLESHOOTING · DIAGNOSE BEFORE YOU CHANGE
        </span>
        <h2>Find the cause. Prove the fix.</h2>
        <p>
          Each exercise creates a separate copy of your valid configuration with
          one deliberate fault. Your baseline workers, configuration and
          releases stay in their original project. Repair the copy, run its
          acceptance suite, and demonstrate a Hire.
        </p>
        <p>
          Build a baseline that passes all ten acceptance checks before starting
          these exercises.
        </p>
      </section>
      {drills.map((d) => (
        <section className="impl-card" key={d.fault}>
          <h3>{d.title}</h3>
          <p>{d.symptom}</p>
          {project.learningMode !== "Assessment" && (
            <details>
              <summary>Optional investigation hint</summary>
              <p>{d.hint}</p>
            </details>
          )}
          <button
            disabled={busy}
            onClick={async () => {
              try {
                const result = await command(
                  { action: "drill", fault: d.fault },
                  "Created an isolated troubleshooting copy.",
                );
                if (result) onOpen(result);
              } catch {}
            }}
          >
            Create troubleshooting copy: {d.fault}
          </button>
        </section>
      ))}
    </>
  );
}
function Download({
  data,
  name,
  label,
}: {
  data: string;
  name: string;
  label: string;
}) {
  return (
    <button
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([data], { type: "text/plain;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      {label} ↓
    </button>
  );
}
