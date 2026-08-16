"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(dashboard)/actions";
import { LogoMark } from "@/components/logo-mark";

const navItems = [
  { href: "/", label: "Visão geral", adminOnly: false },
  { href: "/settings/integrations", label: "Integrações", adminOnly: true },
  { href: "/settings/users", label: "Usuários", adminOnly: true },
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

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems
          .filter((item) => !item.adminOnly || role === "ADMIN")
          .map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-brand/15 text-brand"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                {item.label}
              </Link>
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
