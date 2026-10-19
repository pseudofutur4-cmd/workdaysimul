"use client";
import { useEffect, useRef, useState } from "react";
export type CoachStep = {
  title: string;
  text: string;
  selector: string;
  ready?: () => boolean;
  nextLabel?: string;
};
export default function Coach({
  name,
  step,
  index,
  total,
  onNext,
  onBack,
  onPause,
}: {
  name: string;
  step: CoachStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onPause: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null),
    [ready, setReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const latest = useRef(step);
  latest.current = step;
  useEffect(() => {
    let lastTarget: Element | null = null;
    const update = () => {
      const s = latest.current,
        el = document.querySelector(s.selector) as HTMLElement | null;
      if (el && el !== lastTarget) {
        el.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "center",
        });
        lastTarget = el;
      }
      const r = el?.getBoundingClientRect();
      setRect(r && r.width && r.height ? r : null);
      setReady(s.ready ? !!s.ready() : !!el);
    };
    update();
    heading.current?.focus({ preventScroll: true });
    const timer = setInterval(update, 180);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onPause();
    };
    document.addEventListener("keydown", escape);
    return () => {
      clearInterval(timer);
      document.removeEventListener("keydown", escape);
    };
  }, [index, step.selector, onPause]);
  const width = typeof window === "undefined" ? 1440 : window.innerWidth;
  const height = typeof window === "undefined" ? 900 : window.innerHeight;
  const cardWidth = Math.min(360, width - 24);
  // Place the coach beside the target when possible; otherwise above/below it.
  let left = Math.max(12, width - cardWidth - 24),
    top = Math.max(12, height - 335);
  if (rect && width > 700) {
    if (rect.right + cardWidth + 36 < width) {
      left = rect.right + 18;
      top = Math.max(12, Math.min(rect.top, height - 335));
    } else if (rect.left > cardWidth + 36) {
      left = rect.left - cardWidth - 18;
      top = Math.max(12, Math.min(rect.top, height - 335));
    } else if (rect.bottom + 335 < height) top = rect.bottom + 15;
    else if (rect.top > 335) top = rect.top - 325;
  }
  return (
    <div className="coach-layer">
      {rect && (
        <div
          className="coach-spotlight"
          aria-hidden="true"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        >
          <span className="coach-beacon" />
        </div>
      )}
      <section
        className="coach-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="coach-title"
        style={{ left, top, width: cardWidth }}
      >
        <div className="coach-top">
          <span>YOUR PRACTICE GUIDE</span>
          <button onClick={onPause} aria-label="Pause tutorial">
            ×
          </button>
        </div>
        <div className="coach-meter">
          <span style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <p className="coach-counter">
          {name} · Step {index + 1} of {total}
        </p>
        <h2 id="coach-title" ref={heading} tabIndex={-1}>
          {step.title}
        </h2>
        <p>{step.text}</p>
        {!rect && !ready && (
          <p className="coach-wait" role="status">
            The next control is not on this screen yet. Return to the lesson
            task, or use Back.
          </p>
        )}
        <div className="coach-controls">
          <button onClick={onBack} disabled={index === 0}>
            Back
          </button>
          <button className="primary" onClick={onNext} disabled={!ready}>
            {step.nextLabel ?? "Next step"} →
          </button>
        </div>
        <small>
          {ready
            ? "Ready when you are. Use Next step to continue."
            : "Complete the highlighted action to continue."}{" "}
          · Esc pauses
        </small>
      </section>
    </div>
  );
}
