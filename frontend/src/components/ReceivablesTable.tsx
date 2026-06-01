import { formatCurrency, formatDate } from "@/lib/format";
import type { ReceivableRow } from "@/lib/dashboard";

type ReceivablesTableProps = {
  rows: ReceivableRow[];
};

function statusClass(row: ReceivableRow) {
  if (row.situacao === "Pago") {
    return "status-pill status-paid";
  }
  if (row.diasAtraso > 0) {
    return "status-pill status-overdue";
  }
  return "status-pill status-open";
}

function statusLabel(row: ReceivableRow) {
  if (row.situacao === "Pago") {
    return "Pago";
  }
  if (row.diasAtraso > 0) {
    return `Vencido (${row.diasAtraso}d)`;
  }
  return "Em aberto";
}

export function ReceivablesTable({ rows }: ReceivablesTableProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Consolidado de Inadimplencia e Cobrancas</h2>
        <p className="panel-subtitle">{rows.length} registro(s) exibido(s)</p>
      </header>
      <div className="table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Cliente</th>
              <th>Documento</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Total</th>
              <th>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.contaId}>
                <td>
                  <div className="cell-stack">
                    <strong>#{row.contaId}</strong>
                    <span>{row.boletoId ? `Boleto ${row.boletoId}` : "Sem boleto"}</span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <strong>{row.clienteNome}</strong>
                    <span>{row.cpfCnpj}</span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <strong>{row.documento || "-"}</strong>
                    <span>{row.nossoNumero || "Nosso numero indisponivel"}</span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <strong>{formatDate(row.dataVencimento)}</strong>
                    <span>Pagamento: {formatDate(row.dataPagamento)}</span>
                  </div>
                </td>
                <td>
                  <span className={statusClass(row)}>{statusLabel(row)}</span>
                </td>
                <td>
                  <strong>{formatCurrency(row.total)}</strong>
                </td>
                <td>
                  <div className="cell-stack">
                    <strong>{row.tentativasCobranca} tentativa(s)</strong>
                    <span>
                      {row.ultimoEnvio
                        ? `${row.envioSucesso ? "Ultimo envio com sucesso" : "Ultimo envio sem sucesso"} em ${formatDate(
                            row.ultimoEnvio
                          )}`
                        : "Sem envios registrados"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
