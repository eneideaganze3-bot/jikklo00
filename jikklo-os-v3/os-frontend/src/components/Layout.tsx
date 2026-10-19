import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 text-jikklo-navy"
            aria-label="Ouvrir le menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-semibold text-jikklo-navy">JIKKLO OS</span>
          <div className="w-8" />
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
