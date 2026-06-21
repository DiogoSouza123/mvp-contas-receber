import { Card } from "antd";

import { CobrancasFiltersBar } from "@/components/CobrancasFiltersBar";
import { CobrancasTables } from "@/components/CobrancasTables";
import { getAtendimentos, getCobrancas, normalizeCobrancaFilters } from "@/lib/cobrancas";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CobrancasPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const filters = normalizeCobrancaFilters(params);

  try {
    const [cobrancas, atendimentos] = await Promise.all([
      getCobrancas(filters),
      getAtendimentos(filters)
    ]);

    return (
      <>
        <Card>
          <h1 className="page-title">Histórico de Cobranças</h1>
          <CobrancasFiltersBar filters={filters} />
        </Card>
        <CobrancasTables cobrancas={cobrancas} atendimentos={atendimentos} />
      </>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar o histórico de cobranças.";
    return (
      <Card>
        <h1 className="page-title">Falha ao carregar histórico</h1>
        <p className="page-subtitle">{message}</p>
      </Card>
    );
  }
}
