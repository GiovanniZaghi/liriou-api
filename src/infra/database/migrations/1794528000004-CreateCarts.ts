import { MigrationInterface, QueryRunner } from 'typeorm'

/** Sacola persistida no servidor: sobrevive a sair do site, trocar de aba ou limpar o cache do front. */
export class CreateCarts1794528000004 implements MigrationInterface {
  name = 'CreateCarts1794528000004'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "carts" (
        "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "coupon_code"        varchar(40),
        "shipping_option_id" varchar(40),
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now()
      )
    `)
    // Para limpar sacolas abandonadas / campanhas de recuperação no futuro
    await q.query(`CREATE INDEX "carts_updated_at_idx" ON "carts" ("updated_at")`)

    await q.query(`
      CREATE TABLE "cart_items" (
        "cart_id"    uuid NOT NULL REFERENCES "carts" ("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "products" ("id") ON DELETE CASCADE,
        "quantity"   integer NOT NULL,
        "added_at"   timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("cart_id", "product_id"),
        CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99)
      )
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "cart_items"`)
    await q.query(`DROP TABLE "carts"`)
  }
}
