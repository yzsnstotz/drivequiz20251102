import { Kysely, PostgresDialect, Generated, Selectable, Insertable } from "kysely";
import { Pool } from "pg";

interface QuestionTable {
  id: Generated<number>;
  content_hash: string;
  type: "single" | "multiple" | "truefalse";
  content: string;
  options: any | null;
  correct_answer: any | null;
  image: string | null;
  explanation: string | null;
  license_types: string[] | null;
  version: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface LanguageTable {
  id: Generated<number>;
  locale: string;
  name: string;
  enabled: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface QuestionTranslationsTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  content: string;
  options: any | null;
  explanation: string | null;
  image: string | null;
  source: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface QuestionPolishReviewsTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  proposed_content: string;
  proposed_options: any | null;
  proposed_explanation: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  created_at: Generated<Date>;
  reviewed_at: Date | null;
  updated_at: Generated<Date>;
}

interface QuestionPolishHistoryTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  old_content: string | null;
  old_options: any | null;
  old_explanation: string | null;
  new_content: string;
  new_options: any | null;
  new_explanation: string | null;
  approved_by: string | null;
  approved_at: Generated<Date>;
  created_at: Generated<Date>;
}

interface QuestionAiAnswerTable {
  id: Generated<number>;
  question_hash: string;
  locale: string;
  answer: string;
  sources: any | null;
  model: string | null;
  created_by: string | null;
  view_count: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface Database {
  questions: QuestionTable;
  languages: LanguageTable;
  question_translations: QuestionTranslationsTable;
  question_polish_reviews: QuestionPolishReviewsTable;
  question_polish_history: QuestionPolishHistoryTable;
  question_ai_answers: QuestionAiAnswerTable;
}

export type DB = Kysely<Database>;

function getConnectionString(): string {
  const url =
    process.env.QUESTION_PROCESSOR_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "Missing database connection string. Please set QUESTION_PROCESSOR_DATABASE_URL, DATABASE_URL, or POSTGRES_URL environment variable."
    );
  }
  return url;
}

export function createDb(): DB {
  const pool = new Pool({
    connectionString: getConnectionString(),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  const dialect = new PostgresDialect({ pool });
  return new Kysely<Database>({ dialect });
}

export type QuestionRow = Selectable<QuestionTable>;
export type QuestionTranslationRow = Selectable<QuestionTranslationsTable>;
export type InsertQuestionTranslation = Insertable<QuestionTranslationsTable>;
export type InsertPolishReview = Insertable<QuestionPolishReviewsTable>;
export type PolishReviewRow = Selectable<QuestionPolishReviewsTable>;


