"use client";

import { Card, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { ClienteRow } from "@/lib/clientes";
import { formatCurrency } from "@/lib/format";

type Props = {
  rows: ClienteRow[];
};

export function ClientesTable({ rows }: Props) {
  const columns: ColumnsType<ClienteRow> = [
    {
      title: "Cliente",
      key: "cliente",
      render: (_, row) => (
        <div>
          <strong>{row.nome}</strong>
          <div className="cell-helper">{row.nomeFantasia || "-"}</div>
        </div>
      )
    },
    {
      title: "CPF/CNPJ",
      dataIndex: "cpfCnpj",
      key: "cpfCnpj"
    },
    {
      title: "Situação",
      key: "situacao",
      render: (_, row) => <Tag color={row.ativo ? "blue" : "red"}>{row.ativo ? "Ativo" : "Inativo"}</Tag>
    },
    {
      title: "Títulos em aberto",
      key: "titulos",
      render: (_, row) => `${row.titulosEmAberto} de ${row.totalTitulos}`
    },
    {
      title: "Valor em aberto",
      key: "valor",
      render: (_, row) => <strong>{formatCurrency(row.valorEmAberto)}</strong>
    }
  ];

  return (
    <Card title={`${rows.length} cliente(s) exibido(s)`} style={{ marginTop: 16 }}>
      <Table<ClienteRow> rowKey="id" columns={columns} dataSource={rows} pagination={{ pageSize: 15 }} />
    </Card>
  );
}
