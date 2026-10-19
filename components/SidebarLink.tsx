"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Icon from "./Icon";
const descriptions: Record<string, string> = {
  "/home": "Your welcome page, applications, and pending work.",
  "/academy":
    "Choose a chapter, follow guided sections, and track your learning progress.",
  "/modules": "Explore the functional practice workspaces independently.",
  "/my-tasks": "Review assigned requests and follow business process history.",
  "/workers":
    "Find workers and inspect their job, contact, and employment details.",
  "/organizations":
    "Explore supervisory organizations and reporting relationships.",
  "/positions": "Inspect job profiles, positions, and staffing availability.",
  "/staffing": "Hire an eligible pre-hire and follow manager and HR approvals.",
  "/recruiting":
    "Manage requisitions, candidates, and the simulated offer process.",
  "/compensation":
    "Review permitted pay data and propose compensation changes.",
  "/absence": "Check your practice balance and request or cancel time off.",
  "/benefits": "Explore synthetic plans and make your benefit elections.",
  "/learning": "Enroll in a practice course and record its completion.",
  "/reports": "Inspect practice reports and export permitted data.",
  "/admin/security":
    "Inspect and configure local domain and business process policies.",
  "/audit":
    "Inspect the recorded actions and decisions you are permitted to see.",
  "/practice": "Try scenarios and check their saved business outcomes.",
};
export default function SidebarLink({
  href,
  label,
  active,
  count,
}: {
  href: string;
  label: string;
  active: boolean;
  count?: number;
}) {
  const id = useId(),
    anchor = useRef<HTMLAnchorElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const close = () => {
    cancelClose();
    setPosition(null);
  };
  const deferClose = () => {
    cancelClose();
    timer.current = setTimeout(() => setPosition(null), 120);
  };
  const open = () => {
    cancelClose();
    const r = anchor.current?.getBoundingClientRect();
    if (r)
      setPosition({
        left: Math.max(8, Math.min(r.right + 12, window.innerWidth - 292)),
        top: Math.max(12, Math.min(r.top - 5, window.innerHeight - 155)),
      });
  };
  useEffect(() => {
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosition(null);
    };
    const hide = () => setPosition(null);
    document.addEventListener("keydown", dismiss);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("keydown", dismiss);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);
  return (
    <>
      <Link
        ref={anchor}
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        aria-describedby={position ? id : undefined}
        className={active ? "active" : ""}
        onMouseEnter={open}
        onMouseLeave={deferClose}
        onFocus={open}
        onBlur={close}
        onClick={close}
      >
        <span className="nav-icon" aria-hidden="true">
          <Icon name={href} />
        </span>
        <span className="nav-label">{label}</span>
        {!!count && <span className="nav-count">{count}</span>}
      </Link>
      {position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="sidebar-explainer"
            style={position}
            onMouseEnter={cancelClose}
            onMouseLeave={deferClose}
          >
            <span>{active ? "YOU ARE HERE" : "WORKSPACE MENU"}</span>
            <strong>{label}</strong>
            <p>{descriptions[href] ?? "Open this practice workspace."}</p>
          </div>,
          document.body,
        )}
    </>
  );
}
