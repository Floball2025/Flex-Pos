// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not defined");

// Se estiver usando Cloud SQL Unix Socket, NÃO use SSL
const isCloudSqlSocket =
  DATABASE_URL.includes("host=/cloudsql/") || DATABASE_URL.includes("/cloudsql/");

const needsSsl =
  !isCloudSqlSocket &&
  (process.env.NODE_ENV === "production" ||
    DATABASE_URL.includes("sslmode=require") ||
    DATABASE_URL.includes("ssl=true"));

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,

  // evita ficar “preso” 127s em caso de erro de rede
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});

export const db = drizzle(pool, { schema });
