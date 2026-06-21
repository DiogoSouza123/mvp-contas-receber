import pg from "pg";
import { STATEMENT_TIMEOUT_MS } from "./schemaContract.js";

const { Pool } = pg;

const connectionString = process.env.MCP_AGENT_DATABASE_URL;
if (!connectionString) {
  throw new Error("MCP_AGENT_DATABASE_URL nao configurada para o mcp-postgres.");
}

const pool = new Pool({
  connectionString,
  statement_timeout: STATEMENT_TIMEOUT_MS,
});

/**
 * Executa uma query ja validada dentro de uma transacao READ ONLY explicita.
 * A role do banco (mcp_agent_ro) ja e read-only por padrao - isto e uma
 * segunda camada de garantia, nao a unica.
 */
export async function runReadOnlyQuery(sql) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(sql);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function describeSchemaColumns(tableNames) {
  const result = await pool.query(
    `
      SELECT
        c.table_name,
        obj_description(('app.' || c.table_name)::regclass, 'pg_class') AS table_comment,
        c.column_name,
        c.data_type,
        col_description(('app.' || c.table_name)::regclass, c.ordinal_position) AS column_comment
      FROM information_schema.columns c
      WHERE c.table_schema = 'app'
        AND c.table_name = ANY($1::text[])
      ORDER BY c.table_name, c.ordinal_position
    `,
    [tableNames]
  );
  return result.rows;
}

export async function checkConnection() {
  await pool.query("SELECT 1");
}
