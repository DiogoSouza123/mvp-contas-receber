\getenv mcp_agent_password MCP_AGENT_DB_PASSWORD

SELECT 'CREATE ROLE mcp_agent_ro LOGIN PASSWORD ''' || :'mcp_agent_password' || ''''
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp_agent_ro')
\gexec

ALTER ROLE mcp_agent_ro PASSWORD :'mcp_agent_password';
ALTER ROLE mcp_agent_ro SET default_transaction_read_only = on;
ALTER ROLE mcp_agent_ro SET search_path = app, public;
ALTER ROLE mcp_agent_ro CONNECTION LIMIT 5;

COMMENT ON ROLE mcp_agent_ro IS 'Role read-only dedicada ao MCP server usado pelo Chat Gerencial (LLM). Sem GRANT em sequences, sem privilegio de escrita em nenhuma tabela.';

SELECT 'GRANT CONNECT ON DATABASE ' || quote_ident(current_database()) || ' TO mcp_agent_ro'
\gexec

GRANT USAGE ON SCHEMA app TO mcp_agent_ro;

GRANT SELECT ON
  app.clientes,
  app.contatos,
  app.contas_receber,
  app.boletos,
  app.cobrancas_whatsapp,
  app.alteracoes_vencimento,
  app.atendimentos_chat,
  app.chatbot_conversation_state,
  app.parametros_mvp
TO mcp_agent_ro;
