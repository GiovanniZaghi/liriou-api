import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Fotos dos produtos guardadas no próprio Postgres (bytea).
 * Com poucos produtos não vale um storage externo, e o disco do Railway é apagado a cada deploy.
 */
export class CreateImages1794528000011 implements MigrationInterface {
  name = 'CreateImages1794528000011'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "images" (
        "id"         uuid        PRIMARY KEY,
        "mime_type"  text        NOT NULL,
        "size_bytes" integer     NOT NULL CHECK ("size_bytes" > 0),
        "checksum"   text        NOT NULL,
        "data"       bytea       NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `)
    await q.query(`CREATE UNIQUE INDEX "images_checksum_key" ON "images" ("checksum")`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "images"`)
  }
}
