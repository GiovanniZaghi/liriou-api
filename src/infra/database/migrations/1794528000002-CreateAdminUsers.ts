import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdminUsers1794528000002 implements MigrationInterface {
  name = 'CreateAdminUsers1794528000002'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "admin_users" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"          varchar(120) NOT NULL,
        "email"         varchar(254) NOT NULL,
        "password_hash" text NOT NULL,
        "is_active"     boolean NOT NULL DEFAULT true,
        "last_login_at" timestamptz,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now()
      )
    `)
    // E-mail sempre salvo em minúsculo; o índice garante um admin por e-mail
    await q.query(`CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users" ("email")`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "admin_users"`)
  }
}
