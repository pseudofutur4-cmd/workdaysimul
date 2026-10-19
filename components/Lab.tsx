"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { hireSchema } from "@/lib/validators";
import { scenarios } from "@/lib/scenarios";
import Icon from "./Icon";
import Academy from "./Academy";
import SidebarLink from "./SidebarLink";
import ImplementationLab from "./ImplementationLab";
import { moduleById } from "@/lib/academy-catalog";
import { newRequestKey } from "@/lib/request-key";

type Row = Record<string, any>;
const localToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
const nav = [
  ["/home", "⌂", "Home"],
  ["/academy", "✧", "Learn step by step"],
  ["/modules", "▣", "Practice Modules"],
  ["/my-tasks", "▤", "My Tasks"],
  ["/workers", "♙", "Worker Directory"],
  ["/organizations", "◇", "Organizations"],
  ["/positions", "▦", "Jobs & Positions"],
  ["/staffing", "⊕", "Staffing"],
  ["/recruiting", "◎", "Recruiting"],
  ["/compensation", "◈", "Compensation"],
  ["/absence", "☀", "Absence"],
  ["/benefits", "♡", "Benefits"],
  ["/learning", "▣", "Learning"],
  ["/reports", "▥", "Reports"],
  ["/admin/security", "⚙", "Security & Processes"],
  ["/audit", "◷", "Audit History"],
  ["/practice", "✧", "Practice Studio"],
];
const money = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={"badge " + String(children).toLowerCase().replaceAll(" ", "-")}
    >
      {children}
    </span>
  );
}
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  value?: string;
  required?: boolean;
};
function Form({
  title,
  description,
  fields,
  onSubmit,
  button = "Save",
  onCancel,
  disabled = false,
}: {
  title: string;
  description?: string;
  fields: Field[];
  onSubmit: (v: Row) => Promise<void>;
  button?: string;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="form-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        const values = Object.fromEntries(new FormData(e.currentTarget));
        try {
          await onSubmit(values);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="panel-heading">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="form-grid">
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.required !== false && <span className="required"> *</span>}
            {f.options ? (
              <select
                name={f.key}
                defaultValue={f.value ?? ""}
                required={f.required !== false}
              >
                <option value="">Select an option</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.key}
                defaultValue={f.value}
                type={f.type ?? "text"}
                required={f.required !== false}
                maxLength={f.type === "email" ? 254 : 200}
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          className="primary"
          data-coach={title === "Review & act" ? "native-approve" : undefined}
          disabled={pending || disabled}
        >
          {pending ? "Saving…" : button}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
export default function Lab() {
  const path = usePathname(),
    router = useRouter();
  const [data, setData] = useState<Row | null>(null),
    [sessionState, setSessionState] = useState<
      "checking" | "signed-in" | "signed-out"
    >("checking"),
    [accounts, setAccounts] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [asOf, setAsOf] = useState(localToday()),
    [persona, setPersona] = useState("hr"),
    [password, setPassword] = useState(""),
    [switching, setSwitching] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [selectedWorker, setSelectedWorker] = useState(""),
    [tab, setTab] = useState("Summary"),
    [selectedProcess, setSelectedProcess] = useState(""),
    [showForm, setShowForm] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(0),
    [mode, setMode] = useState("Guided"),
    [busy, setBusy] = useState(false);
  const sessionRequest = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sessionRequest.current;
    const r = await fetch("/api/lab?asOf=" + asOf);
    if (request !== sessionRequest.current) return;
    if (r.status === 401) {
      setData(null);
      setSessionState("signed-out");
      return;
    }
    const d = await r.json();
    if (request !== sessionRequest.current) return;
    if (!r.ok) throw new Error(d.error);
    setData(d);
    setSessionState("signed-in");
  }, [asOf]);
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);
  useEffect(() => {
    // Revalidate in the background; keep the signed-in workspace on screen.
    reload().catch((e) => setError(e.message));
  }, [reload, path]);
  useEffect(() => {
    setShowForm("");
    setFilter("");
    setPage(0);
    setMobileMenu(false);
  }, [path]);
  const perform = async (payload: Row) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await reload();
      setNotice("Saved to the local practice tenant");
      return d.result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const safe = (p: Row) => perform(p).catch(() => undefined);
  async function signOut() {
    ++sessionRequest.current;
    setBusy(true);
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (!response.ok)
        throw new Error("Could not sign out. Please try again.");
      ++sessionRequest.current;
      setData(null);
      setSessionState("signed-out");
      setPassword("");
      setSwitching(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: persona, password }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error);
      return;
    }
    await reload();
    setSwitching(false);
    setSelectedWorker("");
    setSelectedProcess("");
    setPassword("");
    fetch("/api/session")
      .then((r) => r.json())
      .then(setAccounts);
  }
  const loginForm = (
    <form className="login-form" onSubmit={login}>
      <label htmlFor="practice-account">Practice account</label>
      <select
        id="practice-account"
        value={persona}
        onChange={(e) => setPersona(e.target.value)}
      >
        {accounts.map((a) => (
          <option value={a.id} key={a.id}>
            {a.name} · {a.role}
            {a.orgId ? " · " + a.orgId : ""}
          </option>
        ))}
      </select>
      <label>
        Local demo password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      <p className="muted">
        Synthetic accounts only. Password: <code>Practice123!</code>
      </p>
      <button className="primary">
        {switching ? "Switch practice persona" : "Enter practice tenant"} →
      </button>
    </form>
  );
  if (!data && sessionState === "checking")
    return (
      <main className="session-check" aria-busy={!error}>
        <span className="brand-mark" aria-hidden="true">
          h
        </span>
        <h1>HCM Practice Lab</h1>
        {error ? (
          <>
            <p role="alert">Unable to load your practice session: {error}</p>
            <button
              onClick={() => {
                setError("");
                reload().catch((e) => setError(e.message));
              }}
            >
              Retry
            </button>
          </>
        ) : (
          <p role="status">Checking your practice session…</p>
        )}
      </main>
    );
  if (!data)
    return (
      <main className="login">
        <section className="login-art">
          <div className="brand">
            <span className="brand-mark">h</span> HCM Practice Lab
          </div>
          <div>
            <span className="eyebrow light">YOUR SPACE TO LEARN BY DOING</span>
            <h1>
              Build confidence.
              <br />
              One process
              <br />
              at a time.
            </h1>
            <p>
              A local practice tenant. Real workflow logic.
              <br />
              Room to explore, make mistakes, and try again.
            </p>
            <div className="orbit">
              <span>PEOPLE</span>
              <span>PROCESS</span>
              <span>PRACTICE</span>
            </div>
          </div>
          <p className="muted light">
            Original educational software · Development preview
          </p>
        </section>
        <section className="login-right">
          <span className="eyebrow">
            ASTER VALE • FICTIONAL PRACTICE TENANT
          </span>
          <h2>Welcome to your lab</h2>
          <p>Choose a role to explore the employee lifecycle.</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {loginForm}
          <p className="disclaimer">
            Independent Workday HCM learning simulator.
            <br />
            Not affiliated with Workday, Inc.
          </p>
        </section>
      </main>
    );
  const u = data.user,
    can = (s: string) => data.permissions.includes(s),
    workers: Row[] = data.workers,
    processes: Row[] = data.processes;
  const pending = processes.flatMap((p) =>
    p.tasks
      .filter((t: Row) => t.status === "Pending" && t.assigneeId === u.id)
      .map((t: Row) => ({ ...t, process: p })),
  );
  const openPositions = data.positions.filter((p: Row) => p.status === "Open"),
    activeWorkers = workers.filter((w) => w.employments[0].status === "Active");
  const current = workers.find((w) => w.id === selectedWorker) ?? workers[0],
    me = workers.find((w) => w.id === u.workerId);
  const eligibleNav = nav.filter(
    ([route]) =>
      route === "/home" ||
      route === "/my-tasks" ||
      ((route === "/academy" || route === "/modules") && can("practice.use")) ||
      (route === "/practice" && can("practice.use")) ||
      (route === "/workers" && can("workers.view")) ||
      (route === "/organizations" && can("workers.view")) ||
      (route === "/positions" && can("workers.view")) ||
      (route === "/staffing" &&
        u.role === "HR Administrator" &&
        can("staffing.initiate")) ||
      (route === "/recruiting" &&
        (can("recruiting.modify") || u.role === "Manager")) ||
      (route === "/compensation" && can("compensation.view")) ||
      (route === "/absence" && can("absence.request")) ||
      (route === "/benefits" && can("benefits.self")) ||
      (route === "/learning" && can("learning.self")) ||
      (route === "/reports" && can("reports.view")) ||
      (route === "/admin/security" && can("security.modify")) ||
      (route === "/audit" && can("audit.view")),
  );
  const orgOptions = data.orgs.map((o: Row) => ({
    value: o.id,
    label: o.name + " · " + o.id,
  }));
  const positionOptions = openPositions.map((p: Row) => ({
    value: p.id,
    label: p.id + " · " + p.title + " · " + p.org.name,
  }));
  const workerOptions = activeWorkers.map((w) => ({
    value: w.id,
    label: w.name + " · " + w.id,
  }));
  const openWorker = (id: string) => {
    setSelectedWorker(id);
    setTab("Summary");
    router.push("/workers");
  };
  const processName = (p: Row) =>
    p.worker?.name ??
    p.prehire?.name ??
    p.candidate?.name ??
    p.position?.title ??
    p.kind;
  const genericProcess = (kind: string) => (
    <Form
      key={kind + selectedWorker}
      title={
        kind === "Termination"
          ? "Terminate Employee"
          : kind === "Compensation"
            ? "Propose Compensation Change"
            : "Change Job"
      }
      description="Practice route. Approval is required before the effective-dated record changes."
      button="Submit for approval"
      onCancel={() => setShowForm("")}
      fields={[
        {
          key: "workerId",
          label: "Worker",
          options: workerOptions,
          value: current?.id,
        },
        ...(kind === "Change Job"
          ? [
              {
                key: "positionId",
                label: "New position",
                options: positionOptions,
              },
            ]
          : []),
        {
          key: "effectiveDate",
          label: "Effective date",
          type: "date",
          value: localToday(),
        },
        {
          key: "reason",
          label: "Reason",
          value:
            kind === "Compensation"
              ? "Annual salary review"
              : kind === "Termination"
                ? "Voluntary resignation"
                : "Promotion",
        },
        ...(kind === "Compensation"
          ? [{ key: "amount", label: "Annual salary (EUR)", type: "number" }]
          : [
              {
                key: "hours",
                label: "Scheduled weekly hours",
                type: "number",
                value: "40",
              },
            ]),
      ]}
      onSubmit={async (v) => {
        await perform({
          op: "submit",
          data: { ...v, kind, requestKey: newRequestKey() },
        });
        setShowForm("");
        router.push("/my-tasks");
      }}
    />
  );
  const title =
    (path.startsWith("/implementation") ? "Implementation Lab" : undefined) ??
    nav.find((n) => n[0] === path)?.[2] ??
    (path.startsWith("/modules/")
      ? moduleById(path.split("/")[2])?.name
      : undefined) ??
    (path === "/search" ? "Search" : "Home");

  return (
    <div
      className={
        "app-shell reference-theme " + (mobileMenu ? "navigation-open" : "")
      }
    >
      <a className="skip" href="#content">
        Skip to content
      </a>
      <aside className={"sidebar " + (mobileMenu ? "mobile-open" : "")}>
        <Link className="brand" href="/home">
          <span className="brand-mark">h</span>
          <span>
            HCM<span className="brand-sub">PRACTICE LAB</span>
          </span>
        </Link>
        <div className="tenant-pill">
          <span className="tenant-dot" /> Aster Vale <span>LAB</span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Workspace">
          {eligibleNav.map(([href, icon, label]) => (
            <SidebarLink
              key={href}
              href={href}
              label={label}
              active={
                path === href ||
                (path === "/" && href === "/home") ||
                (href === "/modules" && path.startsWith("/modules/"))
              }
              count={href === "/my-tasks" ? pending.length : undefined}
            />
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="mini-icon">✧</span>
          <strong>Make it a learning moment</strong>
          <p>Explore safely with synthetic data.</p>
          <Link href="/practice">Open Practice Studio ↗</Link>
        </div>
        <div className="version">
          LOCAL TENANT <span>Development preview</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={mobileMenu}
            title="Open applications menu"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Icon name="menu" size={18} />
            <span>MENU</span>
          </button>
          <Link
            className="header-brand"
            href="/home"
            aria-label="HCM Practice Lab home"
          >
            <span className="brand-mark">h</span>
            <span>
              HCM Practice Lab<small>INDEPENDENT LEARNING TENANT</small>
            </span>
          </Link>
          {can("practice.use") && (
            <nav className="lab-mode-switch" aria-label="Lab mode">
              <Link
                href="/home"
                aria-current={
                  !path.startsWith("/implementation") ? "page" : undefined
                }
              >
                Practice Lab
              </Link>
              <Link
                href="/implementation"
                aria-current={
                  path.startsWith("/implementation") ? "page" : undefined
                }
              >
                Implementation Lab
              </Link>
            </nav>
          )}
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/search");
            }}
          >
            <span aria-hidden="true">
              <Icon name="search" size={20} />
            </span>
            <input
              aria-label="Search tasks, workers and reports"
              placeholder="Search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (path !== "/search" && e.target.value.length > 1)
                  router.push("/search");
              }}
            />
            <kbd>↵</kbd>
          </form>
          <Link className="header-tasks" href="/my-tasks">
            <Icon name="/my-tasks" size={24} />{" "}
            <span className="sr-only">My Tasks</span>
            {pending.length > 0 && <b>{pending.length}</b>}
          </Link>
          <button
            className="persona-button"
            onClick={() => {
              setPersona(u.id);
              setSwitching(true);
            }}
            aria-label="Switch Practice Persona"
          >
            <span className="avatar small">
              {u.name
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{u.name}</strong>
              <small>{u.role}</small>
            </span>
            <span>⌄</span>
          </button>
        </header>
        <main id="content" tabIndex={-1}>
          <div className="breadcrumb">
            Aster Vale <span>/</span> {title}
            <span className="local-badge">● LOCAL PRACTICE</span>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              ✓ {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {switching && (
            <section className="panel switch-panel">
              <div className="section-heading">
                <h2>Switch Practice Persona</h2>
                <button onClick={() => setSwitching(false)}>Close</button>
              </div>
              <p>
                Each sign-in creates a separate local session. Permissions
                remain enforced by the server.
              </p>
              {loginForm}
            </section>
          )}
          {(path === "/academy" || path.startsWith("/modules")) && (
            <div id="academy-page" />
          )}
          {path.startsWith("/implementation") && (
            <ImplementationLab
              key={u.id + ":" + (path.split("/")[2] ?? "projects")}
              path={path}
              userId={u.id}
              permitted={can("practice.use")}
            />
          )}
          {(path === "/" || path === "/home") && (
            <div className="reference-home">
              <div className="home-masthead" aria-hidden="true">
                <div />
                <div />
                <div />
              </div>
              <section className="welcome reference-welcome">
                <div>
                  <h1>Welcome, {u.name}</h1>
                  <p>Good to see you, {u.name.split(" ")[0]}.</p>
                </div>
                <span className="tenant-reference-note">
                  Aster Vale · Practice tenant
                </span>
              </section>
              {can("practice.use") && (
                <section className="academy-home-entry">
                  <div>
                    <strong>New here? Let the guide show you.</strong>
                    <p>
                      Numbered instructions and highlights walk you through real
                      practice tasks.
                    </p>
                  </div>
                  <Link className="button primary" href="/academy">
                    Learn step by step →
                  </Link>
                </section>
              )}
              <div className="reference-home-grid">
                <section className="panel inbox-worklet">
                  <div className="worklet-heading">
                    <Icon name="/my-tasks" size={39} />
                    <h2>Inbox</h2>
                    <Link href="/my-tasks" aria-label="Open all My Tasks">
                      View all
                    </Link>
                  </div>
                  {pending.length ? (
                    <div className="home-inbox-items">
                      {pending.slice(0, 5).map((t: Row) => (
                        <button
                          className="next-task"
                          key={t.id}
                          onClick={() => {
                            setSelectedProcess(t.process.id);
                            router.push("/my-tasks");
                          }}
                        >
                          <span>
                            <strong>{t.step}</strong>
                            <small>{processName(t.process)}</small>
                            <small>Effective: {t.process.effectiveDate}</small>
                          </span>
                          <span>›</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="reference-inbox-empty">
                      <Icon name="/my-tasks" size={60} />
                      <strong>No items awaiting your action</strong>
                      <p>Your assigned approvals appear here.</p>
                      <Link href="/my-tasks">Open My Tasks</Link>
                    </div>
                  )}
                  <div className="inbox-footer">
                    {pending.length} items awaiting your action <span>·</span>{" "}
                    {u.role}
                  </div>
                </section>
                <section className="panel applications-worklet">
                  <div className="worklet-heading">
                    <Icon name="applications" size={39} />
                    <div>
                      <h2>Applications</h2>
                      <small>
                        {
                          eligibleNav.filter(
                            (n) => !["/home", "/my-tasks"].includes(n[0]),
                          ).length
                        }{" "}
                        items
                      </small>
                    </div>
                  </div>
                  <div className="application-grid">
                    {eligibleNav
                      .filter((n) => !["/home", "/my-tasks"].includes(n[0]))
                      .map(([href, , label]) => (
                        <Link
                          className="application-tile"
                          aria-label={"Open " + label + " application"}
                          href={href}
                          key={href}
                        >
                          <span className="application-icon">
                            <Icon name={href} size={49} />
                          </span>
                          <strong>{label}</strong>
                        </Link>
                      ))}
                  </div>
                </section>
              </div>
              <section
                className="reference-tenant-summary"
                aria-label="Practice tenant summary"
              >
                <span>
                  <strong>{activeWorkers.length}</strong> visible active workers
                </span>
                <span>
                  <strong>{openPositions.length}</strong> open positions
                </span>
                <span>
                  <strong>
                    {data.attempts.filter((a: Row) => a.score === 100).length}
                  </strong>{" "}
                  practice achievements
                </span>
                <Link href="/practice">Guided practice →</Link>
              </section>
            </div>
          )}
          {path === "/search" && (
            <>
              <Heading
                title="Search your workspace"
                subtitle={`Results for “${query}” · filtered by your current permissions`}
              />
              <section className="panel">
                <h3>Tasks & reports</h3>
                <div className="search-results">
                  {eligibleNav
                    .filter((n) =>
                      n[2].toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((n) => (
                      <Link key={n[0]} href={n[0]}>
                        <span>{n[1]}</span>
                        <strong>{n[2]}</strong>
                        <small>Task / application</small> →
                      </Link>
                    ))}
                </div>
                <h3>Workers</h3>
                <div className="search-results">
                  {workers
                    .filter(
                      (w) =>
                        w.name.toLowerCase().includes(query.toLowerCase()) ||
                        w.id.includes(query),
                    )
                    .slice(0, 30)
                    .map((w) => (
                      <button key={w.id} onClick={() => openWorker(w.id)}>
                        <span className="avatar small">{w.name[0]}</span>
                        <strong>{w.name}</strong>
                        <small>
                          {w.employments[0].title} · {w.id}
                        </small>{" "}
                        →
                      </button>
                    ))}
                </div>
                <h3>Pre-hires</h3>
                <div className="search-results">
                  {data.prehires
                    .filter((p: Row) =>
                      p.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .slice(0, 10)
                    .map((p: Row) => (
                      <Link key={p.id} href="/staffing">
                        <strong>{p.name}</strong>
                        <small>
                          {p.workerId ? "Hired" : "Eligible pre-hire"}
                        </small>{" "}
                        →
                      </Link>
                    ))}
                </div>
                <h3>Organizations & positions</h3>
                <div className="search-results">
                  {data.orgs
                    .filter((o: Row) =>
                      o.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .slice(0, 10)
                    .map((o: Row) => (
                      <Link key={o.id} href="/organizations">
                        <strong>{o.name}</strong>
                        <small>{o.id}</small> →
                      </Link>
                    ))}
                  {data.positions
                    .filter((p: Row) =>
                      (p.title + " " + p.id)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .slice(0, 10)
                    .map((p: Row) => (
                      <Link key={p.id} href="/positions">
                        <strong>{p.title}</strong>
                        <small>
                          {p.id} · {p.status}
                        </small>{" "}
                        →
                      </Link>
                    ))}
                </div>
              </section>
            </>
          )}
          {path === "/my-tasks" && (
            <>
              <div id="academy-task-inbox" />
              <ProcessList
                processes={processes}
                processName={processName}
                filter={filter}
                setFilter={setFilter}
                selectedProcess={selectedProcess}
                setSelectedProcess={setSelectedProcess}
                u={u}
                data={data}
                showForm={showForm}
                setShowForm={setShowForm}
                perform={perform}
                safe={safe}
                openWorker={openWorker}
              />
              {me?.onboarding?.length > 0 && (
                <section className="panel">
                  <h3>Your onboarding</h3>
                  {me?.onboarding.map((t: Row) => (
                    <div className="plan-row" key={t.id}>
                      <span>{t.label}</span>
                      {t.completed ? (
                        <Badge>Completed</Badge>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() => safe({ op: "onboarding", id: t.id })}
                        >
                          Mark completed
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {path === "/staffing" && (
            <>
              <Heading
                title="Hire Employee"
                subtitle="Turn a pre-hire into a colleague. Every step leaves a trace."
                action={
                  can("staffing.initiate") && u.role === "HR Administrator" ? (
                    <button
                      onClick={() =>
                        setShowForm(showForm === "prehire" ? "" : "prehire")
                      }
                    >
                      ＋ Create pre-hire
                    </button>
                  ) : undefined
                }
              />
              <div className="callout">
                Practice route: HR initiation → Manager approval → HR final
                review → Employee & onboarding. Source: HCM guide pp. 625–631,
                678–681. Routing and visual layout are inferred.
              </div>
              {u.role === "HR Administrator" && can("staffing.initiate") ? (
                <>
                  {showForm === "prehire" && (
                    <Form
                      title="Create Pre-Hire"
                      fields={[
                        { key: "name", label: "Legal name" },
                        {
                          key: "email",
                          label: "Synthetic contact email",
                          type: "email",
                        },
                        {
                          key: "orgId",
                          label: "Supervisory organization",
                          options: orgOptions,
                        },
                      ]}
                      button="Create pre-hire"
                      onCancel={() => setShowForm("")}
                      onSubmit={async (v) => {
                        await perform({ op: "prehire", data: v });
                        setShowForm("");
                      }}
                    />
                  )}
                  <HireForm
                    data={data}
                    positions={openPositions}
                    onSubmit={async (v) => {
                      const r = await perform({ op: "submit", data: v });
                      setSelectedProcess(r.id);
                      router.push("/my-tasks");
                    }}
                  />
                </>
              ) : (
                <Empty text="Your current role does not have Hire initiation permission." />
              )}
            </>
          )}
          {path === "/workers" && (
            <>
              <Heading
                title="Worker Directory"
                subtitle="Find your people. Understand their story."
              />
              <div className="directory-layout">
                <section className="panel directory-list">
                  <label className="sr-only" htmlFor="worker-filter">
                    Find a worker
                  </label>
                  <input
                    id="worker-filter"
                    placeholder="Find a worker…"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(0);
                    }}
                  />
                  {workers
                    .filter((w) =>
                      (w.name + " " + w.id)
                        .toLowerCase()
                        .includes(filter.toLowerCase()),
                    )
                    .slice(page * 15, page * 15 + 15)
                    .map((w) => (
                      <button
                        key={w.id}
                        className={
                          "worker-row " +
                          (current?.id === w.id ? "selected" : "")
                        }
                        onClick={() => {
                          setSelectedWorker(w.id);
                          setTab("Summary");
                        }}
                      >
                        <span className="avatar">
                          {w.name
                            .split(" ")
                            .slice(0, 2)
                            .map((n: string) => n[0])
                            .join("")}
                        </span>
                        <span>
                          <strong>{w.name}</strong>
                          <small>{w.employments[0].title}</small>
                        </span>
                      </button>
                    ))}
                  <div className="pagination">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      ←
                    </button>
                    <span>Page {page + 1}</span>
                    <button
                      disabled={
                        (page + 1) * 15 >=
                        workers.filter((w) =>
                          (w.name + " " + w.id)
                            .toLowerCase()
                            .includes(filter.toLowerCase()),
                        ).length
                      }
                      onClick={() => setPage(page + 1)}
                    >
                      →
                    </button>
                  </div>
                </section>
                <section className="panel profile">
                  {current ? (
                    <>
                      <div className="profile-banner">
                        <span className="avatar large">
                          {current.name
                            .split(" ")
                            .slice(0, 2)
                            .map((n: string) => n[0])
                            .join("")}
                        </span>
                        <div>
                          <h2>{current.name}</h2>
                          <p>{current.employments[0].title}</p>
                          <span>
                            {current.id} ·{" "}
                            <Badge>{current.employments[0].status}</Badge>
                          </span>
                        </div>
                      </div>
                      <div className="related-actions">
                        <span>Related Actions</span>
                        {can("staffing.initiate") && (
                          <>
                            <button onClick={() => setShowForm("Change Job")}>
                              Change Job ↗
                            </button>
                            {u.role === "HR Administrator" && (
                              <button
                                onClick={() => setShowForm("Termination")}
                              >
                                Terminate ↗
                              </button>
                            )}
                          </>
                        )}
                        {can("compensation.modify") &&
                          u.role === "HR Administrator" && (
                            <button onClick={() => setShowForm("Compensation")}>
                              Compensation ↗
                            </button>
                          )}
                      </div>
                      {["Change Job", "Termination", "Compensation"].includes(
                        showForm,
                      ) && genericProcess(showForm)}
                      <div
                        className="tabs"
                        role="tablist"
                        aria-label="Worker profile tabs"
                      >
                        {[
                          "Summary",
                          "Job",
                          "Organizations",
                          ...(can("contact.view") ? ["Contact"] : []),
                          ...(can("compensation.view") ? ["Compensation"] : []),
                          "History",
                        ].map((t) => (
                          <button
                            key={t}
                            role="tab"
                            aria-selected={tab === t}
                            onClick={() => setTab(t)}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <div role="tabpanel">
                        <h3>{tab}</h3>
                        {["Summary", "Job", "Organizations"].includes(tab) && (
                          <div className="detail-grid">
                            <Detail
                              label="Supervisory organization"
                              value={current.employments[0].org.name}
                            />
                            <Detail
                              label="Company"
                              value={
                                data.orgs.find(
                                  (o: Row) =>
                                    o.id === current.employments[0].orgId,
                                )?.company.name
                              }
                            />
                            <Detail
                              label="Position"
                              value={current.employments[0].positionId}
                            />
                            <Detail
                              label="Job profile"
                              value={
                                current.employments[0].position.profile.name
                              }
                            />
                            <Detail
                              label="Location"
                              value={
                                current.employments[0].position.location.name
                              }
                            />
                            <Detail
                              label="Worker type"
                              value={current.workerType}
                            />
                            <Detail
                              label="Effective since"
                              value={current.employments[0].effectiveDate}
                            />
                            <Detail
                              label="Weekly hours / FTE"
                              value={`${current.employments[0].hours} / ${(current.employments[0].hours / 40) * 100}%`}
                            />
                            <Detail
                              label="Manager account"
                              value={current.employments[0].org.managerId}
                            />
                          </div>
                        )}
                        {tab === "Contact" && (
                          <>
                            <Detail
                              label="Work email"
                              value={current.contact?.workEmail}
                            />
                            {can("contact.modify") &&
                            (u.role === "HR Administrator" ||
                              u.workerId === current.id) ? (
                              <Form
                                key={current.id}
                                title="Update personal contact"
                                fields={[
                                  {
                                    key: "email",
                                    label: "Personal email (synthetic)",
                                    type: "email",
                                    value: current.contact?.personalEmail,
                                  },
                                ]}
                                button="Save contact"
                                onSubmit={async (v) => {
                                  await perform({
                                    op: "contact",
                                    workerId: current.id,
                                    email: v.email,
                                  });
                                }}
                              />
                            ) : (
                              <Detail
                                label="Personal email"
                                value={current.contact?.personalEmail}
                              />
                            )}
                          </>
                        )}
                        {tab === "Compensation" && (
                          <>
                            <Detail
                              label="Annual salary (EUR)"
                              value={
                                current.compensation?.[0]
                                  ? money(current.compensation[0].annualAmount)
                                  : "No salary record"
                              }
                            />
                            <p className="source-note">
                              Restricted by compensation.view on the server.
                              Annual salary teaching model.
                            </p>
                          </>
                        )}
                        {tab === "History" && (
                          <>
                            <h4>Employment snapshots as of {asOf}</h4>
                            {current.employments.map((e: Row) => (
                              <div className="history-row" key={e.id}>
                                <span>
                                  {e.effectiveDate} · {e.title} · {e.positionId}
                                </span>
                                <Badge>{e.status}</Badge>
                              </div>
                            ))}
                            {processes
                              .filter((p) => p.workerId === current.id)
                              .map((p) => (
                                <button
                                  className="history-row"
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedProcess(p.id);
                                    router.push("/my-tasks");
                                  }}
                                >
                                  {p.effectiveDate} · {p.kind}{" "}
                                  <Badge>{p.status}</Badge> →
                                </button>
                              ))}
                            <p className="muted">
                              Use the as-of date to inspect a historical
                              employment snapshot. Audit includes actor and
                              process references.
                            </p>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <Empty text="No workers are visible for this persona and date." />
                  )}
                </section>
              </div>
            </>
          )}
          {path === "/positions" && (
            <>
              <Heading
                title="Jobs & Positions"
                subtitle="A clear structure for the work ahead."
                action={
                  can("foundations.modify") ? (
                    <div className="inline-actions">
                      <button onClick={() => setShowForm("profile")}>
                        ＋ Job profile
                      </button>
                      <button
                        className="primary"
                        onClick={() => setShowForm("position")}
                      >
                        ＋ Position
                      </button>
                    </div>
                  ) : undefined
                }
              />
              {showForm === "profile" && (
                <Form
                  title="Create Job Profile"
                  fields={[
                    { key: "name", label: "Job profile name" },
                    {
                      key: "familyId",
                      label: "Job family",
                      options: data.families.map((f: Row) => ({
                        value: f.id,
                        label: f.name,
                      })),
                    },
                    {
                      key: "effectiveDate",
                      label: "Effective date",
                      type: "date",
                      value: localToday(),
                    },
                  ]}
                  onCancel={() => setShowForm("")}
                  onSubmit={async (v) => {
                    await perform({ op: "profile", data: v });
                    setShowForm("");
                  }}
                />
              )}
              {showForm === "position" && (
                <Form
                  title="Create Position"
                  fields={[
                    { key: "title", label: "Business title" },
                    {
                      key: "orgId",
                      label: "Supervisory organization",
                      options: orgOptions,
                    },
                    {
                      key: "profileId",
                      label: "Job profile",
                      options: data.profiles.map((p: Row) => ({
                        value: p.id,
                        label: p.name,
                      })),
                    },
                    {
                      key: "locationId",
                      label: "Location",
                      options: data.locations.map((l: Row) => ({
                        value: l.id,
                        label: l.name,
                      })),
                    },
                    {
                      key: "earliestDate",
                      label: "Earliest hire date",
                      type: "date",
                      value: localToday(),
                    },
                  ]}
                  onCancel={() => setShowForm("")}
                  onSubmit={async (v) => {
                    await perform({ op: "position", data: v });
                    setShowForm("");
                  }}
                />
              )}
              <DataTable
                rows={data.positions}
                columns={[
                  ["id", "Position"],
                  ["title", "Business title"],
                  ["org.name", "Supervisory organization"],
                  ["profile.name", "Job profile"],
                  ["location.name", "Location"],
                  ["status", "Status"],
                ]}
                search="Search positions"
              />
            </>
          )}
          {path === "/organizations" && (
            <>
              <Heading
                title="Organizations"
                subtitle="See where every team belongs."
                action={
                  can("foundations.modify") ? (
                    <button
                      className="primary"
                      onClick={() => setShowForm("organization")}
                    >
                      ＋ Organization
                    </button>
                  ) : undefined
                }
              />
              {showForm === "organization" && (
                <Form
                  title="Create Supervisory Organization"
                  fields={[
                    { key: "name", label: "Organization name" },
                    {
                      key: "parentId",
                      label: "Superior organization",
                      options: orgOptions,
                    },
                    {
                      key: "companyId",
                      label: "Company",
                      options: Array.from(
                        new Map<string, Row>(
                          data.orgs.map((o: Row) => [o.company.id, o.company]),
                        ).values(),
                      ).map((c: Row) => ({ value: c.id, label: c.name })),
                    },
                    { key: "costCenter", label: "Cost center" },
                  ]}
                  onCancel={() => setShowForm("")}
                  onSubmit={async (v) => {
                    await perform({ op: "organization", data: v });
                    setShowForm("");
                    fetch("/api/session")
                      .then((r) => r.json())
                      .then(setAccounts);
                  }}
                />
              )}
              <section className="panel org-chart">
                <div className="org-root">
                  ◇<strong>Aster Vale</strong>
                  <small>Fictional practice organization</small>
                </div>
                <div className="org-grid">
                  {data.orgs.map((o: Row) => (
                    <div className="org-card" key={o.id}>
                      <span className="eyebrow">{o.id}</span>
                      <h3>{o.name}</h3>
                      <p>
                        {o.company.country} · {o.costCenter}
                      </p>
                      <small>Reports to {o.parentId ?? "Tenant root"}</small>
                      <div className="role-line">
                        <span>Visible members</span>
                        <strong>
                          {
                            activeWorkers.filter(
                              (w) => w.employments[0].orgId === o.id,
                            ).length
                          }
                        </strong>
                      </div>
                      <small>Manager: {o.managerId ?? "Unassigned"}</small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {path === "/recruiting" && (
            <>
              <Heading
                title="Recruiting"
                subtitle="From potential to possibility. All postings and offers are simulated."
                action={
                  can("recruiting.modify") ? (
                    <div className="inline-actions">
                      <button onClick={() => setShowForm("candidate")}>
                        ＋ Candidate
                      </button>
                      <button
                        className="primary"
                        onClick={() => setShowForm("req")}
                      >
                        ＋ Requisition
                      </button>
                    </div>
                  ) : undefined
                }
              />
              {showForm === "req" && (
                <Form
                  title="Create Job Requisition"
                  fields={[
                    { key: "title", label: "Requisition title" },
                    {
                      key: "positionId",
                      label: "Open position",
                      options: positionOptions,
                    },
                    {
                      key: "effectiveDate",
                      label: "Recruiting start date",
                      type: "date",
                      value: localToday(),
                    },
                  ]}
                  button="Submit for approval"
                  onCancel={() => setShowForm("")}
                  onSubmit={async (v) => {
                    await perform({
                      op: "requisition",
                      data: { ...v, requestKey: newRequestKey() },
                    });
                    setShowForm("");
                  }}
                />
              )}
              {showForm === "candidate" && (
                <Form
                  title="Add Candidate"
                  fields={[
                    { key: "name", label: "Candidate name" },
                    { key: "email", label: "Synthetic email", type: "email" },
                    {
                      key: "requisitionId",
                      label: "Open posted requisition",
                      options: data.requisitions
                        .filter((r: Row) => r.status === "Open" && r.posted)
                        .map((r: Row) => ({ value: r.id, label: r.title })),
                    },
                  ]}
                  onCancel={() => setShowForm("")}
                  onSubmit={async (v) => {
                    await perform({ op: "candidate", data: v });
                    setShowForm("");
                  }}
                />
              )}
              <div className="stats-grid">
                <Stat
                  label="Requisitions"
                  value={data.requisitions.length}
                  icon="▦"
                  note="Within your scope"
                  color="blue"
                />
                <Stat
                  label="Candidates"
                  value={data.requisitions.reduce(
                    (n: number, r: Row) => n + r.candidates.length,
                    0,
                  )}
                  icon="♙"
                  note="Distinct applicant records"
                  color="purple"
                />
                <Stat
                  label="Offer approvals"
                  value={
                    data.requisitions
                      .flatMap((r: Row) => r.candidates)
                      .filter((c: Row) => c.stage === "Offer Pending").length
                  }
                  icon="▤"
                  note="Manager decision required"
                  color="amber"
                />
                <Stat
                  label="Accepted offers"
                  value={
                    data.requisitions
                      .flatMap((r: Row) => r.candidates)
                      .filter((c: Row) => c.stage === "Accepted").length
                  }
                  icon="✓"
                  note="Linked to pre-hire"
                  color="green"
                />
              </div>
              {data.requisitions.map((r: Row) => (
                <section className="panel" key={r.id}>
                  <div className="section-heading">
                    <div>
                      <h3>{r.title}</h3>
                      <p className="muted">
                        {r.id} · {r.position.org.name} · {r.positionId}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <Badge>{r.status}</Badge>
                      {can("recruiting.modify") && r.status === "Open" && (
                        <button
                          onClick={() => safe({ op: "publish", id: r.id })}
                        >
                          {r.posted ? "Unpublish" : "Publish"} SIMULATED
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="candidate-grid">
                    {r.candidates.map((c: Row) => (
                      <div className="candidate-card" key={c.id}>
                        <span className="avatar">
                          {c.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </span>
                        <h4>{c.name}</h4>
                        <Badge>{c.stage}</Badge>
                        <div className="inline-actions">
                          {can("recruiting.modify") &&
                            ["Applied", "Review", "Interview"].includes(
                              c.stage,
                            ) && (
                              <button
                                onClick={() =>
                                  safe({
                                    op: "advance",
                                    id: c.id,
                                    action: "advance",
                                  })
                                }
                              >
                                {c.stage === "Interview"
                                  ? "Request offer approval"
                                  : "Move to " +
                                    (c.stage === "Applied"
                                      ? "Review"
                                      : "Interview")}{" "}
                                →
                              </button>
                            )}
                          {u.role === "Manager" &&
                            c.stage === "Offer Pending" && (
                              <>
                                <button
                                  className="primary"
                                  onClick={() =>
                                    safe({
                                      op: "advance",
                                      id: c.id,
                                      action: "approve-offer",
                                    })
                                  }
                                >
                                  Approve offer
                                </button>
                                <button
                                  onClick={() =>
                                    safe({
                                      op: "advance",
                                      id: c.id,
                                      action: "deny-offer",
                                    })
                                  }
                                >
                                  Deny
                                </button>
                              </>
                            )}
                          {can("recruiting.modify") &&
                            c.stage === "Offer Approved" && (
                              <>
                                <button
                                  onClick={() =>
                                    safe({
                                      op: "advance",
                                      id: c.id,
                                      action: "accept",
                                    })
                                  }
                                >
                                  Record acceptance
                                </button>
                                <button
                                  onClick={() =>
                                    safe({
                                      op: "advance",
                                      id: c.id,
                                      action: "decline",
                                    })
                                  }
                                >
                                  Record decline
                                </button>
                              </>
                            )}
                          {c.prehireId && (
                            <Link href="/staffing">View in Staffing →</Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!r.candidates.length && (
                    <p className="muted">No candidates attached yet.</p>
                  )}
                </section>
              ))}
            </>
          )}
          {path === "/compensation" && (
            <>
              <Heading
                title="Compensation"
                subtitle="Practice a thoughtful, permission-controlled salary review."
                action={
                  can("compensation.modify") &&
                  u.role === "HR Administrator" ? (
                    <button
                      className="primary"
                      onClick={() => setShowForm("Compensation")}
                    >
                      ＋ Propose change
                    </button>
                  ) : undefined
                }
              />
              {showForm === "Compensation" && genericProcess("Compensation")}
              {can("compensation.view") ? (
                <DataTable
                  rows={workers.map((w) => ({
                    id: w.id,
                    name: w.name,
                    org: w.employments[0].org.name,
                    salary: w.compensation?.[0]
                      ? money(w.compensation[0].annualAmount)
                      : "Not assigned",
                    effective: w.compensation?.[0]?.effectiveDate ?? "—",
                  }))}
                  columns={[
                    ["id", "Worker ID"],
                    ["name", "Worker"],
                    ["org", "Organization"],
                    ["salary", "Annual EUR"],
                    ["effective", "Effective date"],
                  ]}
                  search="Search compensation"
                />
              ) : (
                <Empty text="compensation.view permission is required." />
              )}
              <p className="source-note">
                Annual EUR amounts only. No payroll, tax, currency conversion or
                real payments.
              </p>
            </>
          )}
          {path === "/absence" && (
            <>
              <Heading title="Absence" subtitle="Make space for time away." />
              <div className="stats-grid">
                <Stat
                  label="Annual entitlement"
                  value={me?.balance?.entitlement ?? 0}
                  icon="☀"
                  note="Synthetic static bank · weekdays"
                  color="blue"
                />
                <Stat
                  label="Approved days used"
                  value={me?.balance?.used ?? 0}
                  icon="◷"
                  note="Includes future approved requests"
                  color="amber"
                />
                <Stat
                  label="Available days"
                  value={
                    (me?.balance?.entitlement ?? 0) - (me?.balance?.used ?? 0)
                  }
                  icon="✓"
                  note="No holiday or accrual calculation"
                  color="green"
                />
              </div>
              {can("absence.request") && me ? (
                <Form
                  title="Request Time Off"
                  description="Annual leave teaching policy: weekdays only, no holidays, up to available balance, no overlaps."
                  fields={[
                    {
                      key: "effectiveDate",
                      label: "First day",
                      type: "date",
                      value: localToday(),
                    },
                    {
                      key: "endDate",
                      label: "Last day",
                      type: "date",
                      value: localToday(),
                    },
                    {
                      key: "reason",
                      label: "Request note",
                      value: "Annual leave",
                    },
                  ]}
                  button="Submit request"
                  onSubmit={async (v) => {
                    await perform({
                      op: "submit",
                      data: {
                        ...v,
                        kind: "Time Off",
                        workerId: u.workerId,
                        requestKey: newRequestKey(),
                      },
                    });
                    router.push("/my-tasks");
                  }}
                />
              ) : (
                <Empty text="Sign in as an active employee to request time off." />
              )}
              <section className="panel">
                <h3>Approved absence calendar</h3>
                {me?.absences
                  ?.filter((a: Row) => !a.canceled)
                  .map((a: Row) => (
                    <div className="plan-row" key={a.id}>
                      <span>
                        {a.startDate} → {a.endDate} · {a.days} weekday(s)
                      </span>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Cancel this approved absence and restore its balance?",
                            )
                          )
                            safe({ op: "cancel-absence", id: a.id });
                        }}
                      >
                        Cancel absence
                      </button>
                    </div>
                  ))}
                {!me?.absences?.length && (
                  <p className="muted">No approved absences yet.</p>
                )}
              </section>
            </>
          )}
          {path === "/benefits" && (
            <>
              <Heading
                title="Benefits"
                subtitle="Explore synthetic plans and eligibility rules."
              />
              <div className="callout">
                Practice enrollment window: 2024–2030. Active employees only.
                Prices and eligibility are fictional.
              </div>
              <div className="benefits-grid">
                {data.plans.map((p: Row) => (
                  <section className="panel benefit-card" key={p.id}>
                    <span className="benefit-icon">♡</span>
                    <h3>{p.name}</h3>
                    <div className="plan-price">
                      {money(p.monthlyCost)}
                      <small> / month</small>
                    </div>
                    {me?.enrollments?.some((e: Row) => e.planId === p.id) ? (
                      <Badge>Enrolled</Badge>
                    ) : (
                      <Form
                        title="Your election"
                        fields={[
                          {
                            key: "effectiveDate",
                            label: "Coverage effective date",
                            type: "date",
                            value: localToday(),
                          },
                        ]}
                        button="Enroll in plan"
                        onSubmit={async (v) => {
                          await perform({
                            op: "enroll-benefit",
                            planId: p.id,
                            effectiveDate: v.effectiveDate,
                          });
                        }}
                      />
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {path === "/learning" && (
            <>
              <Heading
                title="Learning"
                subtitle="A small catalog for independent practice."
              />
              <div className="benefits-grid">
                {data.courses.map((c: Row) => {
                  const e = me?.learning?.find((e: Row) => e.courseId === c.id);
                  return (
                    <section className="panel" key={c.id}>
                      <span className="benefit-icon">▣</span>
                      <h3>{c.name}</h3>
                      <p className="muted">
                        Simulated self-reported completion. No course media or
                        certification.
                      </p>
                      {e?.completed ? (
                        <Badge>Completed</Badge>
                      ) : (
                        <button
                          className="primary"
                          data-coach="learning-action"
                          disabled={busy}
                          onClick={() =>
                            safe({
                              op: "learning",
                              id: c.id,
                              action: e ? "complete" : "enroll",
                            })
                          }
                        >
                          {e ? "Mark completed" : "Enroll"}
                        </button>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
          {path === "/reports" && (
            <>
              <Heading
                title="Worker & Headcount Report"
                subtitle="Effective-dated, scoped data. The export uses the same server policies."
                action={
                  can("reports.view") ? (
                    <a
                      className="button primary"
                      href={
                        "/api/reports?asOf=" +
                        asOf +
                        "&q=" +
                        encodeURIComponent(filter)
                      }
                    >
                      Export CSV ↓
                    </a>
                  ) : undefined
                }
              />
              <section className="panel">
                <div className="report-summary">
                  <strong>
                    {
                      activeWorkers.filter((w) =>
                        w.name.toLowerCase().includes(filter.toLowerCase()),
                      ).length
                    }
                  </strong>
                  <span>active workers in current filter</span>
                </div>
                <label className="filter-label">
                  Filter by worker name
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="All workers"
                  />
                </label>
                <DataTable
                  rows={workers
                    .filter((w) =>
                      w.name.toLowerCase().includes(filter.toLowerCase()),
                    )
                    .map((w) => ({
                      id: w.id,
                      name: w.name,
                      org: w.employments[0].org.name,
                      title: w.employments[0].title,
                      status: w.employments[0].status,
                    }))}
                  columns={[
                    ["id", "Worker ID"],
                    ["name", "Worker"],
                    ["org", "Organization"],
                    ["title", "Job title"],
                    ["status", "Status"],
                  ]}
                  onRow={(w) => openWorker(w.id)}
                />
              </section>
            </>
          )}
          {path === "/admin/security" && (
            <>
              <Heading
                title="Security & Business Processes"
                subtitle="Understand why a persona can view data or perform an action."
              />
              <div className="callout">
                Domain permissions and process initiator/approver permissions
                are independent checks. Scope is enforced at the service layer.
                Changes activate only after explicit confirmation.
              </div>
              {can("security.modify") ? (
                <>
                  <Form
                    title="Edit Domain Security Policy"
                    fields={[
                      {
                        key: "role",
                        label: "Role",
                        options: [
                          "Manager",
                          "HR Administrator",
                          "HR Partner",
                          "Employee",
                          "Auditor",
                          "Recruiting Partner",
                          "Compensation Partner",
                        ].map((v) => ({ value: v, label: v })),
                      },
                      {
                        key: "domain",
                        label: "Domain",
                        options: [
                          "workers.view",
                          "contact.view",
                          "contact.modify",
                          "compensation.view",
                          "process.approve",
                          "reports.view",
                          "staffing.initiate",
                        ].map((v) => ({ value: v, label: v })),
                      },
                      {
                        key: "granted",
                        label: "Access",
                        options: [
                          { value: "true", label: "Grant" },
                          { value: "false", label: "Revoke" },
                        ],
                      },
                    ]}
                    button="Review and activate"
                    onSubmit={async (v) => {
                      if (
                        confirm(
                          `Activate ${v.role}: ${v.domain} = ${v.granted}?`,
                        )
                      )
                        await perform({
                          op: "policy",
                          data: {
                            ...v,
                            granted: v.granted === "true",
                            confirmed: true,
                          },
                        });
                    }}
                  />
                  <DataTable
                    rows={data.policies.map((p: Row) => ({
                      ...p,
                      access: p.granted ? "Granted" : "Denied",
                    }))}
                    columns={[
                      ["role", "Security group / role"],
                      ["domain", "Domain"],
                      ["access", "Access"],
                    ]}
                    search="Find a policy"
                  />
                  <h2>Business process definitions</h2>
                  {data.definitions.map((d: Row) => (
                    <Form
                      disabled={
                        !["Hire", "Change Job", "Termination"].includes(d.kind)
                      }
                      key={d.kind + "-" + d.version}
                      title={d.name + " · v" + d.version}
                      description={
                        "Initiators: " +
                        d.initiatorRoles +
                        ". " +
                        d.simulationNotes
                      }
                      fields={
                        ["Hire", "Change Job", "Termination"].includes(d.kind)
                          ? [
                              {
                                key: "approvalRole",
                                label: "First approval route",
                                options: [
                                  {
                                    value: "Manager",
                                    label: "Organization manager",
                                  },
                                  { value: "HR Partner", label: "HR Partner" },
                                ],
                                value: d.approvalRole,
                              },
                              {
                                key: "finalReview",
                                label: "Final HR review",
                                options: [
                                  { value: "true", label: "Required" },
                                  { value: "false", label: "Not required" },
                                ],
                                value: String(d.finalReview),
                              },
                            ]
                          : []
                      }
                      button={
                        ["Hire", "Change Job", "Termination"].includes(d.kind)
                          ? "Activate route"
                          : "Fixed route in preview"
                      }
                      onSubmit={async (v) => {
                        if (
                          !["Hire", "Change Job", "Termination"].includes(
                            d.kind,
                          )
                        )
                          throw new Error(
                            "This route is fixed in the current preview",
                          );
                        if (
                          confirm(
                            "Activate a new process version? Pending processes must be completed first.",
                          )
                        )
                          await perform({
                            op: "definition",
                            data: {
                              kind: d.kind,
                              approvalRole: v.approvalRole,
                              finalReview: v.finalReview === "true",
                              confirmed: true,
                            },
                          });
                      }}
                    />
                  ))}
                </>
              ) : (
                <Empty text="Security Administrator role required." />
              )}
            </>
          )}
          {path === "/audit" && (
            <>
              <Heading
                title="Audit History"
                subtitle="Append-only events. Actors, decisions and effective dates stay connected."
              />
              <DataTable
                rows={data.audits.map((a: Row) => ({
                  ...a,
                  actor: a.actor.name,
                  time: new Date(a.createdAt).toLocaleString("en-GB"),
                }))}
                columns={[
                  ["id", "Event"],
                  ["time", "Recorded at"],
                  ["actor", "Actor"],
                  ["action", "Action"],
                  ["objectId", "Object"],
                  ["effectiveDate", "Effective date"],
                  ["permission", "Decision"],
                ]}
                search="Search audit events"
              />
            </>
          )}
          {path === "/practice" && (
            <>
              <Heading
                title="Practice Studio"
                subtitle="Build skills through complete processes. Scores are practice progress, not certification."
                action={
                  <label className="mode-select">
                    Learning mode
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option>Guided</option>
                      <option>Practice</option>
                      <option>Assessment</option>
                    </select>
                  </label>
                }
              />
              <div className="callout">
                Start a checkpoint before performing a task. Role switching is
                part of cross-role scenarios. Return to the initiating persona
                to check the result. Hire scoring verifies worker, occupancy,
                approvals and onboarding; other checkpoints inspect their domain
                records and persisted audit outcomes.
              </div>
              <div className="scenario-grid">
                {scenarios.map((s, i) => {
                  const a = data.attempts.find((a: Row) => a.scenario === s.id);
                  return (
                    <section className="panel scenario" key={s.id}>
                      <div className="section-heading">
                        <span className="eyebrow">
                          SCENARIO {String(i + 1).padStart(2, "0")}
                        </span>
                        {a?.score === 100 && <Badge>Passed</Badge>}
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.objective}</p>
                      <small>{s.role}</small>
                      {mode === "Guided" && (
                        <div className="hint">
                          {s.hint}
                          <small>Source: {s.source}</small>
                        </div>
                      )}
                      {mode === "Practice" && (
                        <details>
                          <summary>Show a hint</summary>
                          <p>{s.hint}</p>
                        </details>
                      )}
                      <div className="scenario-actions">
                        <button
                          onClick={() =>
                            safe({ op: "practice-start", id: s.id })
                          }
                        >
                          {a ? "Restart checkpoint" : "Start checkpoint"}
                        </button>
                        <Link href={s.route}>Open task ↗</Link>
                        {a && (
                          <button
                            className="primary"
                            onClick={async () => {
                              const r = await safe({
                                op: "practice-score",
                                id: a.id,
                              });
                              if (r)
                                setNotice(
                                  r.score === 100
                                    ? "Checkpoint passed: persisted outcome found."
                                    : "Not yet complete. Finish the task and check again.",
                                );
                            }}
                          >
                            Check result
                          </button>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </main>
        <footer>
          <span>
            Independent Workday HCM learning simulator. Not affiliated with
            Workday, Inc.
          </span>
          <label>
            As of{" "}
            <input
              aria-label="As-of date"
              type="date"
              value={asOf}
              onChange={(e) => e.target.value && setAsOf(e.target.value)}
            />
          </label>
          <button onClick={signOut} disabled={busy}>
            Sign out
          </button>
        </footer>
        {can("practice.use") && !path.startsWith("/implementation") && (
          <Academy
            user={u}
            workspace={data}
            path={path}
            onSelectProcess={(id) => {
              setSelectedProcess(id);
              router.push("/my-tasks");
            }}
          />
        )}
      </div>
    </div>
  );
}
function ProcessList({
  processes,
  processName,
  filter,
  setFilter,
  selectedProcess,
  setSelectedProcess,
  u,
  data,
  showForm,
  setShowForm,
  perform,
  safe,
  openWorker,
}: {
  processes: Row[];
  processName: (p: Row) => string;
  filter: string;
  setFilter: (v: string) => void;
  selectedProcess: string;
  setSelectedProcess: (v: string) => void;
  u: Row;
  data: Row;
  showForm: string;
  setShowForm: (v: string) => void;
  perform: (v: Row) => Promise<any>;
  safe: (v: Row) => Promise<any>;
  openWorker: (id: string) => void;
}) {
  const [taskQuery, setTaskQuery] = useState("");
  const items = processes
    .filter((p) =>
      (processName(p) + " " + p.kind + " " + p.initiator.name)
        .toLowerCase()
        .includes(taskQuery.toLowerCase()),
    )
    .filter((p) =>
      filter === "Mine"
        ? p.tasks.some(
            (t: Row) => t.assigneeId === u.id && t.status === "Pending",
          )
        : filter === "Completed"
          ? p.status === "Completed"
          : filter === "Sent Back"
            ? p.status === "Sent Back"
            : true,
    );
  const p = items.find((p) => p.id === selectedProcess) ?? items[0];
  return (
    <div className="task-shell">
      <aside className="task-folders">
        <div className="task-folder-title">
          <Icon name="/my-tasks" size={34} />
          <h1>My Tasks</h1>
        </div>
        <nav aria-label="Task folders">
          {[
            ["", "All Items"],
            ["Mine", "Awaiting My Action"],
            ["Sent Back", "Sent Back"],
            ["Completed", "Archive"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "folder-active" : ""}
              onClick={() => {
                setTaskQuery("");
                setFilter(value);
                setSelectedProcess("");
              }}
            >
              <Icon
                name={value === "Completed" ? "/audit" : "/my-tasks"}
                size={20}
              />
              {label}
            </button>
          ))}
        </nav>
        <p>
          Practice processes only
          <br />
          Scope: {u.orgId ?? "Policy controlled"}
        </p>
      </aside>
      <div className="task-layout">
        <section className="panel task-list">
          <div className="panel-heading">
            <h3>
              All Items <span className="count">{items.length} items</span>
            </h3>
            <label className="inbox-search">
              <Icon name="search" size={18} />
              <input
                aria-label="Search process items"
                placeholder="Search: All Items"
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
              />
            </label>
            <label className="sr-only" htmlFor="task-filter">
              Filter tasks
            </label>
            <select
              id="task-filter"
              value={filter}
              onChange={(e) => {
                setTaskQuery("");
                setFilter(e.target.value);
              }}
            >
              <option value="">All visible processes</option>
              <option>Mine</option>
              <option>Sent Back</option>
              <option>Completed</option>
            </select>
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              data-process-id={item.id}
              className={"task-row " + (p?.id === item.id ? "selected" : "")}
              onClick={() => setSelectedProcess(item.id)}
            >
              <span className="task-symbol">
                {item.kind === "Hire" ? "⊕" : "↗"}
              </span>
              <span>
                <strong>{item.kind}</strong>
                <span>{processName(item)}</span>
                <small>{item.effectiveDate}</small>
              </span>
              <Badge>{item.status}</Badge>
            </button>
          ))}
          {!items.length && (
            <Empty text="No processes in this view. Start a task from Staffing or a worker’s related actions." />
          )}
        </section>
        <section className="panel task-detail" data-coach="native-detail">
          {p ? (
            <>
              <div className="panel-heading">
                <span className="eyebrow">
                  BUSINESS PROCESS · {p.id.slice(-8)}
                </span>
                <h2>
                  {p.kind}: {processName(p)}
                </h2>
                <Badge>{p.status}</Badge>
              </div>
              <div className="detail-grid">
                <Detail label="Initiated by" value={p.initiator.name} />
                <Detail label="Effective date" value={p.effectiveDate} />
                <Detail label="Reason" value={p.reason} />
                <Detail
                  label="Organization"
                  value={data?.orgs.find((o: Row) => o.id === p.orgId)?.name}
                />
                {p.amount && (
                  <Detail label="Proposed annual EUR" value={money(p.amount)} />
                )}
                <Detail label="Hours / week" value={p.hours} />
              </div>
              <h3>Process history</h3>
              <ol className="timeline">
                <li>
                  <span className="dot done" />
                  <div>
                    <strong>Initiation</strong>
                    <p>
                      {p.initiator.name} ·{" "}
                      {new Date(p.createdAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                </li>
                {p.tasks.map((t: Row) => (
                  <li key={t.id}>
                    <span
                      className={
                        "dot " + (t.status === "Completed" ? "done" : "")
                      }
                    />
                    <div>
                      <strong>{t.step}</strong>
                      <p>
                        {t.assignee.name} · {t.status}
                      </p>
                    </div>
                  </li>
                ))}
                <li>
                  <span
                    className={
                      "dot " + (p.status === "Completed" ? "done" : "")
                    }
                  />
                  <div>
                    <strong>Completion & consequences</strong>
                    <p>
                      {p.status === "Completed"
                        ? "Domain records and audit history updated"
                        : "Waiting for required approvals"}
                    </p>
                  </div>
                </li>
              </ol>
              {p.comment && (
                <div className="callout">Latest comment: {p.comment}</div>
              )}
              {p.tasks.some(
                (t: Row) => t.assigneeId === u.id && t.status === "Pending",
              ) && (
                <Form
                  title="Review & act"
                  description="Review the proposed changes before completing your assigned step."
                  button={
                    p.status === "In Progress"
                      ? "Complete HR review"
                      : "Approve"
                  }
                  fields={[
                    {
                      key: "comment",
                      label: "Review comment",
                      required: false,
                    },
                  ]}
                  onSubmit={async (v) => {
                    await perform({
                      op: "act",
                      id: p.id,
                      action: "approve",
                      comment: v.comment,
                    });
                  }}
                />
              )}
              {p.tasks.some(
                (t: Row) => t.assigneeId === u.id && t.status === "Pending",
              ) && (
                <div className="inline-actions">
                  <button onClick={() => setShowForm("sendback")}>
                    Send back
                  </button>
                  <button
                    className="danger"
                    onClick={() => setShowForm("deny")}
                  >
                    Deny
                  </button>
                </div>
              )}
              {["sendback", "deny"].includes(showForm) && (
                <Form
                  title={
                    showForm === "sendback"
                      ? "Return to initiator"
                      : "Deny request"
                  }
                  fields={[{ key: "comment", label: "Required reason" }]}
                  button="Confirm decision"
                  onCancel={() => setShowForm("")}
                  onSubmit={async (v) => {
                    await perform({
                      op: "act",
                      id: p.id,
                      action: showForm,
                      comment: v.comment,
                    });
                    setShowForm("");
                  }}
                />
              )}
              {p.initiatorId === u.id && p.status === "Sent Back" && (
                <>
                  <Form
                    title="Correct returned request"
                    fields={[
                      {
                        key: "effectiveDate",
                        label: "Effective date",
                        type: "date",
                        value: p.effectiveDate,
                      },
                      { key: "reason", label: "Reason", value: p.reason },
                      {
                        key: "hours",
                        label: "Weekly hours",
                        type: "number",
                        value: String(p.hours),
                      },
                    ]}
                    button="Save correction"
                    onSubmit={async (v) => {
                      await perform({
                        op: "edit-returned",
                        id: p.id,
                        data: { ...p, ...v },
                      });
                    }}
                  />
                  <Form
                    title="Resubmit for review"
                    fields={[{ key: "comment", label: "Correction summary" }]}
                    button="Resubmit"
                    onSubmit={async (v) => {
                      await perform({
                        op: "act",
                        id: p.id,
                        action: "resubmit",
                        comment: v.comment,
                      });
                    }}
                  />
                </>
              )}
              {p.initiatorId === u.id &&
                ["Submitted", "In Progress", "Sent Back"].includes(
                  p.status,
                ) && (
                  <button
                    className="danger"
                    onClick={() => {
                      if (
                        confirm(
                          "Cancel this practice process? No success effects will be applied.",
                        )
                      )
                        safe({ op: "act", id: p.id, action: "cancel" });
                    }}
                  >
                    Cancel process
                  </button>
                )}
              {p.status === "Completed" && p.workerId && (
                <button onClick={() => openWorker(p.workerId)}>
                  View worker record →
                </button>
              )}
              {p.kind === "Hire" &&
                p.status === "Completed" &&
                u.role === "HR Administrator" && (
                  <button
                    className="danger"
                    onClick={() => setShowForm("rescind")}
                  >
                    Rescind hire
                  </button>
                )}
              {showForm === "rescind" && (
                <Form
                  title="Rescind unchanged Hire"
                  description="Preserves audit and original employment history, reopens the position and restores pre-hire eligibility. Blocked if downstream transactions exist."
                  fields={[{ key: "reason", label: "Reason for rescind" }]}
                  button="Confirm rescind"
                  onCancel={() => setShowForm("")}
                  onSubmit={async (v) => {
                    await perform({
                      op: "rescind-hire",
                      id: p.id,
                      reason: v.reason,
                    });
                    setShowForm("");
                  }}
                />
              )}
              <p className="source-note">
                Configurable teaching route · source baseline 2024 · exact
                routing inferred.
              </p>
            </>
          ) : (
            <Empty text="Your approval workspace is ready. Submitted processes will appear here." />
          )}
        </section>
      </div>
    </div>
  );
}
function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <span>◇</span>
      <p>{text}</p>
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon,
  color,
}: {
  label: string;
  value: number;
  note: string;
  icon: string;
  color: string;
}) {
  return (
    <section className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={"stat-icon " + color}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
function HireForm({
  data,
  positions,
  onSubmit,
}: {
  data: Row;
  positions: Row[];
  onSubmit: (v: Row) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(hireSchema) as any,
    defaultValues: {
      kind: "Hire",
      prehireId: "",
      positionId: "",
      effectiveDate: localToday(),
      reason: "New hire",
      hours: 40,
      requestKey: "",
    },
  });
  const [draftNotice, setDraftNotice] = useState("");
  useEffect(() => {
    const key = "hire-draft-" + data.user.id;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        for (const k of Object.keys(d)) setValue(k, d[k]);
        setDraftNotice("Your saved draft has been restored.");
      } catch {
        localStorage.removeItem(key);
      }
    }
    setValue("requestKey", newRequestKey());
  }, [data.user.id, setValue]);
  const p = positions.find((p) => p.id === watch("positionId")),
    ph = data.prehires.find((p: Row) => p.id === watch("prehireId"));
  const err = (key: string) =>
    errors[key] ? (
      <span role="alert" className="field-error">
        {String(errors[key]?.message)}
      </span>
    ) : null;
  return (
    <form
      className="hire-form"
      onSubmit={handleSubmit(async (v) => {
        try {
          await onSubmit(v);
          localStorage.removeItem("hire-draft-" + data.user.id);
        } catch {
          /* Parent renders the server error. */
        }
      })}
    >
      <div className="step-bar">
        <span className="current">
          <b>1</b> Hire details
        </span>
        <span>
          <b>2</b> Manager approval
        </span>
        <span>
          <b>3</b> HR review
        </span>
        <span>
          <b>4</b> Welcome
        </span>
      </div>
      <div className="hire-columns">
        <div>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h3>Who are we welcoming?</h3>
                <p className="muted">
                  Choose an eligible pre-hire and an available position.
                </p>
              </div>
              <span className="section-number">01</span>
            </div>
            <label>
              Pre-hire <span className="required">*</span>
              <select {...register("prehireId")}>
                <option value="">Search or select a pre-hire</option>
                {data.prehires
                  .filter((p: Row) => p.eligible && !p.workerId)
                  .map((p: Row) => (
                    <option value={p.id} key={p.id}>
                      {p.name} · {p.orgId}
                    </option>
                  ))}
              </select>
              {err("prehireId")}
            </label>
            <label>
              Position <span className="required">*</span>
              <select {...register("positionId")}>
                <option value="">Select an open position</option>
                {positions
                  .filter((p) => !ph || p.orgId === ph.orgId)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.id} · {p.title} · {p.org.name}
                    </option>
                  ))}
              </select>
              {err("positionId")}
            </label>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h3>Hire details</h3>
                <p className="muted">Set the date and working arrangement.</p>
              </div>
              <span className="section-number">02</span>
            </div>
            <div className="form-grid">
              <label>
                Hire date <span className="required">*</span>
                <input type="date" {...register("effectiveDate")} />
                {err("effectiveDate")}
              </label>
              <label>
                Reason <span className="required">*</span>
                <select {...register("reason")}>
                  <option>New hire</option>
                  <option>Rehire</option>
                </select>
                {err("reason")}
              </label>
              <label>
                Employee type
                <input value="Regular employee" readOnly />
              </label>
              <label>
                Scheduled weekly hours <span className="required">*</span>
                <input type="number" min="1" max="40" {...register("hours")} />
                {err("hours")}
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h3>Organization & job</h3>
                <p className="muted">Inherited from the selected position.</p>
              </div>
              <span className="section-number">03</span>
            </div>
            <div className="detail-grid">
              <Detail
                label="Supervisory organization"
                value={p?.org.name ?? "Select a position"}
              />
              <Detail label="Job profile" value={p?.profile.name ?? "—"} />
              <Detail label="Location" value={p?.location.name ?? "—"} />
              <Detail
                label="FTE"
                value={
                  watch("hours")
                    ? `${(Number(watch("hours")) / 40) * 100}%`
                    : "—"
                }
              />
            </div>
          </section>
        </div>
        <aside className="panel hire-summary">
          <span className="eyebrow">BEFORE YOU SUBMIT</span>
          <h3>A connected process</h3>
          <ol className="timeline">
            <li>
              <span className="dot done" />
              <div>
                <strong>You initiate</strong>
                <p>Validate the person and position.</p>
              </div>
            </li>
            <li>
              <span className="dot" />
              <div>
                <strong>Manager approves</strong>
                <p>Assigned by the organization.</p>
              </div>
            </li>
            <li>
              <span className="dot" />
              <div>
                <strong>HR completes</strong>
                <p>Final review creates the worker.</p>
              </div>
            </li>
            <li>
              <span className="dot" />
              <div>
                <strong>Onboarding begins</strong>
                <p>Three practice tasks are assigned.</p>
              </div>
            </li>
          </ol>
          <div className="hint">
            The worker record is created only after the final review. Pending
            hires reserve their position.
          </div>
          <p className="source-note">
            HCM guide pp. 625–631, 678–681.
            <br />
            Route and form layout: practice approximation.
          </p>
        </aside>
      </div>
      {draftNotice && (
        <p role="status" className="notice">
          {draftNotice}
        </p>
      )}
      <div className="sticky-actions">
        <span>
          <span className="required">*</span> Required fields
        </span>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(
              "hire-draft-" + data.user.id,
              JSON.stringify(watch()),
            );
            setDraftNotice(
              "Draft saved on this browser for this practice account.",
            );
          }}
        >
          Save for later
        </button>
        <Link className="button" href="/home">
          Cancel
        </Link>
        <button className="primary" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit for approval"} →
        </button>
      </div>
    </form>
  );
}
function DataTable({
  rows,
  columns,
  search,
  onRow,
}: {
  rows: Row[];
  columns: string[][];
  search?: string;
  onRow?: (r: Row) => void;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState(""),
    [asc, setAsc] = useState(true);
  const value = (r: Row, key: string) =>
    key.split(".").reduce((a: Row, k: string) => a?.[k], r);
  const list = rows
    .filter(
      (r) =>
        !q ||
        columns.some(([k]) =>
          String(value(r, k)).toLowerCase().includes(q.toLowerCase()),
        ),
    )
    .sort((a, b) =>
      sort
        ? String(value(a, sort)).localeCompare(
            String(value(b, sort)),
            undefined,
            { numeric: true },
          ) * (asc ? 1 : -1)
        : 0,
    );
  const visible = list.slice(page * 15, page * 15 + 15);
  return (
    <div className="panel data-table">
      {search && (
        <label className="table-search">
          {search}
          <input
            placeholder={search + "…"}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </label>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key} scope="col">
                  <button
                    onClick={() => {
                      setSort(key);
                      setAsc(sort === key ? !asc : true);
                    }}
                  >
                    {label} {sort === key ? (asc ? "↑" : "↓") : "↕"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.id ?? i}>
                {columns.map(([key], j) => (
                  <td key={key}>
                    {j === 0 && onRow ? (
                      <button className="text-link" onClick={() => onRow(r)}>
                        {String(value(r, key) ?? "—")}
                      </button>
                    ) : key === "status" ? (
                      <Badge>{String(value(r, key))}</Badge>
                    ) : (
                      String(value(r, key) ?? "—")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <Empty text="No records match your current scope or filter." />
        )}
      </div>
      <div className="pagination">
        <span>
          {list.length} records · page {page + 1}
        </span>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button
          disabled={(page + 1) * 15 >= list.length}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
