import { Link } from "@tanstack/react-router";
import { GraduationCap, LayoutDashboard, CirclePlus as PlusCircle, History, Circle as HelpCircle, Radio, Users } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new", label: "New Extraction", icon: PlusCircle },
  { to: "/live", label: "Live Scores", icon: Radio },
  { to: "/faculty", label: "Faculty", icon: Users },
  { to: "/jobs", label: "Jobs History", icon: History },
  { to: "/cookie-helper", label: "Cookie Helper", icon: HelpCircle },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="brand-gradient text-brand-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-foreground/15 ring-1 ring-brand-foreground/25">
              <GraduationCap className="size-6" />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-tight tracking-tight">
                REVA VPL &amp; Quiz Report Extractor
              </span>
              <span className="block text-xs text-brand-foreground/75">
                Moodle submission &amp; quiz data to styled Excel reports
              </span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-foreground/80 transition-colors hover:bg-brand-foreground/12 data-[status=active]:bg-brand-foreground/18 data-[status=active]:text-brand-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Session cookies are used only for live requests and never stored on a server. Jobs expire
        after 24 hours.
      </footer>
    </div>
  );
}
