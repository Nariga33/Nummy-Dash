import { ProspeccaoManager } from "./prospeccao-manager";

export default function ProspeccaoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Prospecção</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cadastre e importe contatos, e crie oportunidades direto a partir da lista de prospecção.
        </p>
      </div>
      <ProspeccaoManager />
    </div>
  );
}
