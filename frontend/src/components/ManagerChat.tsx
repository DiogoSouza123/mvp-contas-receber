"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";

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
  return (
    <>
      <p className="chat-summary">{answer.resumo}</p>

      {answer.metricas.length > 0 ? (
        <div className="chat-metrics">
          {answer.metricas.map((metrica, index) => (
            <div className="chat-metric-chip" key={`${metrica.rotulo}-${index}`}>
              <span className="chat-metric-label">{metrica.rotulo}</span>
              <span className="chat-metric-value">{metrica.valor}</span>
            </div>
          ))}
        </div>
      ) : null}

      {answer.tabela ? (
        <div className="chat-table-wrapper">
          <table className="chat-table">
            <thead>
              <tr>
                {answer.tabela.colunas.map((coluna) => (
                  <th key={coluna}>{coluna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.tabela.linhas.map((linha, rowIndex) => (
                <tr key={rowIndex}>
                  {linha.map((celula, cellIndex) => (
                    <td key={cellIndex}>{celula}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {answer.alertas.length > 0 ? (
        <ul className="chat-alerts">
          {answer.alertas.map((alerta, index) => (
            <li key={index} className="chat-alert-item">
              {alerta}
            </li>
          ))}
        </ul>
      ) : null}

      {answer.proximaAcao ? <p className="chat-next-action">Próxima ação: {answer.proximaAcao}</p> : null}

      <details className="chat-sql">
        <summary>SQL executada ({rowsCount} linha(s) retornada(s))</summary>
        <pre>{sql}</pre>
      </details>
    </>
  );
}

export function ManagerChat() {
  const [state, formAction, pending] = useActionState(askManagerAssistant, initialChatState);
  const [messages, setMessages] = useState<ChatMessage[]>([assistantGreeting]);
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastHandledRequestId = useRef("");

  useEffect(() => {
    if (!state.requestId || lastHandledRequestId.current === state.requestId) {
      return;
    }

    lastHandledRequestId.current = state.requestId;

    const userMessage: ChatMessage = {
      id: `u-${state.requestId}`,
      role: "user",
      text: state.question
    };

    const assistantMessage: ChatMessage =
      state.ok && state.answer
        ? {
            id: `a-${state.requestId}`,
            role: "assistant",
            answer: state.answer,
            sql: state.sql,
            rowsCount: state.rowsCount
          }
        : {
            id: `a-${state.requestId}`,
            role: "assistant",
            text: state.error || "Não foi possível responder agora.",
            error: true
          };

    setMessages((current) => [...current, userMessage, assistantMessage]);

    if (state.ok && textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.focus();
    }
  }, [state]);

  useEffect(() => {
    if (!isOpen || !chatLogRef.current) {
      return;
    }

    chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [isOpen, messages, pending]);

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
    <aside className="chat-widget" aria-label="Chat gerencial">
      {isOpen ? (
        <section className="chat-popup">
          <header className="chat-popup-header">
            <div>
              <h2 className="chat-popup-title">Chat Gerencial</h2>
              <p className="chat-popup-subtitle">Assistente LLM</p>
            </div>
            <button
              type="button"
              className="chat-icon-button"
              aria-label="Recolher chat"
              onClick={() => setIsOpen(false)}
            >
              -
            </button>
          </header>

          <div className="chat-log" ref={chatLogRef}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`chat-message ${message.role} ${"error" in message && message.error ? "chat-error" : ""}`}
              >
                <p className="chat-role">{message.role === "user" ? "Gestor" : "Assistente"}</p>
                {"answer" in message ? (
                  <AssistantAnswer answer={message.answer} sql={message.sql} rowsCount={message.rowsCount} />
                ) : (
                  <p>{message.text}</p>
                )}
              </article>
            ))}
            {pending ? (
              <article className="chat-message assistant chat-pending">
                <p className="chat-role">Assistente</p>
                <p>Analisando...</p>
              </article>
            ) : null}
          </div>

          <form action={formAction} className="chat-form" ref={formRef}>
            <label htmlFor="question" className="sr-only">
              Sua pergunta
            </label>
            <textarea
              id="question"
              name="question"
              ref={textareaRef}
              placeholder="Escreva sua pergunta..."
              required
              minLength={4}
              maxLength={500}
              rows={2}
              className="chat-input"
              onKeyDown={handleQuestionKeyDown}
            />
            <button type="submit" className="btn-primary chat-send-button" disabled={pending}>
              {pending ? "..." : "Enviar"}
            </button>
          </form>
        </section>
      ) : (
        <button type="button" className="chat-launcher" aria-expanded={isOpen} onClick={() => setIsOpen(true)}>
          Chat Gerencial
        </button>
      )}
    </aside>
  );
}
