import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Pedidos feitos antes do acompanhamento de clientes tiveram a sacola apagada.
 * Recria a sessão (já convertida) a partir dos dados do próprio pedido, para eles aparecerem em Clientes.
 */
export class BackfillOrderSessions1794528000007 implements MigrationInterface {
  name = 'BackfillOrderSessions1794528000007'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      WITH orphan AS (
        SELECT o.* FROM orders o WHERE NOT EXISTS (SELECT 1 FROM carts c WHERE c.order_id = o.id)
      ), inserted AS (
        INSERT INTO carts (id, coupon_code, shipping_option_id, checkout_stage, customer, shipping_address,
                           identified_at, delivery_at, order_id, ordered_at, created_at, updated_at)
        SELECT gen_random_uuid(), o.coupon_code, o.shipping_option_id, 'ordered',
               jsonb_build_object('name', o.customer_name, 'email', o.customer_email, 'cpf', o.customer_cpf, 'phone', o.customer_phone),
               o.shipping_address, o.created_at, o.created_at, o.id, o.created_at, o.created_at, o.created_at
          FROM orphan o
        RETURNING id, order_id
      )
      INSERT INTO cart_items (cart_id, product_id, quantity, added_at)
      SELECT i.id, oi.product_id, oi.quantity, o.created_at
        FROM inserted i
        JOIN order_items oi ON oi.order_id = i.order_id
        JOIN orders o ON o.id = i.order_id
    `)
  }

  async down(): Promise<void> {
    // Sem volta: as sessões recriadas são indistinguíveis das demais e não atrapalham.
  }
}
