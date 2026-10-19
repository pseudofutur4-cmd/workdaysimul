import type { CSSProperties } from "react";

// Original line icons. No Workday/third-party artwork is included.
const paths: Record<string, string> = {
  "/academy": "M2 6l10-4 10 4-10 5zM5 8v9c5 4 9 4 14 0V8M22 6v10",
  "/modules": "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  "/home": "M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7",
  "/my-tasks": "M4 8h16v13H4zM3 8l3-5h12l3 5M4 14h5l2 3h2l2-3h5",
  "/workers":
    "M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21v-3a8 8 0 0 1 16 0v3M4 21h16",
  "/organizations": "M9 3h6v5H9zM2 16h6v5H2zM16 16h6v5h-6zM12 8v4M5 16v-4h14v4",
  "/positions": "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 11v3h4v-3",
  "/staffing": "M3 4h12v17H3zM6 8h6M6 12h4M17 11v8M13 15h8",
  "/recruiting":
    "M3 21v-3a6 6 0 0 1 10-4M5 6a4 4 0 1 0 8 0 4 4 0 1 0-8 0M14 15a4 4 0 1 0 8 0 4 4 0 1 0-8 0M21 18l2 3",
  "/compensation": "M3 5h18v14H3zM3 9h18M7 15h3M17 12v4M15 14h4",
  "/absence": "M3 5h18v16H3zM7 2v6M17 2v6M3 10h18M8 14h3M14 14h3M8 18h3",
  "/benefits":
    "M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13M7 12h3l2-4 2 7 2-3h3",
  "/learning": "M2 6l10-4 10 4-10 5zM5 8v9c5 4 9 4 14 0V8M22 6v10",
  "/reports": "M3 21V12h4v9M10 21V7h4v14M17 21V3h4v18",
  "/admin/security": "M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6",
  "/audit": "M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v6l4 2",
  "/practice": "M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14M15 15l6 6",
  menu: "M3 5h18M3 12h18M3 19h18",
};
export default function Icon({
  name,
  size = 23,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path
        d={paths[name] ?? "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"}
      />
    </svg>
  );
}
