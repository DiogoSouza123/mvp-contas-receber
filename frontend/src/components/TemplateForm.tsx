"use client";

import { useActionState } from "react";

import { atualizarTemplate } from "@/app/configuracoes/actions";

type TemplateFormProps = {
  id: number;
  chave: string;
  canal: string;
  conteudoInicial: string;
};

const initialState = { ok: false, error: "" };

export function TemplateForm({ id, chave, canal, conteudoInicial }: TemplateFormProps) {
  const [state, formAction, pending] = useActionState(atualizarTemplate, initialState);

  return (
    <form action={formAction} className="config-template">
      <input type="hidden" name="id" value={id} />
      <div className="input-group">
        <label htmlFor={`conteudo-${id}`}>
          {chave} <span className="config-helper">({canal})</span>
        </label>
        <textarea id={`conteudo-${id}`} name="conteudo" rows={4} defaultValue={conteudoInicial} />
        <p className="config-helper">Use placeholders no formato {"{{campo}}"} (ex.: {"{{cliente_nome}}"}).</p>
      </div>
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Salvando..." : "Salvar template"}
      </button>
      {state.error ? <p className="config-error">{state.error}</p> : null}
      {state.ok ? <p className="config-success">Salvo.</p> : null}
    </form>
  );
}
