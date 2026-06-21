import { Card, Space } from "antd";

import { queryRows } from "@/lib/db";
import { ParametroForm } from "@/components/ParametroForm";
import { TemplateForm } from "@/components/TemplateForm";

export const dynamic = "force-dynamic";

type ParametroRow = {
  chave: string;
  valor: string;
  descricao: string;
};

type TemplateRow = {
  id: number;
  chave: string;
  canal: string;
  conteudo: string;
  ativo: boolean;
};

export default async function ConfiguracoesPage() {
  try {
    const [parametros, templates] = await Promise.all([
      queryRows<ParametroRow>("SELECT chave, valor, descricao FROM parametros_mvp ORDER BY chave ASC"),
      queryRows<TemplateRow>(
        "SELECT id, chave, canal, conteudo, ativo FROM templates_mensagem WHERE ativo = TRUE ORDER BY chave ASC"
      )
    ]);

    return (
      <>
        <Card>
          <h1 className="page-title">Parâmetros Operacionais</h1>
          <p className="page-subtitle">Regras de envio, janela de cobrança e limites anti-spam.</p>
          <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 16 }}>
            {parametros.map((parametro) => (
              <ParametroForm
                key={parametro.chave}
                chave={parametro.chave}
                descricao={parametro.descricao}
                valorInicial={parametro.valor}
              />
            ))}
          </Space>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <h2 className="page-title">Templates de Mensagem</h2>
          <p className="page-subtitle">Mensagens usadas pela cobrança automática e pelo chatbot.</p>
          <div style={{ marginTop: 16 }}>
            {templates.map((template) => (
              <TemplateForm
                key={template.id}
                id={template.id}
                chave={template.chave}
                canal={template.canal}
                conteudoInicial={template.conteudo}
              />
            ))}
          </div>
        </Card>
      </>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar configurações.";
    return (
      <Card>
        <h1 className="page-title">Falha ao carregar configurações</h1>
        <p className="page-subtitle">{message}</p>
      </Card>
    );
  }
}
