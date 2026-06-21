"use client";

import { useState } from "react";
import { Button, Card, Descriptions, Dropdown, Modal, Table, Tag } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

import { formatCurrency, formatDate } from "@/lib/format";
import type { ReceivableRow } from "@/lib/dashboard";

type ReceivablesTableProps = {
  rows: ReceivableRow[];
};

function statusTag(row: ReceivableRow) {
  if (row.situacao === "Pago") {
    return <Tag color="green">Pago</Tag>;
  }
  if (row.diasAtraso > 0) {
    return <Tag color="red">{`Vencido (${row.diasAtraso}d)`}</Tag>;
  }
  return <Tag color="blue">Em aberto</Tag>;
}

function formatMaybeDate(value: string | null) {
  return value ? formatDate(value) : "-";
}

export function ReceivablesTable({ rows }: ReceivablesTableProps) {
  const [selectedRow, setSelectedRow] = useState<ReceivableRow | null>(null);

  const columns: ColumnsType<ReceivableRow> = [
    {
      title: "Conta",
      key: "conta",
      render: (_, row) => (
        <div>
          <strong>#{row.contaId}</strong>
          <div className="cell-helper">{row.boletoId ? `Boleto ${row.boletoId}` : "Sem boleto"}</div>
        </div>
      )
    },
    {
      title: "Cliente",
      key: "cliente",
      render: (_, row) => (
        <div>
          <strong>{row.clienteNome}</strong>
          <div className="cell-helper">{row.cpfCnpj}</div>
        </div>
      )
    },
    {
      title: "Documento",
      key: "documento",
      render: (_, row) => (
        <div>
          <strong>{row.documento || "-"}</strong>
          <div className="cell-helper">{row.nossoNumero || "Nosso número indisponível"}</div>
        </div>
      )
    },
    {
      title: "Vencimento",
      key: "vencimento",
      render: (_, row) => (
        <div>
          <strong>{formatDate(row.dataVencimento)}</strong>
          <div className="cell-helper">Pagamento: {formatMaybeDate(row.dataPagamento)}</div>
        </div>
      )
    },
    {
      title: "Status",
      key: "status",
      render: (_, row) => statusTag(row)
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (value: number) => <strong>{formatCurrency(value)}</strong>
    },
    {
      title: "WhatsApp",
      key: "whatsapp",
      render: (_, row) => (
        <div>
          <strong>{row.tentativasCobranca} tentativa(s)</strong>
          <div className="cell-helper">
            {row.ultimoEnvio
              ? `${row.envioSucesso ? "Sucesso" : "Sem sucesso"} em ${formatDate(row.ultimoEnvio)}`
              : "Sem envios registrados"}
          </div>
        </div>
      )
    },
    {
      title: "",
      key: "actions",
      width: 56,
      render: (_, row) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "detail",
                label: "Exibir nota completa",
                onClick: () => setSelectedRow(row)
              }
            ]
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label={`Ações da conta ${row.contaId}`} />
        </Dropdown>
      )
    }
  ];

  return (
    <Card title="Consolidado de Inadimplência e Cobranças" style={{ marginTop: 24 }}>
      <Table<ReceivableRow>
        rowKey="contaId"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: true }}
      />

      <Modal
        title={selectedRow ? `Cobrança #${selectedRow.contaId}` : ""}
        open={Boolean(selectedRow)}
        onCancel={() => setSelectedRow(null)}
        footer={null}
        width={680}
      >
        {selectedRow ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Cliente">{selectedRow.clienteNome}</Descriptions.Item>
            <Descriptions.Item label="Nome fantasia">{selectedRow.clienteFantasia || "-"}</Descriptions.Item>
            <Descriptions.Item label="CPF/CNPJ">{selectedRow.cpfCnpj}</Descriptions.Item>
            <Descriptions.Item label="Documento">{selectedRow.documento || "-"}</Descriptions.Item>
            <Descriptions.Item label="Boleto">
              {selectedRow.boletoId ? `#${selectedRow.boletoId}` : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Nosso número">{selectedRow.nossoNumero || "-"}</Descriptions.Item>
            <Descriptions.Item label="Linha digitável" span={2}>
              {selectedRow.linhaDigitavel || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Situação">{selectedRow.situacao}</Descriptions.Item>
            <Descriptions.Item label="Dias em atraso">{selectedRow.diasAtraso}</Descriptions.Item>
            <Descriptions.Item label="Vencimento">{formatDate(selectedRow.dataVencimento)}</Descriptions.Item>
            <Descriptions.Item label="Pagamento">{formatMaybeDate(selectedRow.dataPagamento)}</Descriptions.Item>
            <Descriptions.Item label="Valor total">{formatCurrency(selectedRow.total)}</Descriptions.Item>
            <Descriptions.Item label="Tentativas de cobrança">
              {selectedRow.tentativasCobranca}
            </Descriptions.Item>
            <Descriptions.Item label="Último envio">{formatMaybeDate(selectedRow.ultimoEnvio)}</Descriptions.Item>
            <Descriptions.Item label="Status do WhatsApp">
              {selectedRow.ultimoEnvio
                ? selectedRow.envioSucesso
                  ? "Com sucesso"
                  : "Sem sucesso"
                : "Sem envios registrados"}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </Card>
  );
}
