import { getClientes, normalizeClienteFilters } from "@/lib/clientes";
import { formatCurrency } from "@/lib/format";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientesPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const filters = normalizeClienteFilters(params);

  try {
    const clientes = await getClientes(filters);

    return (
      <main className="page-shell">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h1 className="panel-title">Clientes</h1>
              <p className="panel-subtitle">{clientes.length} cliente(s) exibido(s)</p>
            </div>
          </header>

          <form method="get" className="filters filters-compact">
            <div className="input-group input-grow">
              <label htmlFor="search">Buscar por nome ou CPF/CNPJ</label>
              <input
                id="search"
                name="search"
                type="text"
                placeholder="Nome, nome fantasia ou CPF/CNPJ"
                defaultValue={filters.search}
              />
            </div>
            <button type="submit" className="btn-primary">
              Buscar
            </button>
          </form>

          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CPF/CNPJ</th>
                  <th>Situação</th>
                  <th>Títulos em aberto</th>
                  <th>Valor em aberto</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{cliente.nome}</strong>
                        <span>{cliente.nomeFantasia || "-"}</span>
                      </div>
                    </td>
                    <td>{cliente.cpfCnpj}</td>
                    <td>
                      <span className={`status-pill ${cliente.ativo ? "status-open" : "status-overdue"}`}>
                        {cliente.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      {cliente.titulosEmAberto} de {cliente.totalTitulos}
                    </td>
                    <td>
                      <strong>{formatCurrency(cliente.valorEmAberto)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar clientes.";
    return (
      <main className="page-shell">
        <section className="panel">
          <h1 className="panel-title">Falha ao carregar clientes</h1>
          <p className="panel-subtitle">{message}</p>
        </section>
      </main>
    );
  }
}
