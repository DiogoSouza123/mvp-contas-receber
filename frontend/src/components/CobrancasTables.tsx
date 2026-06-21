"use client";

import { Card, Tag, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { AtendimentoRow, CobrancaRow } from "@/lib/cobrancas";
import { formatDate } from "@/lib/format";

type Props = {
  cobrancas: CobrancaRow[];
  atendimentos: AtendimentoRow[];
};

export function CobrancasTables({ cobrancas, atendimentos }: Props) {
  const cobrancaColumns: ColumnsType<CobrancaRow> = [
    { title: "Cliente", dataIndex: "clienteNome", key: "clienteNome" },
    { title: "Telefone", dataIndex: "telefone", key: "telefone" },
    { title: "Canal", dataIndex: "channel", key: "channel" },
    { title: "Categoria", dataIndex: "category", key: "category" },
    {
      title: "Status",
      key: "status",
      render: (_, row) => <Tag color={row.status ? "green" : "red"}>{row.status ? "Sucesso" : "Falha"}</Tag>
    },
    {
      title: "Data",
      key: "createdAt",
      render: (_, row) => formatDate(row.createdAt)
    }
  ];

  const atendimentoColumns: ColumnsType<AtendimentoRow> = [
    { title: "Telefone", dataIndex: "telefone", key: "telefone" },
    { title: "Canal", dataIndex: "channel", key: "channel" },
    { title: "Origem", dataIndex: "role", key: "role" },
    { title: "Intenção", dataIndex: "intent", key: "intent", render: (value: string | null) => value || "-" },
    {
      title: "Mensagem",
      dataIndex: "message",
      key: "message",
      ellipsis: true
    },
    {
      title: "Data",
      key: "createdAt",
      render: (_, row) => formatDate(row.createdAt)
    }
  ];

  return (
    <>
      <Card title={`${cobrancas.length} tentativa(s) de envio no período`} style={{ marginTop: 16 }}>
        <Table<CobrancaRow> rowKey="id" columns={cobrancaColumns} dataSource={cobrancas} pagination={{ pageSize: 10 }} />
      </Card>

      <Card title={`${atendimentos.length} mensagem(ns) de atendimento no período`} style={{ marginTop: 16 }}>
        <Table<AtendimentoRow>
          rowKey="id"
          columns={atendimentoColumns}
          dataSource={atendimentos}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </>
  );
}
