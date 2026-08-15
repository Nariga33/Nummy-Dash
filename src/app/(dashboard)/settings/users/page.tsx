import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UsersManager } from "./users-manager";

export default async function UsersSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Usuários</h1>
        <p className="mt-1 text-sm text-slate-500">
          Crie e libere o login de quem pode acessar o dashboard. Não há cadastro público — só administradores criam contas.
        </p>
      </div>
      <UsersManager currentUserId={session.user.id} />
    </div>
  );
}
