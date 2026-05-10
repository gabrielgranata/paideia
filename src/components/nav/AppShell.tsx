import NavRail, { type NavItem } from "./NavRail";

// AppShell — pages wrap their content in this to inherit the 52px nav rail.
// Pure layout primitive: left rail + main column. No chrome, no padding;
// each page brings its own Chrome and body.
//
// For role-based nav, pass `role` and we resolve to the canonical item set
// below. Override with `items` if you need a custom set (e.g. demos).

export type AppShellRole = "student" | "teacher";

const STUDENT_ITEMS: NavItem[] = [
  { key: "work",       label: "Work",      glyph: "○", href: "/artifacts" },
  { key: "portfolio",  label: "Portfolio", glyph: "◇", href: "/portfolio" },
  { key: "courses",    label: "Courses",   glyph: "≡", href: "/courses" },
  { key: "memory",     label: "Memory",    glyph: "∿", href: "/memory" },
];

const TEACHER_ITEMS: NavItem[] = [
  { key: "class",      label: "Class",     glyph: "○", href: "/teacher" },
  { key: "lessons",    label: "Lessons",   glyph: "≡", href: "/teacher/lessons" },
  { key: "memory",     label: "Memory",    glyph: "∿", href: "/teacher/memory" },
];

type Props = {
  role: AppShellRole;
  active?: string;
  items?: NavItem[];
  children: React.ReactNode;
};

export default function AppShell({ role, active, items, children }: Props) {
  const navItems = items ?? (role === "teacher" ? TEACHER_ITEMS : STUDENT_ITEMS);
  return (
    <div style={{ display: "flex", minHeight: "100%", width: "100%" }}>
      <NavRail items={navItems} active={active} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
