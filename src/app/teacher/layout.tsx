"use client";

import { usePathname } from "next/navigation";
import AppShell from "@/components/nav/AppShell";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/teacher";
  const active = resolveActive(pathname);
  return (
    <AppShell role="teacher" active={active}>
      {children}
    </AppShell>
  );
}

function resolveActive(pathname: string): string {
  if (pathname.startsWith("/teacher/lessons")) return "lessons";
  if (pathname.startsWith("/teacher/memory")) return "memory";
  return "class";
}
