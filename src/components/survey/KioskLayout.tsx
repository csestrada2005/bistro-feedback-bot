import type { ReactNode } from "react";

export function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-brand" />
      {children}
    </main>
  );
}
