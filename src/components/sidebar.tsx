"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(dashboard)/actions";
import { LogoMark } from "@/components/logo-mark";

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4.5 w-4.5 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const ICONS = {
  overview: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  prospect: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0M19.5 8.25v4.5m2.25-2.25h-4.5",
  pipeline: "M3 3h18M3 3v3.586a1 1 0 00.293.707l6.414 6.414a1 1 0 01.293.707V19l4-2v-4.586a1 1 0 01.293-.707l6.414-6.414A1 1 0 0021 4.586V3",
  integrations: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z",
  users: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-4.13a4 4 0 100-8 4 4 0 000 8zm6 0a4 4 0 10-8 0",
};

type NavItem = { href: string; label: string; icon: keyof typeof ICONS; adminOnly?: boolean };
type NavGroup = { label: string | null; items: NavItem[] };

const navGroups: NavGroup[] = [
  { label: null, items: [{ href: "/", label: "Visão geral", icon: "overview" }] },
  {
    label: "CRM",
    items: [
      { href: "/crm/prospeccao", label: "Prospecção", icon: "prospect" },
      { href: "/crm/oportunidades", label: "Pipeline", icon: "pipeline" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { href: "/settings/integrations", label: "Integrações", icon: "integrations", adminOnly: true },
      { href: "/settings/users", label: "Usuários", icon: "users", adminOnly: true },
    ],
  },
];

export function Sidebar({
  userName,
  userEmail,
  role,
}: {
  userName: string;
  userEmail: string;
  role: "ADMIN" | "VIEWER";
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex items-center gap-2.5 border-b border-slate-800 px-5 py-5">
        <LogoMark size={36} />
        <div>
          <p className="text-sm font-semibold text-white leading-tight">nummy</p>
          <p className="text-xs text-slate-500 leading-tight">Outbound Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navGroups.map((group, gi) => {
          const items = group.items.filter((item) => !item.adminOnly || role === "ADMIN");
          if (items.length === 0) return null;
          return (
            <div key={gi} className="space-y-1">
              {group.label && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {group.label}
                </p>
              )}
              {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-brand/15 text-brand"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <Icon path={ICONS[item.icon]} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-4 py-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">{userName}</p>
            <p className="truncate text-xs text-slate-500">{userEmail}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
          >
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
