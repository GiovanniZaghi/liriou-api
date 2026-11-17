import { MigrationInterface, QueryRunner } from 'typeorm'

/** Cupons de desconto válidos para todo o site, geridos pelo dashboard. */
export class CreateCoupons1794528000008 implements MigrationInterface {
  name = 'CreateCoupons1794528000008'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "coupons" (
        "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code"               varchar(30) NOT NULL,
        "description"        varchar(200),
        "discount_type"      varchar(10) NOT NULL,
        -- percent: % inteiro (10 = 10%) · fixed: centavos
        "discount_value"     integer NOT NULL,
        "min_subtotal_cents" integer NOT NULL DEFAULT 0,
        "starts_at"          timestamptz,
        "ends_at"            timestamptz,
        "max_uses"           integer,
        "used_count"         integer NOT NULL DEFAULT 0,
        "is_active"          boolean NOT NULL DEFAULT true,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "coupons_type_check"     CHECK ("discount_type" IN ('percent', 'fixed')),
        CONSTRAINT "coupons_value_check"    CHECK ("discount_value" > 0 AND ("discount_type" <> 'percent' OR "discount_value" <= 100)),
        CONSTRAINT "coupons_min_check"      CHECK ("min_subtotal_cents" >= 0),
        CONSTRAINT "coupons_period_check"   CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at"),
        CONSTRAINT "coupons_uses_check"     CHECK ("max_uses" IS NULL OR "max_uses" >= 1),
        CONSTRAINT "coupons_used_check"     CHECK ("used_count" >= 0 AND ("max_uses" IS NULL OR "used_count" <= "max_uses"))
      )
    `)
    // Código sempre salvo em maiúsculas
    await q.query(`CREATE UNIQUE INDEX "coupons_code_key" ON "coupons" ("code")`)

    // O cupom que existia fixo no código passa a ser um cupom cadastrado
    await q.query(`
      INSERT INTO "coupons" ("code", "description", "discount_type", "discount_value")
      VALUES ('LIRIOU10', '10% de desconto da lista VIP', 'percent', 10)
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "coupons"`)
  }
}
