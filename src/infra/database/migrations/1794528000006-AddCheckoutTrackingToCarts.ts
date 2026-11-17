import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A sacola passa a registrar o progresso do checkout (quem é a cliente, onde parou)
 * e, ao virar pedido, fica marcada como convertida em vez de ser apagada.
 */
export class AddCheckoutTrackingToCarts1794528000006 implements MigrationInterface {
  name = 'AddCheckoutTrackingToCarts1794528000006'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "carts"
        ADD COLUMN "checkout_stage"   varchar(20) NOT NULL DEFAULT 'cart',
        ADD COLUMN "customer"         jsonb,
        ADD COLUMN "shipping_address" jsonb,
        ADD COLUMN "identified_at"    timestamptz,
        ADD COLUMN "delivery_at"      timestamptz,
        ADD COLUMN "order_id"         uuid REFERENCES "orders" ("id") ON DELETE SET NULL,
        ADD COLUMN "ordered_at"       timestamptz,
        ADD CONSTRAINT "carts_checkout_stage_check" CHECK ("checkout_stage" IN ('cart', 'identified', 'delivery', 'ordered'))
    `)
    await q.query(`CREATE INDEX "carts_checkout_stage_idx" ON "carts" ("checkout_stage", "updated_at" DESC)`)
    // Busca de outras sessões da mesma cliente
    await q.query(`CREATE INDEX "carts_customer_email_idx" ON "carts" ((lower("customer"->>'email')))`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "carts_customer_email_idx"`)
    await q.query(`DROP INDEX "carts_checkout_stage_idx"`)
    await q.query(`
      ALTER TABLE "carts"
        DROP CONSTRAINT "carts_checkout_stage_check",
        DROP COLUMN "ordered_at",
        DROP COLUMN "order_id",
        DROP COLUMN "delivery_at",
        DROP COLUMN "identified_at",
        DROP COLUMN "shipping_address",
        DROP COLUMN "customer",
        DROP COLUMN "checkout_stage"
    `)
  }
}
