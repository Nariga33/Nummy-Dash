"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "VIEWER";
  active: boolean;
  createdAt: string;
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [role, setRole] = useState<"ADMIN" | "VIEWER">("VIEWER");

  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetShown, setResetShown] = useState<{ email: string; password: string } | null>(null);

  async function loadUsers() {
    const res = await fetch("/api/users");
    if (res.ok) {
      const json = await res.json();
      setUsers(json.users);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load reuses the same loader called after mutations
    loadUsers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao criar usuário.");
        return;
      }
      setCreatedCredentials({ email, password });
      setName("");
      setEmail("");
      setPassword(generatePassword());
      setRole("VIEWER");
      await loadUsers();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: User) {
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao atualizar usuário.");
      return;
    }
    await loadUsers();
  }

  async function toggleRole(user: User) {
    setError(null);
    const nextRole = user.role === "ADMIN" ? "VIEWER" : "ADMIN";
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao atualizar usuário.");
      return;
    }
    await loadUsers();
  }

  function openReset(user: User) {
    setError(null);
    setResetShown(null);
    setResetTarget(user);
    setResetPasswordValue(generatePassword());
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setError(null);
    setResetSaving(true);
    try {
      const res = await fetch(`/api/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao redefinir senha.");
        return;
      }
      setResetShown({ email: resetTarget.email, password: resetPasswordValue });
      setResetTarget(null);
    } finally {
      setResetSaving(false);
    }
  }

  async function removeUser(user: User) {
    if (!confirm(`Excluir o acesso de ${user.name} (${user.email})?`)) return;
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao excluir usuário.");
      return;
    }
    await loadUsers();
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {createdCredentials && (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          Usuário criado. Envie estas credenciais com segurança — a senha não será mostrada novamente:
          <div className="mt-2 flex flex-col gap-1 font-mono text-xs">
            <span>E-mail: {createdCredentials.email}</span>
            <span>Senha: {createdCredentials.password}</span>
          </div>
        </div>
      )}

      {resetShown && (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          Senha redefinida. Anote agora — ela não será mostrada de novo:
          <div className="mt-2 flex flex-col gap-1 font-mono text-xs">
            <span>E-mail: {resetShown.email}</span>
            <span>Nova senha: {resetShown.password}</span>
          </div>
        </div>
      )}

      {resetTarget && (
        <form
          onSubmit={submitReset}
          className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-400">
              Nova senha para {resetTarget.name} ({resetTarget.email})
            </label>
            <input
              required
              minLength={8}
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={resetSaving}
              className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
            >
              {resetSaving ? "Salvando..." : "Salvar nova senha"}
            </button>
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          required
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
        />
        <input
          required
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
        />
        <input
          required
          placeholder="Senha provisória"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "ADMIN" | "VIEWER")}
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
        >
          <option value="VIEWER">Visualizador</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <button
          type="submit"
          disabled={creating}
          className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
        >
          {creating ? "Criando..." : "Criar login"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users?.map((user) => (
              <tr key={user.id} className="text-slate-300">
                <td className="px-4 py-3">
                  {user.name}
                  {user.id === currentUserId && <span className="ml-2 text-xs text-slate-500">(você)</span>}
                </td>
                <td className="px-4 py-3 text-slate-400">{user.email}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleRole(user)}
                    className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs hover:border-slate-500"
                  >
                    {user.role === "ADMIN" ? "Administrador" : "Visualizador"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(user)}
                    className={`rounded-full px-2.5 py-0.5 text-xs ${
                      user.active
                        ? "bg-emerald-600/15 text-emerald-400"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {user.active ? "Ativo" : "Desativado"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openReset(user)}
                    className="mr-3 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Redefinir senha
                  </button>
                  <button
                    onClick={() => removeUser(user)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
