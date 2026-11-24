import { MigrationInterface, QueryRunner } from 'typeorm'

/** Aniversário da cliente (opcional no checkout). Na sacola ele fica dentro do jsonb "customer". */
export class AddCustomerBirthDate1794528000015 implements MigrationInterface {
  name = 'AddCustomerBirthDate1794528000015'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" ADD COLUMN "customer_birth_date" date`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" DROP COLUMN "customer_birth_date"`)
  }
}
