// Postgres connection. Single sql template tag, stashed on globalThis to
// survive Next.js dev HMR without leaking pooled connections.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __paideiaSql?: Sql };

export const sql: Sql = g.__paideiaSql ?? postgres(url);

if (process.env.NODE_ENV !== "production") g.__paideiaSql = sql;
