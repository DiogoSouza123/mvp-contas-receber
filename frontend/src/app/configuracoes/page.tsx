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
      <main className="page-shell">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h1 className="panel-title">Parâmetros Operacionais</h1>
              <p className="panel-subtitle">Regras de envio, janela de cobrança e limites anti-spam.</p>
            </div>
          </header>

          <div className="config-list">
            {parametros.map((parametro) => (
              <ParametroForm
                key={parametro.chave}
                chave={parametro.chave}
                descricao={parametro.descricao}
                valorInicial={parametro.valor}
              />
            ))}
          </div>
        </section>

        <section className="panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Templates de Mensagem</h2>
              <p className="panel-subtitle">Mensagens usadas pela cobrança automática e pelo chatbot.</p>
            </div>
          </header>

          <div className="config-list">
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
        </section>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar configurações.";
    return (
      <main className="page-shell">
        <section className="panel">
          <h1 className="panel-title">Falha ao carregar configurações</h1>
          <p className="panel-subtitle">{message}</p>
        </section>
      </main>
    );
  }
}
