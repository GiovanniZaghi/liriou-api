import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Tabela da lista VIP. Já existia no banco (criada pelo Drizzle no liriou-lp),
 * por isso tudo é IF NOT EXISTS: a migration adota a tabela sem perder os cadastros.
 */
export class CreateLeads1794528000001 implements MigrationInterface {
  name = 'CreateLeads1794528000001'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "leads" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"       text NOT NULL,
        "email"      text NOT NULL,
        "whatsapp"   text NOT NULL,
        "pain"       text,
        "consent_at" timestamptz NOT NULL,
        "utm"        jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `)
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "leads_email_key" ON "leads" ("email")`)
    await q.query(`CREATE INDEX IF NOT EXISTS "leads_created_at_idx" ON "leads" ("created_at")`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "leads"`)
  }
}
