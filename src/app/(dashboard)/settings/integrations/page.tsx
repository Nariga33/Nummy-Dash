import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { IntegrationsManager } from "./integrations-manager";

export default async function IntegrationsSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Integrações</h1>
        <p className="mt-1 text-sm text-slate-500">
          Conecte a API4COM (ligações) e a origem das mensagens do WhatsApp para alimentar o dashboard com dados reais.
        </p>
      </div>
      <IntegrationsManager />
    </div>
  );
}
