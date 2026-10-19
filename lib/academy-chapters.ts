// Chapters organize existing lessons; passing a chapter requires saved lesson outcomes.
export const academyChapters = [
  {
    id: "foundations",
    title: "People foundations",
    description: "Understand the employee lifecycle and its approval handoffs.",
    lessons: ["hcm"],
  },
  {
    id: "everyday",
    title: "Everyday employee tasks",
    description: "Practice time away, learning, and recording time worked.",
    lessons: ["absence", "lms", "time"],
  },
  {
    id: "growth",
    title: "Growth & rewards",
    description: "Connect goals, manager feedback, and pay concepts.",
    lessons: ["talent", "payroll"],
  },
  {
    id: "business",
    title: "Business operations",
    description: "Follow financial and purchasing transactions through review.",
    lessons: ["finance", "scm"],
  },
  {
    id: "technology",
    title: "Security & integrations",
    description:
      "Explore access decisions, exports, and integration assemblies.",
    lessons: ["security", "integration", "studio"],
  },
];
