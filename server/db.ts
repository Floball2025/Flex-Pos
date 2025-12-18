// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not defined");

const usingCloudSqlSocket = DATABASE_URL.includes("host=/cloudsql/");

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: usingCloudSqlSocket
    ? undefined
    : { rejectUnauthorized: false }, // (ok para Cloud SQL via IP + sslmode)
});

export const db = drizzle(pool, { schema });
