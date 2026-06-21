"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Alert, Button, Drawer, FloatButton, Input, Space, Statistic, Table, Tag } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

import { askManagerAssistant, type ManagerAnswer } from "@/app/actions";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; error?: boolean }
  | { id: string; role: "assistant"; answer: ManagerAnswer; sql: string; rowsCount: number };

type ChatState = {
  requestId: string;
  ok: boolean;
  question: string;
  answer: ManagerAnswer | null;
  sql: string;
  rowsCount: number;
  error: string;
};

const assistantGreeting: ChatMessage = {
  id: "greeting",
  role: "assistant",
  text: "Sou o assistente gerencial. Pergunte sobre inadimplência, performance de cobrança, clientes em risco, taxa de sucesso de WhatsApp e tendências de vencimento."
};

const initialChatState: ChatState = {
  requestId: "",
  ok: false,
  question: "",
  answer: null,
  sql: "",
  rowsCount: 0,
  error: ""
};

function AssistantAnswer({ answer, sql, rowsCount }: { answer: ManagerAnswer; sql: string; rowsCount: number }) {
  const columns: ColumnsType<Record<string, string>> | undefined = answer.tabela
    ? answer.tabela.colunas.map((coluna) => ({
        title: coluna,
        dataIndex: coluna,
        key: coluna
      }))
    : undefined;

  const dataSource: Record<string, string>[] = answer.tabela
    ? answer.tabela.linhas.map((linha) => {
        const row: Record<string, string> = {};
        answer.tabela!.colunas.forEach((coluna, colIndex) => {
          row[coluna] = linha[colIndex];
        });
        return row;
      })
    : [];

  return (
    <>
      <p style={{ fontWeight: 600 }}>{answer.resumo}</p>

      {answer.metricas.length > 0 ? (
        <Space size="large" wrap style={{ marginTop: 8 }}>
          {answer.metricas.map((metrica, index) => (
            <Statistic key={`${metrica.rotulo}-${index}`} title={metrica.rotulo} value={metrica.valor} valueStyle={{ fontSize: 16 }} />
          ))}
        </Space>
      ) : null}

      {answer.tabela ? (
        <Table
          style={{ marginTop: 12 }}
          size="small"
          columns={columns}
          dataSource={dataSource}
          rowKey={(_, index) => String(index)}
          pagination={false}
          scroll={{ x: true }}
        />
      ) : null}

      {answer.alertas.length > 0 ? (
        <Space direction="vertical" size={4} style={{ marginTop: 12 }}>
          {answer.alertas.map((alerta, index) => (
            <Tag key={index} color="warning">
              {alerta}
            </Tag>
          ))}
        </Space>
      ) : null}

      {answer.proximaAcao ? <p style={{ marginTop: 8, fontWeight: 600 }}>Próxima ação: {answer.proximaAcao}</p> : null}

      <details style={{ marginTop: 12 }}>
        <summary>SQL executada ({rowsCount} linha(s) retornada(s))</summary>
        <pre className="chat-sql-pre">{sql}</pre>
      </details>
    </>
  );
}

export function ManagerChat() {
  const [state, formAction, pending] = useActionState(askManagerAssistant, initialChatState);
  const [messages, setMessages] = useState<ChatMessage[]>([assistantGreeting]);
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastHandledRequestId = useRef("");

  useEffect(() => {
    if (!state.requestId || lastHandledRequestId.current === state.requestId) {
      return;
    }

    lastHandledRequestId.current = state.requestId;

    const userMessage: ChatMessage = { id: `u-${state.requestId}`, role: "user", text: state.question };

    const assistantMessage: ChatMessage =
      state.ok && state.answer
        ? { id: `a-${state.requestId}`, role: "assistant", answer: state.answer, sql: state.sql, rowsCount: state.rowsCount }
        : { id: `a-${state.requestId}`, role: "assistant", text: state.error || "Não foi possível responder agora.", error: true };

    setMessages((current) => [...current, userMessage, assistantMessage]);

    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (pending || event.currentTarget.value.trim().length < 4) {
      return;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <FloatButton icon={<MessageOutlined />} type="primary" tooltip="Chat Gerencial" onClick={() => setIsOpen(true)} />

      <Drawer title="Chat Gerencial" open={isOpen} onClose={() => setIsOpen(false)} width={480}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {messages.map((message) => (
            <div key={message.id}>
              <p className="cell-helper" style={{ marginBottom: 4 }}>
                {message.role === "user" ? "Gestor" : "Assistente"}
              </p>
              {"answer" in message ? (
                <AssistantAnswer answer={message.answer} sql={message.sql} rowsCount={message.rowsCount} />
              ) : "error" in message && message.error ? (
                <Alert type="error" message={message.text} showIcon />
              ) : (
                <p>{message.text}</p>
              )}
            </div>
          ))}
          {pending ? <p className="cell-helper">Analisando...</p> : null}
        </Space>

        <form action={formAction} ref={formRef} style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <Input.TextArea
            name="question"
            placeholder="Escreva sua pergunta..."
            required
            minLength={4}
            maxLength={500}
            rows={2}
            onKeyDown={handleQuestionKeyDown}
          />
          <Button type="primary" htmlType="submit" loading={pending} style={{ flexShrink: 0 }}>
            Enviar
          </Button>
        </form>
      </Drawer>
    </>
  );
}
