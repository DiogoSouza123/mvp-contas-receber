"use client";

import { useState } from "react";

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

function formatMaybeDate(value: string | null) {
  return value ? formatDate(value) : "-";
}

type DetailItemProps = {
  label: string;
  value: string | number | null;
};

function DetailItem({ label, value }: DetailItemProps) {
  const displayValue = value === null || value === "" ? "-" : value;

  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd>{displayValue}</dd>
    </div>
  );
}

export function ReceivablesTable({ rows }: ReceivablesTableProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<ReceivableRow | null>(null);

  return (
    <section className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Consolidado de Inadimplência e Cobranças</h2>
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
              <th aria-label="Ações"></th>
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
                    <span>{row.nossoNumero || "Nosso número indisponível"}</span>
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
                        ? `${row.envioSucesso ? "Último envio com sucesso" : "Último envio sem sucesso"} em ${formatDate(
                            row.ultimoEnvio
                          )}`
                        : "Sem envios registrados"}
                    </span>
                  </div>
                </td>
                <td className="actions-cell">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-menu-button"
                      aria-label={`Abrir ações da conta ${row.contaId}`}
                      aria-expanded={openMenuId === row.contaId}
                      onClick={() => setOpenMenuId((current) => (current === row.contaId ? null : row.contaId))}
                    >
                      ...
                    </button>
                    {openMenuId === row.contaId ? (
                      <div className="row-actions-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRow(row);
                            setOpenMenuId(null);
                          }}
                        >
                          Exibir nota completa
                        </button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRow ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedRow(null)}>
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="detail-modal-header">
              <div>
                <p className="detail-modal-kicker">Nota completa</p>
                <h3 id="detail-modal-title">Cobrança #{selectedRow.contaId}</h3>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Fechar detalhes da cobrança"
                onClick={() => setSelectedRow(null)}
              >
                x
              </button>
            </header>

            <dl className="detail-grid">
              <DetailItem label="Cliente" value={selectedRow.clienteNome} />
              <DetailItem label="Nome fantasia" value={selectedRow.clienteFantasia} />
              <DetailItem label="CPF/CNPJ" value={selectedRow.cpfCnpj} />
              <DetailItem label="Documento" value={selectedRow.documento} />
              <DetailItem label="Conta" value={`#${selectedRow.contaId}`} />
              <DetailItem label="Boleto" value={selectedRow.boletoId ? `#${selectedRow.boletoId}` : null} />
              <DetailItem label="Nosso número" value={selectedRow.nossoNumero} />
              <DetailItem label="Linha digitável" value={selectedRow.linhaDigitavel} />
              <DetailItem label="Situação" value={selectedRow.situacao} />
              <DetailItem label="Status gerencial" value={statusLabel(selectedRow)} />
              <DetailItem label="Data de vencimento" value={formatDate(selectedRow.dataVencimento)} />
              <DetailItem label="Data de pagamento" value={formatMaybeDate(selectedRow.dataPagamento)} />
              <DetailItem label="Dias em atraso" value={selectedRow.diasAtraso} />
              <DetailItem label="Valor total" value={formatCurrency(selectedRow.total)} />
              <DetailItem label="Tentativas de cobrança" value={selectedRow.tentativasCobranca} />
              <DetailItem label="Último envio" value={formatMaybeDate(selectedRow.ultimoEnvio)} />
              <DetailItem
                label="Status do WhatsApp"
                value={
                  selectedRow.ultimoEnvio
                    ? selectedRow.envioSucesso
                      ? "Com sucesso"
                      : "Sem sucesso"
                    : "Sem envios registrados"
                }
              />
            </dl>
          </section>
        </div>
      ) : null}
    </section>
  );
}
