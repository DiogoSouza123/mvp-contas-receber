"use client";

import { useActionState } from "react";
import { Alert, Button, Input, Space } from "antd";

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
    <form action={formAction}>
      <input type="hidden" name="chave" value={chave} />
      <Space.Compact style={{ width: "100%" }}>
        <Input addonBefore={chave} name="valor" defaultValue={valorInicial} />
        <Button type="primary" htmlType="submit" loading={pending}>
          Salvar
        </Button>
      </Space.Compact>
      <p className="cell-helper" style={{ marginTop: 4 }}>
        {descricao}
      </p>
      {state.error ? <Alert type="error" message={state.error} showIcon style={{ marginTop: 4 }} /> : null}
      {state.ok ? <Alert type="success" message="Salvo." showIcon style={{ marginTop: 4 }} /> : null}
    </form>
  );
}
