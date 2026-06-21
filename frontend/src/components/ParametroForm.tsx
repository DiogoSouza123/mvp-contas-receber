"use client";

import { useActionState } from "react";

import { atualizarParametro } from "@/app/configuracoes/actions";

type ParametroFormProps = {
  chave: string;
  descricao: string;
  valorInicial: string;
};

const initialState = { ok: false, error: "" };

export function ParametroForm({ chave, descricao, valorInicial }: ParametroFormProps) {
  const [state, formAction, pending] = useActionState(atualizarParametro, initialState);

  return (
    <form action={formAction} className="config-row">
      <input type="hidden" name="chave" value={chave} />
      <div className="input-group input-grow">
        <label htmlFor={`valor-${chave}`}>
          {chave}
          <span className="config-helper"> — {descricao}</span>
        </label>
        <input id={`valor-${chave}`} name="valor" type="text" defaultValue={valorInicial} />
      </div>
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </button>
      {state.error ? <p className="config-error">{state.error}</p> : null}
      {state.ok ? <p className="config-success">Salvo.</p> : null}
    </form>
  );
}
