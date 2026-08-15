import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 12a9 9 0 1 0 9-9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M3 12h6M3 12l3-3M3 12l3 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Outbound Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">Entre com seu e-mail e senha para continuar</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl shadow-black/20">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Não tem acesso? Peça ao administrador para criar seu login.
        </p>
      </div>
    </div>
  );
}
