import { auth } from "@/auth";
import { ProspeccaoManager } from "./prospeccao-manager";

export default async function ProspeccaoPage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Prospecção</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cadastre e importe contatos, e crie oportunidades direto a partir da lista de prospecção.
        </p>
      </div>
      <ProspeccaoManager currentUserId={session!.user.id} isAdmin={session!.user.role === "ADMIN"} />
    </div>
  );
}
