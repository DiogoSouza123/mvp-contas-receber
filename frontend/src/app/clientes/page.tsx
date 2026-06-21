import { Card } from "antd";

import { ClientesFiltersBar } from "@/components/ClientesFiltersBar";
import { ClientesTable } from "@/components/ClientesTable";
import { getClientes, normalizeClienteFilters } from "@/lib/clientes";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientesPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const filters = normalizeClienteFilters(params);

  try {
    const clientes = await getClientes(filters);

    return (
      <>
        <Card>
          <h1 className="page-title">Clientes</h1>
          <ClientesFiltersBar filters={filters} />
        </Card>
        <ClientesTable rows={clientes} />
      </>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar clientes.";
    return (
      <Card>
        <h1 className="page-title">Falha ao carregar clientes</h1>
        <p className="page-subtitle">{message}</p>
      </Card>
    );
  }
}
