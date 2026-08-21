import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseSchema = process.env.DATABASE_SCHEMA;
if (databaseSchema && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseSchema)) {
  throw new Error("DATABASE_SCHEMA must be a valid PostgreSQL identifier.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(databaseSchema ? { options: `-c search_path=${databaseSchema},public` } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
