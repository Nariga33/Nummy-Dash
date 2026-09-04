"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users2,
  Kanban,
  Settings,
  UserCog,
  ChevronLeft,
  Menu,
  LogOut,
} from "lucide-react";
import { signOutAction } from "@/app/(dashboard)/actions";
import { LogoMark } from "@/components/logo-mark";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
type NavGroup = { label: string | null; items: NavItem[] };

const navGroups: NavGroup[] = [
  { label: null, items: [{ href: "/", label: "Visão geral", icon: LayoutDashboard }] },
  {
    label: "CRM",
    items: [
      { href: "/crm/prospeccao", label: "Prospecção", icon: Users2 },
      { href: "/crm/oportunidades", label: "Pipeline", icon: Kanban },
    ],
  },
  {
    label: "Configurações",
    items: [
      { href: "/settings/integrations", label: "Integrações", icon: Settings, adminOnly: true },
      { href: "/settings/users", label: "Usuários", icon: UserCog, adminOnly: true },
    ],
  },
];

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!time) return null;
  return (
    <div className="rounded-lg border border-white/[0.05] bg-slate-950/60 px-2 py-1.5 text-center">
      <span className="font-mono text-sm font-bold tracking-widest text-brand">{time}</span>
    </div>
  );
}

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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restores the persisted collapse preference on mount
    if (localStorage.getItem("nummy-sidebar-collapsed") === "true") setCollapsed(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((v) => {
      localStorage.setItem("nummy-sidebar-collapsed", String(!v));
      return !v;
    });
  }, []);

  return (
    <aside
      className={`relative flex min-h-screen shrink-0 flex-col border-r border-white/[0.06] bg-slate-950 transition-all duration-300 ease-in-out ${
        collapsed ? "w-[64px]" : "w-64"
      }`}
    >
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <LogoMark size={32} />
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold leading-tight text-white">nummy</p>
              <p className="text-xs leading-tight text-slate-500">Outbound Dashboard</p>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-brand/10 hover:text-brand ${
            collapsed ? "mx-auto" : "ml-auto"
          }`}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="scrollbar-none flex-1 overflow-y-auto overflow-x-hidden py-3">
        {navGroups.map((group, gi) => {
          const items = group.items.filter((item) => !item.adminOnly || role === "ADMIN");
          if (items.length === 0) return null;
          return (
            <div key={gi} className={collapsed ? "mb-1 px-1.5" : "mb-1"}>
              {!collapsed && group.label && (
                <p className="select-none whitespace-nowrap px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  {group.label}
                </p>
              )}
              {collapsed && gi > 0 && <div className="mx-1 my-2 h-px bg-white/[0.06]" />}
              <div className={collapsed ? "space-y-0.5" : "space-y-0.5 px-2"}>
                {items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`group flex items-center rounded-lg transition-all duration-150 ${
                        collapsed
                          ? `mx-auto h-9 w-9 justify-center ${
                              active ? "bg-brand text-brand-ink" : "text-slate-400 hover:bg-brand/10 hover:text-brand"
                            }`
                          : `gap-3 px-3 py-2.5 text-sm font-medium ${
                              active
                                ? "bg-brand text-brand-ink shadow-[0_0_12px_#f5b40040]"
                                : "text-slate-400 hover:bg-brand/10 hover:text-brand"
                            }`
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active ? "text-brand-ink" : "text-slate-500 group-hover:text-brand"
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div
        className={`shrink-0 border-t border-white/[0.06] ${
          collapsed ? "flex flex-col items-center gap-2 p-1.5" : "space-y-2 p-3"
        }`}
      >
        {!collapsed && <LiveClock />}
        {collapsed ? (
          <>
            <div
              title={userName}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-brand text-xs font-black text-brand"
            >
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Sair"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand text-xs font-black text-brand">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none text-slate-200">{userName}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{userEmail}</p>
              </div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Sair"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
