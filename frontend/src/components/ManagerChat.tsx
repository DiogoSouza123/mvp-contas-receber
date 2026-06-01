"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { askManagerAssistant } from "@/app/actions";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  rowsCount?: number;
  error?: boolean;
};

type ChatState = {
  requestId: string;
  ok: boolean;
  question: string;
  answer: string;
  sql: string;
  rowsCount: number;
  error: string;
};

const assistantGreeting: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Sou o assistente gerencial. Pergunte sobre inadimplencia, performance de cobranca, clientes em risco, taxa de sucesso de WhatsApp e tendencias de vencimento."
};

const initialChatState: ChatState = {
  requestId: "",
  ok: false,
  question: "",
  answer: "",
  sql: "",
  rowsCount: 0,
  error: ""
};

export function ManagerChat() {
  const [state, formAction, pending] = useActionState(askManagerAssistant, initialChatState);
  const [messages, setMessages] = useState<ChatMessage[]>([assistantGreeting]);
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
      content: state.question
    };

    const assistantMessage: ChatMessage = {
      id: `a-${state.requestId}`,
      role: "assistant",
      content: state.ok ? state.answer : state.error || "Nao foi possivel responder agora.",
      sql: state.ok ? state.sql : undefined,
      rowsCount: state.ok ? state.rowsCount : undefined,
      error: !state.ok
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);

    if (state.ok && textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.focus();
    }
  }, [state]);

  return (
    <section className="panel chat-panel">
      <header className="panel-header">
        <h2 className="panel-title">Chat Gerencial com LLM</h2>
        <p className="panel-subtitle">
          Perguntas em linguagem natural. A resposta e baseada em SQL de leitura no banco.
        </p>
      </header>

      <div className="chat-log">
        {messages.map((message) => (
          <article key={message.id} className={`chat-message ${message.role} ${message.error ? "chat-error" : ""}`}>
            <p className="chat-role">{message.role === "user" ? "Gestor" : "Assistente"}</p>
            <p>{message.content}</p>
            {message.sql ? (
              <details className="chat-sql">
                <summary>SQL executada ({message.rowsCount} linha(s) retornada(s))</summary>
                <pre>{message.sql}</pre>
              </details>
            ) : null}
          </article>
        ))}
      </div>

      <form action={formAction} className="chat-form">
        <label htmlFor="question" className="input-label">
          Sua pergunta
        </label>
        <textarea
          id="question"
          name="question"
          ref={textareaRef}
          placeholder="Ex.: Quais clientes concentram o maior valor vencido no periodo?"
          required
          minLength={4}
          maxLength={500}
          rows={4}
          className="chat-input"
        />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Analisando..." : "Consultar Assistente"}
        </button>
      </form>
    </section>
  );
}
