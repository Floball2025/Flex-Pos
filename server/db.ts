// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL not defined");
}

// ✅ Cloud SQL geralmente exige SSL quando usa IP público
const needsSsl =
  process.env.NODE_ENV === "production" ||
  DATABASE_URL.includes("sslmode=require") ||
  DATABASE_URL.includes("ssl=true");

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
