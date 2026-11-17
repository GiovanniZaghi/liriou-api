import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Corrige links de fotos enviadas antes do PUBLIC_API_URL ser normalizado:
 * saíram como "https://host/images/<id>" (sem o prefixo /api/v1) e não abriam.
 * Só mexe em links exatamente nesse formato; links externos ficam como estão.
 */
export class FixUploadedImageUrls1794528000012 implements MigrationInterface {
  name = 'FixUploadedImageUrls1794528000012'

  async up(q: QueryRunner): Promise<void> {
    // "https://host/images/<uuid>" → "https://host/api/v1/images/<uuid>"
    const BROKEN = `'^(https?://[^/]+)/images/([0-9a-f-]{36})$'`
    const FIXED = `'\\1/api/v1/images/\\2'`
    const fix = (col: string) => `regexp_replace(${col}, ${BROKEN}, ${FIXED})`

    await q.query(`UPDATE "products" SET "image_url" = ${fix('"image_url"')} WHERE "image_url" ~ ${BROKEN}`)
    await q.query(
      `UPDATE "products" SET "hover_image_url" = ${fix('"hover_image_url"')} WHERE "hover_image_url" ~ ${BROKEN}`,
    )
    await q.query(`
      UPDATE "products" p SET "gallery" = (
        SELECT COALESCE(jsonb_agg(to_jsonb(${fix('g.url')}) ORDER BY g.pos), '[]'::jsonb)
        FROM jsonb_array_elements_text(p."gallery") WITH ORDINALITY AS g(url, pos)
      )
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(p."gallery") AS u(url) WHERE u.url ~ ${BROKEN})
    `)
    await q.query(`UPDATE "order_items" SET "image_url" = ${fix('"image_url"')} WHERE "image_url" ~ ${BROKEN}`)
  }

  async down(): Promise<void> {
    // Correção de dados: voltar ao link quebrado não faz sentido
  }
}
