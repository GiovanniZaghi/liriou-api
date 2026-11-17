import { MigrationInterface, QueryRunner } from 'typeorm'

/** Pedidos do checkout. Itens e valores são uma foto do momento da compra (não mudam se o catálogo mudar). */
export class CreateOrders1794528000005 implements MigrationInterface {
  name = 'CreateOrders1794528000005'

  async up(q: QueryRunner): Promise<void> {
    // Número amigável do pedido (#1001, #1002...)
    await q.query(`CREATE SEQUENCE "order_number_seq" START WITH 1001`)

    await q.query(`
      CREATE TABLE "orders" (
        "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "number"                integer NOT NULL,
        "status"                varchar(30) NOT NULL,
        "customer_name"         varchar(120) NOT NULL,
        "customer_email"        varchar(254) NOT NULL,
        "customer_cpf"          char(11) NOT NULL,
        "customer_phone"        varchar(11) NOT NULL,
        "shipping_address"      jsonb NOT NULL,
        "shipping_option_id"    varchar(40) NOT NULL,
        "shipping_option_label" varchar(120) NOT NULL,
        "coupon_code"           varchar(40),
        "subtotal_cents"        integer NOT NULL,
        "discount_cents"        integer NOT NULL DEFAULT 0,
        "shipping_cents"        integer NOT NULL DEFAULT 0,
        "total_cents"           integer NOT NULL,
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        "updated_at"            timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "orders_status_check" CHECK ("status" IN ('aguardando_pagamento', 'pago', 'cancelado')),
        CONSTRAINT "orders_totals_check" CHECK ("subtotal_cents" >= 0 AND "discount_cents" >= 0 AND "shipping_cents" >= 0 AND "total_cents" >= 0)
      )
    `)
    await q.query(`CREATE UNIQUE INDEX "orders_number_key" ON "orders" ("number")`)
    await q.query(`CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at" DESC)`)
    await q.query(`CREATE INDEX "orders_customer_email_idx" ON "orders" ("customer_email")`)

    await q.query(`
      CREATE TABLE "order_items" (
        "order_id"         uuid NOT NULL REFERENCES "orders" ("id") ON DELETE CASCADE,
        "product_id"       uuid NOT NULL REFERENCES "products" ("id") ON DELETE RESTRICT,
        "product_name"     varchar(160) NOT NULL,
        "sku"              varchar(60) NOT NULL,
        "image_url"        text NOT NULL,
        "unit_price_cents" integer NOT NULL,
        "quantity"         integer NOT NULL,
        PRIMARY KEY ("order_id", "product_id"),
        CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0),
        CONSTRAINT "order_items_price_check" CHECK ("unit_price_cents" >= 0)
      )
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "order_items"`)
    await q.query(`DROP TABLE "orders"`)
    await q.query(`DROP SEQUENCE "order_number_seq"`)
  }
}
