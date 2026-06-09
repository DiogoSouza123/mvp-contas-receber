"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";

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
    "Sou o assistente gerencial. Pergunte sobre inadimplência, performance de cobrança, clientes em risco, taxa de sucesso de WhatsApp e tendências de vencimento."
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
      content: state.question
    };

    const assistantMessage: ChatMessage = {
      id: `a-${state.requestId}`,
      role: "assistant",
      content: state.ok ? state.answer : state.error || "Não foi possível responder agora.",
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
