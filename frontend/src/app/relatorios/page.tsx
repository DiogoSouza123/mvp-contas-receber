import { Card } from "antd";

import { EfetividadeCharts } from "@/components/EfetividadeCharts";
import { EfetividadeFiltersBar } from "@/components/EfetividadeFiltersBar";
import { getEfetividadeSnapshot, normalizeEfetividadeFilters } from "@/lib/efetividade";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RelatoriosPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const filters = normalizeEfetividadeFilters(params);

  try {
    const snapshot = await getEfetividadeSnapshot(filters);

    return (
      <>
        <Card>
          <h1 className="page-title">Efetividade de Cobrança</h1>
          <p className="page-subtitle">
            Acompanhe quantas cobranças resultaram em pagamento, taxa de conversão e tempo médio até a baixa.
          </p>
          <EfetividadeFiltersBar filters={filters} />
        </Card>

        <div style={{ marginTop: 24 }}>
          <EfetividadeCharts snapshot={snapshot} />
        </div>
      </>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar relatório de efetividade.";
    return (
      <Card>
        <h1 className="page-title">Falha ao carregar relatório</h1>
        <p className="page-subtitle">{message}</p>
      </Card>
    );
  }
}
