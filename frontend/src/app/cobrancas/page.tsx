import { getAtendimentos, getCobrancas, normalizeCobrancaFilters } from "@/lib/cobrancas";
import { formatDate } from "@/lib/format";

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
      <main className="page-shell">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h1 className="panel-title">Histórico de Cobranças</h1>
              <p className="panel-subtitle">{cobrancas.length} tentativa(s) de envio no período</p>
            </div>
          </header>

          <form method="get" className="filters filters-compact">
            <div className="input-group">
              <label htmlFor="startDate">Data inicial</label>
              <input type="date" id="startDate" name="startDate" defaultValue={filters.startDate} />
            </div>
            <div className="input-group">
              <label htmlFor="endDate">Data final</label>
              <input type="date" id="endDate" name="endDate" defaultValue={filters.endDate} />
            </div>
            <div className="input-group">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={filters.status}>
                <option value="all">Todos</option>
                <option value="sucesso">Sucesso</option>
                <option value="falha">Falha</option>
              </select>
            </div>
            <button type="submit" className="btn-primary">
              Aplicar filtros
            </button>
          </form>

          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Canal</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((cobranca) => (
                  <tr key={cobranca.id}>
                    <td>{cobranca.clienteNome}</td>
                    <td>{cobranca.telefone}</td>
                    <td>{cobranca.channel}</td>
                    <td>{cobranca.category}</td>
                    <td>
                      <span className={`status-pill ${cobranca.status ? "status-paid" : "status-overdue"}`}>
                        {cobranca.status ? "Sucesso" : "Falha"}
                      </span>
                    </td>
                    <td>{formatDate(cobranca.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Histórico de Atendimento (Chatbot)</h2>
              <p className="panel-subtitle">{atendimentos.length} mensagem(ns) no período</p>
            </div>
          </header>

          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Telefone</th>
                  <th>Canal</th>
                  <th>Origem</th>
                  <th>Intenção</th>
                  <th>Mensagem</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {atendimentos.map((atendimento) => (
                  <tr key={atendimento.id}>
                    <td>{atendimento.telefone}</td>
                    <td>{atendimento.channel}</td>
                    <td>{atendimento.role}</td>
                    <td>{atendimento.intent || "-"}</td>
                    <td className="cell-truncate">{atendimento.message}</td>
                    <td>{formatDate(atendimento.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar o histórico de cobranças.";
    return (
      <main className="page-shell">
        <section className="panel">
          <h1 className="panel-title">Falha ao carregar histórico</h1>
          <p className="panel-subtitle">{message}</p>
        </section>
      </main>
    );
  }
}
