import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoMark } from "@/components/logo-mark";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4">
            <LogoMark size={48} />
          </div>
          <h1 className="text-xl font-semibold text-white">nummy · Outbound</h1>
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
