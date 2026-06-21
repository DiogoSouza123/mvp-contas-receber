"use client";

import { useActionState } from "react";
import { Alert, Button, Card, Input, Tag } from "antd";

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
    <Card
      size="small"
      title={chave}
      extra={<Tag>{canal}</Tag>}
      style={{ marginBottom: 12 }}
    >
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <Input.TextArea name="conteudo" rows={4} defaultValue={conteudoInicial} />
        <p className="cell-helper" style={{ marginTop: 4 }}>
          Use placeholders no formato {"{{campo}}"} (ex.: {"{{cliente_nome}}"}).
        </p>
        <Button type="primary" htmlType="submit" loading={pending} style={{ marginTop: 8 }}>
          Salvar template
        </Button>
        {state.error ? <Alert type="error" message={state.error} showIcon style={{ marginTop: 8 }} /> : null}
        {state.ok ? <Alert type="success" message="Salvo." showIcon style={{ marginTop: 8 }} /> : null}
      </form>
    </Card>
  );
}
