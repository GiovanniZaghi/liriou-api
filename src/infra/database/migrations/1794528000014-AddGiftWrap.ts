import { MigrationInterface, QueryRunner } from 'typeorm'

/** Embalagem de Natal: a cliente marca na sacola e a escolha vai para o pedido. */
export class AddGiftWrap1794528000014 implements MigrationInterface {
  name = 'AddGiftWrap1794528000014'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "carts" ADD COLUMN "gift_wrap" boolean NOT NULL DEFAULT false`)
    await q.query(`ALTER TABLE "orders" ADD COLUMN "gift_wrap" boolean NOT NULL DEFAULT false`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" DROP COLUMN "gift_wrap"`)
    await q.query(`ALTER TABLE "carts" DROP COLUMN "gift_wrap"`)
  }
}
