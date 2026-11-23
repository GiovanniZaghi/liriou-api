import { MigrationInterface, QueryRunner } from 'typeorm'

/** Preço "De" (riscado na vitrine). Vazio = sem promoção; quando existe, é maior que o preço "Por". */
export class AddCompareAtPrice1794528000013 implements MigrationInterface {
  name = 'AddCompareAtPrice1794528000013'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "products"
        ADD COLUMN "compare_at_price_cents" integer,
        ADD CONSTRAINT "products_compare_at_price_check"
          CHECK ("compare_at_price_cents" IS NULL OR "compare_at_price_cents" > "price_cents")
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "products" DROP CONSTRAINT "products_compare_at_price_check", DROP COLUMN "compare_at_price_cents"`)
  }
}
