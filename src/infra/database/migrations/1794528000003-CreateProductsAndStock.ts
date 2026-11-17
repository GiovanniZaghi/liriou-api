import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateProductsAndStock1794528000003 implements MigrationInterface {
  name = 'CreateProductsAndStock1794528000003'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "products" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug"            varchar(120) NOT NULL,
        "sku"             varchar(60)  NOT NULL,
        "name"            varchar(160) NOT NULL,
        "description"     text NOT NULL DEFAULT '',
        "category"        varchar(30)  NOT NULL,
        "price_cents"     integer NOT NULL,
        "color_name"      varchar(80),
        "color_hex"       char(7),
        "badge"           varchar(40),
        "image_url"       text NOT NULL,
        "hover_image_url" text,
        "gallery"         jsonb NOT NULL DEFAULT '[]'::jsonb,
        "kit"             jsonb,
        "stock"           integer NOT NULL DEFAULT 0,
        "min_stock"       integer NOT NULL DEFAULT 0,
        "is_active"       boolean NOT NULL DEFAULT true,
        "sort_order"      integer NOT NULL DEFAULT 0,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now(),
        "deleted_at"      timestamptz,
        CONSTRAINT "products_category_check"  CHECK ("category" IN ('scrunchie', 'touca', 'kit', 'acessorio')),
        CONSTRAINT "products_price_check"     CHECK ("price_cents" >= 0),
        CONSTRAINT "products_stock_check"     CHECK ("stock" >= 0),
        CONSTRAINT "products_min_stock_check" CHECK ("min_stock" >= 0),
        CONSTRAINT "products_color_hex_check" CHECK ("color_hex" IS NULL OR "color_hex" ~ '^#[0-9A-Fa-f]{6}$')
      )
    `)
    // Únicos só entre os não excluídos: excluir um produto libera o slug/SKU
    await q.query(`CREATE UNIQUE INDEX "products_slug_key" ON "products" ("slug") WHERE "deleted_at" IS NULL`)
    await q.query(`CREATE UNIQUE INDEX "products_sku_key" ON "products" ("sku") WHERE "deleted_at" IS NULL`)
    await q.query(
      `CREATE INDEX "products_catalog_idx" ON "products" ("sort_order", "created_at") WHERE "deleted_at" IS NULL AND "is_active"`,
    )

    await q.query(`
      CREATE TABLE "stock_movements" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id"    uuid NOT NULL REFERENCES "products" ("id") ON DELETE RESTRICT,
        "type"          varchar(10) NOT NULL,
        "quantity"      integer NOT NULL,
        "balance_after" integer NOT NULL,
        "reason"        varchar(200),
        "created_by"    uuid REFERENCES "admin_users" ("id") ON DELETE SET NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "stock_movements_type_check"     CHECK ("type" IN ('entrada', 'saida')),
        CONSTRAINT "stock_movements_quantity_check" CHECK ("quantity" > 0),
        CONSTRAINT "stock_movements_balance_check"  CHECK ("balance_after" >= 0)
      )
    `)
    await q.query(
      `CREATE INDEX "stock_movements_product_idx" ON "stock_movements" ("product_id", "created_at" DESC)`,
    )
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "stock_movements"`)
    await q.query(`DROP TABLE "products"`)
  }
}
