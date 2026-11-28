import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * - "Entregue / Recebido pela cliente": marca no dashboard e oculta o pedido da fila;
 * - índice por CPF para a área da cliente ("meus pedidos").
 */
export class AddOrderDelivered1794528000016 implements MigrationInterface {
  name = 'AddOrderDelivered1794528000016'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamptz`)
    await q.query(`CREATE INDEX IF NOT EXISTS "orders_customer_cpf_idx" ON "orders" ("customer_cpf")`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "orders_customer_cpf_idx"`)
    await q.query(`ALTER TABLE "orders" DROP COLUMN "delivered_at"`)
  }
}
