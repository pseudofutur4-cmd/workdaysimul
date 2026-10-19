"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  academyModules,
  moduleById,
  AcademyModule,
} from "@/lib/academy-catalog";
import Coach, { CoachStep } from "./Coach";
import { academyChapters } from "@/lib/academy-chapters";
import Icon from "./Icon";
type Row = Record<string, any>;
type Active = {
  lesson: string;
  step: number;
  caseId: string | null;
  ownerId: string;
  processId?: string;
  baseline: string[];
};
const euro = (c: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
    c / 100,
  );
const valueReady = (selector: string) => () => {
  const el = document.querySelector(selector) as HTMLInputElement;
  return !!el?.value && el.checkValidity();
};
const runModules = ["integration", "studio", "security"];
export default function Academy({
  user,
  workspace,
  path,
  onSelectProcess,
}: {
  user: Row;
  workspace: Row;
  path: string;
  onSelectProcess: (id: string) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<Row>({ cases: [], progress: [] }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Active | null>(null),
    [paused, setPaused] = useState(false),
    [selected, setSelected] = useState(""),
    [editing, setEditing] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All chapters"),
    [slot, setSlot] = useState<HTMLElement | null>(null);
  const request = useRef(0),
    lastUser = useRef(user.id);
  const visibleState =
    state.userId === user.id ? state : { cases: [], progress: [] };
  const refresh = useCallback(async () => {
    const generation = ++request.current;
    const r = await fetch("/api/academy"),
      d = await r.json();
    if (generation !== request.current) return;
    if (!r.ok) throw new Error(d.error);
    setState(d);
    setLoading(false);
  }, []);
  useEffect(() => {
    setSlot(
      document.getElementById("academy-page") ??
        document.getElementById("academy-task-inbox"),
    );
  }, [path]);
  useEffect(() => {
    if (lastUser.current !== user.id) {
      ++request.current;
      setState({ cases: [], progress: [] });
      setLoading(true);
      setEditing(false);
      lastUser.current = user.id;
    }
    if (
      path !== "/academy" &&
      !path.startsWith("/modules") &&
      path !== "/my-tasks" &&
      !active?.caseId
    )
      return;
    refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [user.id, path, refresh, active?.caseId]);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("hcm-active-tutorial");
      if (saved) {
        const a = JSON.parse(saved);
        if (moduleById(a.lesson)) {
          setActive(a);
          setPaused(true);
        }
      }
    } catch {
      /* A corrupt browser bookmark can be discarded. */
    }
  }, []);
  useEffect(() => {
    if (active)
      sessionStorage.setItem("hcm-active-tutorial", JSON.stringify(active));
  }, [active]);
  const post = async (b: Row) => {
    const r = await fetch("/api/academy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d.result;
  };
  const saveProgress = async (a: Active, completed = false) => {
    if (a.ownerId !== user.id) return;
    await post({
      action: "progress",
      lesson: a.lesson,
      step: a.step,
      caseId: a.caseId,
      processId: a.processId ?? null,
      completed,
    });
  };
  const mutate = async (b: Row) => {
    setBusy(true);
    setError("");
    try {
      const result = await post(b);
      setSelected(result.id);
      setEditing(false);
      await refresh();
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const safe = (b: Row) => {
    void mutate(b).catch(() => {});
  };
  const m = moduleById(path.split("/")[2] ?? "");
  const cases: Row[] = visibleState.cases.filter(
    (c: Row) => c.module === m?.id,
  );
  const record: Row | undefined =
    cases.find((c) => c.id === selected) ??
    cases.find((c) => c.id === active?.caseId) ??
    cases[0];
  const lesson = active ? moduleById(active.lesson) : undefined;
  const tutorialCase: Row | undefined = visibleState.cases.find(
    (c: Row) => c.id === active?.caseId,
  );
  const nativeProcess: Row | undefined = workspace.processes.find(
    (p: Row) => p.id === active?.processId,
  );
  useEffect(() => {
    if (!active || active.processId || !lesson?.native || lesson.id === "lms")
      return;
    const kind = lesson.id === "hcm" ? "Hire" : "Time Off";
    const found = workspace.processes.find(
      (p: Row) =>
        p.kind === kind &&
        p.initiatorId === active.ownerId &&
        !active.baseline.includes(p.id),
    );
    if (found) setActive((a) => (a ? { ...a, processId: found.id } : a));
  }, [workspace.processes, active, lesson]);
  const start = async (module: AcademyModule, resume = false) => {
    setError("");
    const saved = visibleState.progress.find(
      (p: Row) => p.lesson === module.id,
    );
    const a: Active = {
      lesson: module.id,
      step: resume ? (saved?.step ?? 0) : 0,
      caseId: resume ? (saved?.caseId ?? null) : null,
      processId: resume ? (saved?.processId ?? undefined) : undefined,
      ownerId: user.id,
      baseline: workspace.processes.map((p: Row) => p.id),
    };
    setActive(a);
    setPaused(false);
    setSelected(a.caseId ?? "");
    setEditing(false);
    router.push(module.native ?? "/modules/" + module.id);
    try {
      await saveProgress(a);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const pause = useCallback(() => setPaused(true), []);
  let steps: CoachStep[] = [];
  if (lesson && active) {
    const targetRoute = lesson.native ?? "/modules/" + lesson.id;
    const owner = user.id === active.ownerId;
    const roleReady = () => user.role === lesson.role;
    const createSelector = '[data-coach="new"]';
    const roleStep: CoachStep = {
      title: "Choose your practice role",
      text: `Use ${lesson.role} for this lesson. Open the highlighted account control if needed, choose the account, and enter Practice123!. This teaches the role's actual permission boundary.`,
      selector: ".persona-button",
      ready: roleReady,
    };
    if (!lesson.native) {
      steps = [
        roleStep,
        {
          title: "Start the task",
          text: `Click New practice task in ${lesson.name}. This creates a new exercise, leaving earlier practice records intact.`,
          selector: createSelector,
          ready: () => path === targetRoute && editing,
        },
        ...lesson.fields.map((f) => ({
          title: f.label,
          text: `${f.hint} Try: ${f.example}. Enter it yourself in the highlighted field.`,
          selector: `[data-coach="field-${f.key}"]`,
          ready: valueReady(`[data-coach="field-${f.key}"]`),
        })),
        {
          title: "Save your draft",
          text: "Click Save draft. The server validates every field before saving. If there is an error, correct it and try again; the guide will wait.",
          selector: '[data-coach="save"]',
          ready: () => !!tutorialCase,
        },
        {
          title: runModules.includes(lesson.id)
            ? "Run the exercise"
            : "Submit for review",
          text: runModules.includes(lesson.id)
            ? "Run the local exercise. The output is saved, and the run is recorded in the audit history."
            : `Submit the draft. Its assigned reviewer is ${tutorialCase?.reviewer?.name ?? "the organization's manager"}. Submission does not yet create the final business result.`,
          selector: '[data-coach="submit"]',
          ready: () =>
            !!tutorialCase &&
            ["Submitted", "Completed"].includes(tutorialCase.status),
        },
      ];
      if (!runModules.includes(lesson.id))
        steps.push(
          {
            title: "Hand off to the reviewer",
            text: `Open Switch Practice Persona and sign in as ${tutorialCase?.reviewer?.name ?? "the assigned manager"} (${tutorialCase?.reviewerId ?? "Manager"}), password Practice123!. Then return to this module. The same highlighted task remains selected.`,
            selector: ".persona-button",
            ready: () => user.id === tutorialCase?.reviewerId,
          },
          {
            title: "Review and explain",
            text: `Read the saved details and enter a useful review comment.${lesson.id === "talent" ? " Also choose a manager rating from 1 to 5." : " You may send it back for correction or deny it when practicing independently."}`,
            selector: '[data-coach="feedback"]',
            ready: () =>
              valueReady('[data-coach="feedback"]')() &&
              (lesson.id !== "talent" || valueReady('[data-coach="rating"]')()),
          },
          {
            title: "Approve the request",
            text: "Click Approve. Only this separate, assigned reviewer can approve. Approval posts the domain result and audit history together.",
            selector: '[data-coach="approve"]',
            ready: () => tutorialCase?.status === "Completed",
          },
          {
            title: "Return to the learner",
            text: `Switch back to the original learner account (${active.ownerId}) with password Practice123! to inspect the consequence and save your lesson completion.`,
            selector: ".persona-button",
            ready: () => owner,
          },
        );
      if (lesson.id === "scm")
        steps.push({
          title: "Receive the goods",
          text: "The approved request created a purchase order. Click Receive goods to record its full receipt. No message is sent to a supplier.",
          selector: '[data-coach="receive"]',
          ready: () => !!tutorialCase?.purchase?.received,
        });
      steps.push({
        title: "Inspect the saved result",
        text: `${lesson.outcome} Read the result below, including its history and teaching rules. Your final checkpoint checks saved records, not the number of clicks.`,
        selector: '[data-coach="outcome"]',
        ready: () =>
          owner &&
          tutorialCase?.status === "Completed" &&
          (lesson.id !== "scm" || !!tutorialCase.purchase?.received),
        nextLabel: "Check and finish",
      });
    } else if (lesson.id === "lms") {
      const me = workspace.workers.find((w: Row) => w.id === user.workerId);
      steps = [
        roleStep,
        {
          title: "Open the learning catalog",
          text: "Use Learning in the workspace menu. Choose one course and read its description.",
          selector: '[aria-label="Workspace"] a[href="/learning"]',
          ready: () => path === "/learning",
        },
        {
          title: "Enroll in a course",
          text: "Click Enroll on a course. Enrollment saves your place in your own learner record.",
          selector: '[data-coach="learning-action"]',
          ready: () => !!me?.learning?.length,
        },
        {
          title: "Record completion",
          text: "Click Mark completed on an enrolled course. This small catalog uses self-reported completion; there is no external certificate.",
          selector: '[data-coach="learning-action"]',
          ready: () => !!me?.learning?.some((e: Row) => e.completed),
        },
        {
          title: "Confirm your learning record",
          text: "The course now displays Completed, and the enrollment survives a refresh. Finish to save your tutorial checkpoint.",
          selector: ".benefits-grid",
          ready: () => !!me?.learning?.some((e: Row) => e.completed),
          nextLabel: "Check and finish",
        },
      ];
    } else {
      const isHire = lesson.id === "hcm";
      const pending = nativeProcess?.tasks.find(
        (t: Row) => t.status === "Pending",
      );
      steps = [
        roleStep,
        {
          title: `Open ${lesson.task}`,
          text: isHire
            ? "Use Staffing in the workspace menu. A pre-hire must exist before you can hire; positions must be open."
            : "Open Absence in the workspace menu and inspect your available balance before requesting leave.",
          selector: `[aria-label="Workspace"] a[href="${targetRoute}"]`,
          ready: () => path === targetRoute,
        },
        ...(isHire
          ? [
              {
                title: "Choose the pre-hire",
                text: "Select an eligible pre-hire. Note their organization; the position must belong to the same organization.",
                selector: '.hire-form select[name="prehireId"]',
                ready: valueReady('.hire-form select[name="prehireId"]'),
              },
              {
                title: "Choose an open position",
                text: "Select one of the available positions. The job profile, organization, and location are inherited from it.",
                selector: '.hire-form select[name="positionId"]',
                ready: valueReady('.hire-form select[name="positionId"]'),
              },
              {
                title: "Review hire details",
                text: "Check the hire date, reason, and weekly hours. Use a date on or after the position becomes available. The side panel explains the approval route.",
                selector: '.hire-form input[name="effectiveDate"]',
                ready: valueReady('.hire-form input[name="effectiveDate"]'),
              },
            ]
          : [
              {
                title: "Choose your first day",
                text: "Select a weekday with enough balance and no overlapping request. The lab counts weekdays and has no holiday calendar.",
                selector: 'input[name="effectiveDate"]',
                ready: valueReady('input[name="effectiveDate"]'),
              },
              {
                title: "Choose your last day",
                text: "Set the last day on or after the first day, and add a request note.",
                selector: 'input[name="endDate"]',
                ready: valueReady('input[name="endDate"]'),
              },
            ]),
        {
          title: "Submit the request",
          text: "Click the highlighted submit action. If validation fails, correct the form. A successful submission opens My Tasks and saves an approval request.",
          selector: isHire
            ? ".hire-form .sticky-actions button.primary"
            : ".form-panel button.primary",
          ready: () => !!nativeProcess,
        },
        {
          title: "Open your submitted process",
          text: "Select your request in My Tasks. Its details show the current step, assigned reviewer, and history.",
          selector: active.processId
            ? `[data-process-id="${active.processId}"]`
            : '[aria-label="Workspace"] a[href="/my-tasks"]',
          ready: () =>
            path === "/my-tasks" &&
            !!document.querySelector('[data-coach="native-detail"]'),
        },
        {
          title: "Switch to the assigned manager",
          text: `Use the account control to sign in as ${pending?.assignee?.name ?? "the pending task's manager"} (${pending?.assigneeId ?? "see the task's assigned account"}), password Practice123!. Open My Tasks and select the same process.`,
          selector: ".persona-button",
          ready: () =>
            !!nativeProcess?.tasks.some(
              (t: Row) => t.assigneeId === user.id && t.status === "Pending",
            ) && user.id !== active.ownerId,
        },
        {
          title: "Approve as the manager",
          text: "Review the process details and click Approve. Only the assigned account has authority. Send Back and Deny are available for independent practice.",
          selector: '[data-coach="native-approve"]',
          ready: () =>
            isHire
              ? nativeProcess?.status === "In Progress" ||
                nativeProcess?.status === "Completed"
              : nativeProcess?.status === "Completed",
        },
        {
          title: "Return to the initiating account",
          text: `Switch back to ${active.ownerId}. ${isHire ? "Select the same hire in My Tasks and perform the final HR approval." : "Open Absence to see the reduced balance and approved calendar entry."}`,
          selector: ".persona-button",
          ready: () => owner,
        },
        ...(isHire
          ? [
              {
                title: "Complete final HR review",
                text: "In My Tasks, select this hire and click Approve as HR. This final step creates the worker, fills the position, and generates onboarding tasks.",
                selector: '[data-coach="native-approve"]',
                ready: () => nativeProcess?.status === "Completed",
              },
            ]
          : []),
        {
          title: "Verify the consequence",
          text: isHire
            ? "The process must show Completed. Open the worker to inspect the record. The new employee can sign in to complete onboarding. Finish checks the saved hire outcome."
            : "The approved request has reduced your practice balance. Cancellation restores it. Finish checks that your request was completed.",
          selector: isHire
            ? '[data-coach="native-detail"]'
            : '[aria-label="Workspace"] a[href="/absence"]',
          ready: () => owner && nativeProcess?.status === "Completed",
          nextLabel: "Check and finish",
        },
      ];
    }
  }
  const next = async () => {
    if (!active) return;
    const a = {
      ...active,
      ...(active.step === 0
        ? {
            ownerId: user.id,
            baseline: workspace.processes.map((p: Row) => p.id),
          }
        : {}),
      step: Math.min(active.step + 1, steps.length - 1),
    };
    try {
      if (active.step === steps.length - 1) {
        await saveProgress(active, true);
        setPaused(true);
        setActive(null);
        sessionStorage.removeItem("hcm-active-tutorial");
        await refresh();
        router.push("/academy");
      } else {
        setActive(a);
        await saveProgress(a);
        if (
          lesson?.native &&
          a.step >= 6 &&
          active.processId &&
          path !== "/my-tasks" &&
          lesson.id !== "lms"
        )
          onSelectProcess(active.processId);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const goTask = () => {
    if (lesson) {
      router.push(lesson.native ?? "/modules/" + lesson.id);
      if (active?.caseId) setSelected(active.caseId);
      if (
        !lesson.native &&
        active &&
        active.step >= 2 &&
        active.step < lesson.fields.length + 2 &&
        (!tutorialCase || ["Draft", "Sent Back"].includes(tutorialCase.status))
      )
        setEditing(true);
    }
    setPaused(false);
  };
  const completedLessons = new Set<string>(
    visibleState.progress
      .filter((p: Row) => p.completed)
      .map((p: Row) => p.lesson),
  );
  const completedChapters = academyChapters.filter((c) =>
    c.lessons.every((id) => completedLessons.has(id)),
  ).length;
  const moduleCards = academyModules.filter(
    (x) =>
      (!query ||
        (x.name + x.description).toLowerCase().includes(query.toLowerCase())) &&
      (category === "All chapters" ||
        !!academyChapters
          .find((c) => c.id === category)
          ?.lessons.includes(x.id)),
  );
  const catalog = (
    <div className="academy-page">
      <div className="academy-hero">
        <div>
          <span className="academy-eyebrow">LEARN BY DOING</span>
          <h1>
            Your next skill starts
            <br />
            with one guided step.
          </h1>
          <p>
            A patient guide. Real controls. A safe place to practice.
            <br />
            Follow the highlights, try the task, and see what changes.
          </p>
          <button
            className="primary"
            onClick={() =>
              document
                .getElementById("academy-chapters")
                ?.scrollIntoView({
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                  block: "start",
                })
            }
          >
            View chapters <span>→</span>
          </button>
        </div>
        <div className="academy-illustration" aria-hidden="true">
          <div className="academy-orbit" />
          <div className="academy-mini">
            <span className="academy-check">✓</span>
            <div>
              <small>YOUR NEXT STEP</small>
              <strong>Review. Submit. Learn.</strong>
            </div>
          </div>
          <div className="academy-mini second">
            <b>01</b>
            <span>Every action has a consequence.</span>
          </div>
          <div className="academy-spark">✧</div>
        </div>
      </div>
      <div className="academy-summary">
        <span>
          <strong>
            {completedChapters} / {academyChapters.length}
          </strong>{" "}
          chapters completed
        </span>
        <span>
          <strong>
            {visibleState.progress.filter((p: Row) => p.completed).length} / 11
          </strong>{" "}
          lessons passed
        </span>
        <span>
          <strong>{visibleState.cases.length}</strong> visible practice records
        </span>
        <span>
          <strong>Self-paced</strong> pause and resume anytime
        </span>
      </div>
      <section
        id="academy-chapters"
        className="academy-chapter-overview"
        aria-labelledby="chapter-overview-title"
      >
        <span className="academy-eyebrow">THE COURSE AT A GLANCE</span>
        <h2 id="chapter-overview-title">
          Five chapters. Eleven practical sections.
        </h2>
        <p>
          Choose a chapter to see its sections. Start any section when you are
          ready; progress is saved to your practice account.
        </p>
        <div
          className="academy-roadmap"
          role="group"
          aria-label="Choose a chapter"
        >
          {academyChapters.map((c, index) => {
            const done = c.lessons.filter((id) =>
              completedLessons.has(id),
            ).length;
            return (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => {
                  setCategory(c.id);
                  document
                    .getElementById("academy-library")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <span className="academy-chapter-number">
                  {done === c.lessons.length
                    ? "✓"
                    : String(index + 1).padStart(2, "0")}
                </span>
                <strong>{c.title}</strong>
                <span>
                  {done} / {c.lessons.length} sections completed
                </span>
                <progress
                  aria-label={`${c.title} completion`}
                  max={c.lessons.length}
                  value={done}
                />
              </button>
            );
          })}
        </div>
      </section>
      {active && (
        <div className="academy-resume">
          <div>
            <strong>Continue {lesson?.name}</strong>
            <p>
              Your guide is at step {active.step + 1}. Return to its task when
              ready.
            </p>
          </div>
          <button onClick={goTask}>Resume tutorial →</button>
        </div>
      )}
      <div className="academy-section-heading" id="academy-library">
        <div>
          <span className="academy-eyebrow">YOUR LEARNING PATH</span>
          <h2>
            {category === "All chapters"
              ? "Your chapters & sections"
              : academyChapters.find((c) => c.id === category)?.title}
          </h2>
          <p>
            Work through one section at a time. Passed sections count toward
            chapter completion.
          </p>
        </div>
        <label className="academy-filter">
          Find a topic
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons…"
          />
        </label>
      </div>
      <div className="academy-tabs" role="group" aria-label="Chapter filters">
        <button
          className={category === "All chapters" ? "selected" : ""}
          aria-pressed={category === "All chapters"}
          onClick={() => setCategory("All chapters")}
        >
          All chapters
        </button>
        {category !== "All chapters" && (
          <span className="academy-filter-note">
            Showing one chapter · Use All chapters to browse the full course.
          </span>
        )}
      </div>
      <div className="academy-chapter-sections">
        {academyChapters.map((chapter, chapterIndex) => {
          const chapterModules = chapter.lessons
            .map((id) => moduleCards.find((m) => m.id === id))
            .filter((m): m is AcademyModule => !!m);
          if (!chapterModules.length) return null;
          const done = chapter.lessons.filter((id) =>
            completedLessons.has(id),
          ).length;
          return (
            <section
              className="academy-chapter"
              key={chapter.id}
              aria-labelledby={`chapter-${chapter.id}`}
            >
              <header className="academy-chapter-heading">
                <div>
                  <span className="academy-eyebrow">
                    CHAPTER {chapterIndex + 1}
                  </span>
                  <h2 id={`chapter-${chapter.id}`}>{chapter.title}</h2>
                  <p>{chapter.description}</p>
                </div>
                <div>
                  <strong>
                    {done} / {chapter.lessons.length} sections completed
                  </strong>
                  <progress
                    aria-label={`${chapter.title} section progress`}
                    value={done}
                    max={chapter.lessons.length}
                  />
                </div>
              </header>
              <div className="academy-grid">
                {chapterModules.map((module, i) => {
                  const p = visibleState.progress.find(
                    (p: Row) => p.lesson === module.id,
                  );
                  return (
                    <article
                      className={`academy-course ${module.color}`}
                      key={module.id}
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <div className="academy-course-top">
                        <span className="academy-course-icon">
                          <Icon name={module.icon} size={29} />
                        </span>
                        <span>
                          {p?.completed
                            ? "✓ Passed"
                            : `${module.minutes} min · Guided`}
                        </span>
                      </div>
                      <span className="academy-section-label">
                        Section {chapterIndex + 1}.
                        {chapter.lessons.indexOf(module.id) + 1} ·{" "}
                        {p?.completed
                          ? "Completed"
                          : p
                            ? "In progress"
                            : "Not started"}
                      </span>
                      <h3>{module.name}</h3>
                      <p>{module.description}</p>
                      <div className="academy-course-meta">
                        <span>{module.role}</span>
                        <small>
                          {module.native
                            ? "Connected tenant workflow"
                            : "Functional practice exercise"}
                        </small>
                      </div>
                      <button
                        className="academy-course-start"
                        onClick={() => void start(module, !!p && !p.completed)}
                      >
                        {p?.completed
                          ? "Practice again"
                          : p
                            ? "Resume lesson"
                            : "Start lesson"}
                        <span>→</span>
                      </button>
                      <Link href={module.native ?? "/modules/" + module.id}>
                        Explore independently ↗
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {!moduleCards.length && <p role="status">No topics match your search.</p>}
      <div className="academy-footnote">
        <strong>Learn the concepts. Practice the workflow.</strong>
        <p>
          Independent simulator lessons, not official Workday training or
          certification. Tenant configuration and releases vary. Every module
          lists its sources and the rules used in this lab.
        </p>
      </div>
    </div>
  );
  const taskPage =
    m && !m.native ? (
      <div className="academy-task">
        <div className="section-heading">
          <div>
            <Link href="/academy">← Learning library</Link>
            <h1>{m.task}</h1>
            <p>{m.description}</p>
          </div>
          <button onClick={() => void start(m)}>Guide me through this</button>
        </div>
        <div className="academy-task-banner">
          <span className="academy-course-icon">
            <Icon name={m.icon} />
          </span>
          <div>
            <strong>{m.name} practice workspace</strong>
            <p>
              SIMULATED · {m.role} initiates{" "}
              {runModules.includes(m.id)
                ? "and runs locally"
                : "→ assigned Manager reviews"}{" "}
              · Data is shared within this practice tenant.
            </p>
          </div>
        </div>
        <div className="academy-task-toolbar">
          <button
            className="primary"
            data-coach="new"
            disabled={
              user.role !== m.role || !workspace.permissions.includes(m.domain)
            }
            onClick={() => {
              setEditing(true);
              setSelected("");
              setError("");
            }}
          >
            ＋ New practice task
          </button>
          <span>
            {user.role !== m.role
              ? `Switch to ${m.role} to create a task.`
              : "Use a fresh record for each lesson attempt."}
          </span>
          <button
            onClick={() => void refresh().catch((e) => setError(e.message))}
          >
            Refresh records
          </button>
        </div>
        {editing && (
          <TaskForm
            key={m.id + (selected || "new")}
            module={m}
            record={selected ? record : undefined}
            orgs={workspace.orgs}
            user={user}
            busy={busy}
            onCancel={() => setEditing(false)}
            onSave={async (data, orgId) => {
              const result = await mutate(
                selected && record
                  ? {
                      action: "save",
                      id: record.id,
                      version: record.version,
                      data,
                    }
                  : { action: "create", module: m.id, orgId, data },
              );
              if (active?.lesson === m.id && !active.caseId)
                setActive((a) => (a ? { ...a, caseId: result.id } : a));
            }}
          />
        )}
        <div className="academy-task-grid">
          <section className="panel academy-records">
            <h2>
              Practice records <small>{cases.length}</small>
            </h2>
            {loading ? (
              <p role="status">Loading saved records…</p>
            ) : !cases.length ? (
              <p>
                No records yet. Start a task to create your first practice
                draft.
              </p>
            ) : (
              cases.map((c) => (
                <button
                  key={c.id}
                  className={record?.id === c.id ? "selected" : ""}
                  onClick={() => {
                    setSelected(c.id);
                    setEditing(false);
                  }}
                >
                  <strong>
                    {JSON.parse(c.payload).memo ??
                      JSON.parse(c.payload).name ??
                      JSON.parse(c.payload).goal ??
                      JSON.parse(c.payload).item ??
                      m.task}
                  </strong>
                  <span>
                    {c.status} · {c.owner.name}
                  </span>
                  <small>
                    {c.id.slice(-8)} ·{" "}
                    {new Date(c.createdAt).toLocaleDateString()}
                  </small>
                </button>
              ))
            )}
          </section>
          {record ? (
            <section className="panel academy-detail">
              <div className="section-heading">
                <div>
                  <span className="academy-eyebrow">{record.id}</span>
                  <h2>{m.task}</h2>
                </div>
                <span className="badge">{record.status}</span>
              </div>
              <div className="academy-process-track">
                {["Draft", "Submitted", "Completed"].map((s, i) => (
                  <span
                    key={s}
                    className={record.status === s ? "current" : ""}
                  >
                    <b>{i + 1}</b>
                    {runModules.includes(m.id) && i === 1 ? "Run" : s}
                  </span>
                ))}
              </div>
              <p>
                Owner: <strong>{record.owner.name}</strong> · {record.org.name}
                <br />
                Reviewer:{" "}
                <strong>
                  {record.reviewer?.name ??
                    "No separate approval in this exercise"}
                </strong>
              </p>
              <dl className="academy-details">
                {m.fields.map((f) => (
                  <div key={f.key}>
                    <dt>{f.label}</dt>
                    <dd>{String(JSON.parse(record.payload)[f.key])}</dd>
                  </div>
                ))}
              </dl>
              {record.feedback && (
                <blockquote>
                  <strong>
                    Reviewer feedback{" "}
                    {record.rating ? `· ${record.rating}/5` : ""}
                  </strong>
                  <p>{record.feedback}</p>
                </blockquote>
              )}
              {record.ownerId === user.id && (
                <div className="academy-actions">
                  {["Draft", "Sent Back"].includes(record.status) && (
                    <>
                      <button onClick={() => setEditing(true)}>
                        Edit draft
                      </button>
                      <button
                        className="primary"
                        data-coach="submit"
                        disabled={busy}
                        onClick={() =>
                          safe({
                            action: runModules.includes(m.id)
                              ? "execute"
                              : "submit",
                            id: record.id,
                            version: record.version,
                          })
                        }
                      >
                        {runModules.includes(m.id)
                          ? "Run exercise"
                          : "Submit for review"}
                      </button>
                    </>
                  )}
                  {["Draft", "Sent Back", "Submitted"].includes(
                    record.status,
                  ) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        safe({
                          action: "cancel",
                          id: record.id,
                          version: record.version,
                        })
                      }
                    >
                      Cancel task
                    </button>
                  )}
                  {record.purchase && !record.purchase.received && (
                    <button
                      className="primary"
                      data-coach="receive"
                      disabled={busy}
                      onClick={() =>
                        safe({
                          action: "receive",
                          id: record.id,
                          version: record.version,
                        })
                      }
                    >
                      Receive goods
                    </button>
                  )}
                </div>
              )}
              {record.reviewerId === user.id &&
                record.status === "Submitted" && (
                  <ReviewForm
                    key={record.id + record.version}
                    talent={m.id === "talent"}
                    busy={busy}
                    onReview={(action, feedback, rating) =>
                      safe({
                        action,
                        id: record.id,
                        version: record.version,
                        feedback,
                        ...(rating ? { rating } : {}),
                      })
                    }
                  />
                )}
              {record.status === "Submitted" && record.ownerId === user.id && (
                <div className="hint">
                  Waiting for {record.reviewer?.name} ({record.reviewerId}). Use
                  the account menu to practice the reviewer handoff. The owner
                  cannot approve their own request.
                </div>
              )}
              {record.status === "Completed" && <Outcome record={record} />}
              <details className="academy-history">
                <summary>View saved task history</summary>
                <p>
                  Created {new Date(record.createdAt).toLocaleString()} · Last
                  changed {new Date(record.updatedAt).toLocaleString()} ·
                  Version {record.version}
                </p>
                <p>
                  The full immutable audit is available to authorized accounts
                  in Audit History.
                </p>
                <Link href="/audit">Open Audit History →</Link>
              </details>
            </section>
          ) : (
            <section className="panel academy-empty">
              <Icon name={m.icon} size={48} />
              <h2>Learn through a real action</h2>
              <p>
                Create a practice draft, then follow it through{" "}
                {runModules.includes(m.id)
                  ? "validation and execution"
                  : "review and completion"}
                .
              </p>
              <p>{m.outcome}</p>
            </section>
          )}
        </div>
        {m.id === "studio" && (
          <div
            className="academy-assembly"
            aria-label="Practice assembly stages"
          >
            <span>① Read fixture</span>
            <b>→</b>
            <span>② Validate</span>
            <b>→</b>
            <span>③ Transform</span>
            <b>→</b>
            <span>④ Local output</span>
          </div>
        )}
        <details className="academy-source">
          <summary>Sources and teaching rules</summary>
          <p>{m.notes}</p>
          <a href={m.source} target="_blank" rel="noreferrer">
            Public Workday concept reference ↗
          </a>
          <p>
            Field layout, validation limits, local roles and outcomes are
            independently implemented teaching choices, not verified 1:1 tenant
            behavior.
          </p>
        </details>
      </div>
    ) : null;
  const isAcademy = path === "/academy" || path === "/modules";
  const inbox = path === "/my-tasks";
  return (
    <>
      {slot &&
        createPortal(
          <>
            {error && (
              <div role="alert" className="error">
                {error}
                <button
                  aria-label="Dismiss lesson error"
                  onClick={() => setError("")}
                >
                  ×
                </button>
              </div>
            )}
            {inbox
              ? visibleState.cases.some(
                  (c: Row) =>
                    c.status === "Submitted" && c.reviewerId === user.id,
                ) && (
                  <section className="panel academy-inbox">
                    <h2>Module practice reviews</h2>
                    {visibleState.cases
                      .filter(
                        (c: Row) =>
                          c.status === "Submitted" && c.reviewerId === user.id,
                      )
                      .map((c: Row) => (
                        <div className="plan-row" key={c.id}>
                          <span>
                            {moduleById(c.module)?.task} · {c.owner.name} ·{" "}
                            {c.id.slice(-8)}
                          </span>
                          <Link
                            href={"/modules/" + c.module}
                            onClick={() => setSelected(c.id)}
                          >
                            Review task →
                          </Link>
                        </div>
                      ))}
                  </section>
                )
              : isAcademy
                ? catalog
                : taskPage}
            {!inbox && !isAcademy && !taskPage && (
              <p>
                This module is not available.{" "}
                <Link href="/academy">Return to the learning library.</Link>
              </p>
            )}
          </>,
          slot,
        )}
      {active && !paused && !isAcademy && steps.length > 0 && (
        <Coach
          name={`Section ${academyChapters.findIndex((c) => c.lessons.includes(lesson!.id)) + 1}.${(academyChapters.find((c) => c.lessons.includes(lesson!.id))?.lessons.indexOf(lesson!.id) ?? 0) + 1} · ${lesson!.name}`}
          index={Math.min(active.step, steps.length - 1)}
          total={steps.length}
          step={steps[Math.min(active.step, steps.length - 1)]}
          onNext={() => void next()}
          onBack={() => {
            const a = { ...active, step: Math.max(0, active.step - 1) };
            setActive(a);
            void saveProgress(a).catch((e) => setError(e.message));
          }}
          onPause={pause}
        />
      )}
      {active && (paused || isAcademy) && (
        <div className="academy-pause-bar">
          <span>
            {lesson?.name} guide paused · Step {active.step + 1}
          </span>
          <button onClick={goTask}>Resume guide</button>
          <button
            onClick={() => {
              setActive(null);
              sessionStorage.removeItem("hcm-active-tutorial");
            }}
          >
            Close guide
          </button>
        </div>
      )}
      {error && !slot && (
        <div className="academy-floating-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
    </>
  );
}
function TaskForm({
  module,
  record,
  orgs,
  user,
  busy,
  onSave,
  onCancel,
}: {
  module: AcademyModule;
  record?: Row;
  orgs: Row[];
  user: Row;
  busy: boolean;
  onSave: (data: Row, orgId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const draftKey = `academy-draft-${user.id}-${module.id}`;
  const [draft] = useState<Row>(() => {
    try {
      return typeof window === "undefined"
        ? {}
        : JSON.parse(localStorage.getItem(draftKey) ?? "{}");
    } catch {
      return {};
    }
  });
  const payload = record ? JSON.parse(record.payload) : draft;
  return (
    <form
      className="panel academy-task-form"
      onChange={(e) => {
        if (!record)
          localStorage.setItem(
            draftKey,
            JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
          );
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        const orgId = String(values.orgId);
        delete values.orgId;
        try {
          await onSave(values, orgId);
          localStorage.removeItem(draftKey);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <h2>{record ? "Edit returned / draft task" : "New practice task"}</h2>
      <p>
        Use the guide's examples or enter your own synthetic values. Required
        fields are marked *. New unsaved drafts stay in this browser.
      </p>
      <div className="form-grid">
        <label>
          Organization *
          <select
            name="orgId"
            disabled={!!record}
            defaultValue={
              record?.orgId ?? draft.orgId ?? user.orgId ?? orgs[0]?.id
            }
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        {module.fields.map((f) => (
          <label key={f.key}>
            {f.label} *
            {f.options ? (
              <select
                required
                name={f.key}
                data-coach={"field-" + f.key}
                defaultValue={payload[f.key] ?? ""}
              >
                <option value="">Select an option</option>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                data-coach={"field-" + f.key}
                required
                name={f.key}
                type={f.type === "number" ? "number" : (f.type ?? "text")}
                step={f.type === "number" ? "any" : undefined}
                maxLength={200}
                defaultValue={payload[f.key] ?? ""}
                placeholder={f.type === "date" ? undefined : f.example}
              />
            )}
            <small>{f.hint}</small>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="academy-actions">
        <button className="primary" data-coach="save" disabled={busy}>
          {busy ? "Saving…" : "Save draft"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel editing
        </button>
      </div>
    </form>
  );
}
function ReviewForm({
  talent,
  busy,
  onReview,
}: {
  talent: boolean;
  busy: boolean;
  onReview: (action: string, feedback: string, rating?: number) => void;
}) {
  const [comment, setComment] = useState(""),
    [rating, setRating] = useState("");
  return (
    <section className="academy-review">
      <h3>Assigned review</h3>
      <label>
        Review comment *
        <textarea
          data-coach="feedback"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          minLength={3}
          maxLength={1000}
          required
        />
      </label>
      {talent && (
        <label>
          Manager rating *
          <select
            data-coach="rating"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            required
          >
            <option value="">Select rating</option>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r} / 5
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="academy-actions">
        <button
          data-coach="approve"
          className="primary"
          disabled={busy || comment.trim().length < 3 || (talent && !rating)}
          onClick={() =>
            onReview("approve", comment, Number(rating) || undefined)
          }
        >
          Approve
        </button>
        <button
          disabled={busy || comment.trim().length < 3}
          onClick={() => onReview("sendback", comment)}
        >
          Send back
        </button>
        <button
          disabled={busy || comment.trim().length < 3}
          onClick={() => onReview("deny", comment)}
        >
          Deny
        </button>
      </div>
    </section>
  );
}
function Outcome({ record: r }: { record: Row }) {
  return (
    <section className="academy-outcome" data-coach="outcome">
      <span className="academy-eyebrow">
        ✓ SAVED BUSINESS RESULT · SIMULATED
      </span>
      <h3>
        {r.purchase
          ? "Purchase order"
          : r.payslip
            ? "Teaching payslip"
            : r.ledgerLines?.length
              ? "Posted ledger lines"
              : r.timeEntry
                ? "Approved time entry"
                : r.goal
                  ? "Goal and performance review"
                  : r.run
                    ? "Integration event: Completed"
                    : "Access test result"}
      </h3>
      {r.ledgerLines?.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            {r.ledgerLines.map((l: Row) => (
              <tr key={l.id}>
                <td>{l.account}</td>
                <td>{euro(l.debitCents)}</td>
                <td>{euro(l.creditCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {r.purchase && (
        <p>
          {r.purchase.quantity} × {r.purchase.item} ·{" "}
          {euro(r.purchase.totalCents)}
          <br />
          <strong>
            {r.purchase.received ? "Goods received" : "Awaiting receipt"}
          </strong>{" "}
          · {r.purchase.supplier}
        </p>
      )}
      {r.payslip && (
        <dl className="academy-details">
          {[
            ["Gross pay", r.payslip.grossCents],
            ["Teaching tax (20%)", r.payslip.taxCents],
            ["Fixed deduction", r.payslip.deductionCents],
            ["Net pay", r.payslip.netCents],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt>{k}</dt>
              <dd>{euro(Number(v))}</dd>
            </div>
          ))}
        </dl>
      )}
      {r.timeEntry && (
        <p>
          {r.timeEntry.workDate} · Regular: {r.timeEntry.regularMinutes / 60} h
          · Teaching overtime: {r.timeEntry.overtimeMinutes / 60} h
        </p>
      )}
      {r.goal && (
        <p>
          <strong>{r.goal.goal}</strong>
          <br />
          Due {r.goal.dueDate} · Progress {r.goal.progress}% · Rating{" "}
          {r.goal.managerRating}/5
          <br />
          {r.goal.managerFeedback}
        </p>
      )}
      {r.run && (
        <>
          <ol>
            {JSON.parse(r.run.log).map((s: string) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <pre tabIndex={0}>{r.run.output}</pre>
          <button
            onClick={() => {
              const blob = new Blob([r.run.output], { type: "text/plain" }),
                url = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = url;
              a.download = "practice-output.txt";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download local output
          </button>
        </>
      )}
      {r.accessTest && (
        <p>
          {r.accessTest.role} → {r.accessTest.domain}:{" "}
          <strong>{r.accessTest.decision}</strong>
          <br />
          Business process approval: <strong>Not granted</strong>. Domain access
          does not automatically grant approval authority. Active tenant
          policies were not changed.
        </p>
      )}
    </section>
  );
}
