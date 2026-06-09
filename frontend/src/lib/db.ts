import { Pool } from "pg";

let cachedPool: Pool | null = null;

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada para o frontend.");
  }

  return new Pool({
    connectionString
  });
}

export function getPool() {
  if (!cachedPool) {
    cachedPool = createPool();
  }
  return cachedPool;
}

export async function queryRows<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
) {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}
