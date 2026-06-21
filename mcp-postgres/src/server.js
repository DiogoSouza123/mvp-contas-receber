import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { checkConnection, describeSchemaColumns, runReadOnlyQuery } from "./db.js";
import { guardSql } from "./sqlGuard.js";
import { ALLOWED_TABLES, MAX_ROW_LIMIT, renderBusinessConcepts } from "./schemaContract.js";

const port = Number(process.env.PORT || 3010);

function buildServer() {
  const server = new McpServer({
    name: "mvp-mcp-postgres",
    version: "1.0.0",
  });

  server.registerTool(
    "describe_schema",
    {
      title: "Descrever schema do banco",
      description:
        "Retorna as tabelas, colunas e comentarios (COMMENT ON) das tabelas que o agente esta autorizado a consultar, " +
        "alem das regras de negocio fixas (ex.: como identificar inadimplencia). " +
        "Sempre chame esta tool antes de gerar SQL.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const columns = await describeSchemaColumns(ALLOWED_TABLES);

      const tablesByName = new Map();
      for (const row of columns) {
        if (!tablesByName.has(row.table_name)) {
          tablesByName.set(row.table_name, {
            name: row.table_name,
            comment: row.table_comment || "",
            columns: [],
          });
        }
        tablesByName.get(row.table_name).columns.push({
          name: row.column_name,
          type: row.data_type,
          comment: row.column_comment || "",
        });
      }

      const output = {
        tables: [...tablesByName.values()],
        businessConcepts: renderBusinessConcepts(),
        maxRowLimit: MAX_ROW_LIMIT,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    }
  );

  server.registerTool(
    "run_query",
    {
      title: "Executar consulta de leitura",
      description:
        "Executa uma consulta SQL somente leitura (SELECT/WITH) contra o banco do MVP. " +
        "Apenas as tabelas retornadas por describe_schema sao permitidas. " +
        `Resultado limitado a ${MAX_ROW_LIMIT} linhas. Qualquer comando de escrita ou fora do allowlist e rejeitado antes de chegar ao banco.`,
      inputSchema: {
        sql: z
          .string()
          .min(10)
          .max(4000)
          .describe("Consulta SQL somente leitura (SELECT ou WITH), sem ponto-e-virgula."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ sql }) => {
      try {
        const safeSql = guardSql(sql);
        const result = await runReadOnlyQuery(safeSql);
        const output = {
          sql: safeSql,
          rowCount: result.rowCount,
          rows: result.rows,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao executar a consulta.";
        return {
          content: [{ type: "text", text: `Erro: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

async function main() {
  await checkConnection();

  const app = express();
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      await checkConnection();
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "erro" });
    }
  });

  app.post("/mcp", async (req, res) => {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, () => {
    console.log(`MCP server (read-only) ouvindo em http://0.0.0.0:${port}/mcp`);
  });
}

main().catch((error) => {
  console.error("Falha ao iniciar mcp-postgres", error);
  process.exit(1);
});
