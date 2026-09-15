import { auth } from "@/auth";
import { PipelineBoard } from "./pipeline-board";

export default async function OportunidadesPage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Pipeline de oportunidades</h1>
        <p className="mt-1 text-sm text-slate-500">
          Arraste os cards entre as colunas para atualizar o estágio de cada oportunidade.
        </p>
      </div>
      <PipelineBoard currentUserId={session!.user.id} isAdmin={session!.user.role === "ADMIN"} />
    </div>
  );
}
