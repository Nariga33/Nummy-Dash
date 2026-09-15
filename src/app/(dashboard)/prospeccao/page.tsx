import { ProspectingManager } from "./prospecting-manager";

export default function ProspeccaoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Prospecção · E-commerce</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Busca de lojas online no Apollo priorizando o que o concorrente grande deixa passar: empresas pequenas
          (1–10, 11–20 funcionários) com loja/carrinho ativo e presença no LinkedIn. As faixas de porte pequenas vêm
          marcadas por padrão — é a lacuna que a busca direto no Apollo costuma esconder.
        </p>
      </div>
      <ProspectingManager />
    </div>
  );
}
