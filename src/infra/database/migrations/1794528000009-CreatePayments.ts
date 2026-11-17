import { MigrationInterface, QueryRunner } from 'typeorm'

/** Tentativas de pagamento dos pedidos (Mercado Pago). Um pedido pode ter várias. */
export class CreatePayments1794528000009 implements MigrationInterface {
  name = 'CreatePayments1794528000009'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "payments" (
        "id"               uuid PRIMARY KEY,
        "order_id"         uuid NOT NULL REFERENCES "orders" ("id") ON DELETE CASCADE,
        "method"           varchar(20) NOT NULL,
        "status"           varchar(20) NOT NULL,
        "status_detail"    varchar(60) NOT NULL,
        "amount_cents"     integer NOT NULL,
        "installments"     smallint NOT NULL DEFAULT 1,
        "gateway_order_id" varchar(60),
        "qr_code"          text,
        "qr_code_base64"   text,
        "ticket_url"       text,
        "digitable_line"   varchar(80),
        "expires_at"       timestamptz,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "payments_method_check" CHECK ("method" IN ('pix', 'credit_card', 'boleto')),
        CONSTRAINT "payments_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
        CONSTRAINT "payments_amount_check" CHECK ("amount_cents" > 0),
        CONSTRAINT "payments_installments_check" CHECK ("installments" BETWEEN 1 AND 24)
      )
    `)
    await q.query(`CREATE INDEX "payments_order_idx" ON "payments" ("order_id", "created_at" DESC)`)
    await q.query(`CREATE UNIQUE INDEX "payments_gateway_order_key" ON "payments" ("gateway_order_id")`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "payments"`)
  }
}
