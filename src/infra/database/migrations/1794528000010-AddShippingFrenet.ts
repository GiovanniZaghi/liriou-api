import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Frete pela Frenet:
 * - medidas de envio dos produtos (a cotação usa peso e dimensões reais);
 * - o frete cotado/escolhido fica gravado na sacola e no pedido;
 * - tabela de envios (etiqueta + rastreio) por pedido.
 */
export class AddShippingFrenet1794528000010 implements MigrationInterface {
  name = 'AddShippingFrenet1794528000010'

  async up(q: QueryRunner): Promise<void> {
    // Padrão: pacote mínimo aceito pelos Correios (16x11x4 cm, 100 g). Ajuste por produto no dashboard.
    await q.query(`
      ALTER TABLE "products"
        ADD COLUMN "weight_grams" integer NOT NULL DEFAULT 100,
        ADD COLUMN "length_cm"    integer NOT NULL DEFAULT 16,
        ADD COLUMN "width_cm"     integer NOT NULL DEFAULT 11,
        ADD COLUMN "height_cm"    integer NOT NULL DEFAULT 4,
        ADD CONSTRAINT "products_package_check" CHECK (
          "weight_grams" BETWEEN 1 AND 30000 AND "length_cm" BETWEEN 1 AND 200
          AND "width_cm" BETWEEN 1 AND 200 AND "height_cm" BETWEEN 1 AND 200
        )
    `)
    // Kits pesam mais que uma scrunchie
    await q.query(`UPDATE "products" SET "weight_grams" = 250, "height_cm" = 8 WHERE "category" = 'kit'`)

    await q.query(`ALTER TABLE "carts" ADD COLUMN "shipping_quote" jsonb`)
    // Fretes fixos antigos não existem mais: sacolas abertas voltam a pedir a cotação
    await q.query(`UPDATE "carts" SET "shipping_option_id" = NULL WHERE "checkout_stage" <> 'ordered'`)

    await q.query(`ALTER TABLE "orders" ADD COLUMN "shipping_details" jsonb`)

    await q.query(`
      CREATE TABLE "shipments" (
        "id"                 uuid PRIMARY KEY,
        "order_id"           uuid NOT NULL REFERENCES "orders" ("id") ON DELETE CASCADE,
        "provider_id"        varchar(40) NOT NULL,
        "status"             varchar(40) NOT NULL,
        "tracking_number"    varchar(60),
        "tracking_url"       text,
        "label_url"          text,
        "declaration_url"    text,
        "last_event"         jsonb,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now()
      )
    `)
    await q.query(`CREATE UNIQUE INDEX "shipments_order_key" ON "shipments" ("order_id")`)
    await q.query(`CREATE UNIQUE INDEX "shipments_provider_key" ON "shipments" ("provider_id")`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "shipments"`)
    await q.query(`ALTER TABLE "orders" DROP COLUMN "shipping_details"`)
    await q.query(`ALTER TABLE "carts" DROP COLUMN "shipping_quote"`)
    await q.query(`
      ALTER TABLE "products"
        DROP CONSTRAINT "products_package_check",
        DROP COLUMN "weight_grams", DROP COLUMN "length_cm", DROP COLUMN "width_cm", DROP COLUMN "height_cm"
    `)
  }
}
