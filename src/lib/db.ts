import { Kysely, PostgresDialect, Generated } from "kysely";
import { Pool } from "pg";

interface ActivationTable {
  id: Generated<number>;
  email: string;
  activation_code: string;
  ip_address: string | null;
  user_agent: string | null;
  activated_at: Generated<Date>;
}

interface ActivationCodeTable {
  id: Generated<number>;
  code: string;
  is_used: boolean;
  usage_limit: number;
  used_count: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface Database {
  activations: ActivationTable;
  activation_codes: ActivationCodeTable;
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const db = new Kysely<Database>({
  dialect,
});
