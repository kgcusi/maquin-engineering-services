import type { Metadata } from "next";

import { ClientsTable } from "@/components/clients/clients-table";
import { requirePagePermission } from "@/lib/page-guards";
import { listClients } from "@/modules/clients/queries";
import { getSettings } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requirePagePermission("client.view");
  const [clients, settings] = await Promise.all([listClients(), getSettings()]);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
        <p className="text-muted-foreground text-sm">
          The people and companies you deliver projects for. Open a client for documents and notes.
        </p>
      </header>

      <ClientsTable clients={clients} timeZone={settings.timezone} />
    </div>
  );
}
