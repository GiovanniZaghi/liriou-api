import 'reflect-metadata'
import { config } from 'dotenv'
import { DataSource } from 'typeorm'
import { buildTypeOrmOptions } from '../typeorm.options'

/**
 * Zera os dados da loja para começar do zero.
 *
 * MANTÉM: leads (lista VIP da pré-venda), admin_users (login do dashboard) e typeorm_migrations.
 * APAGA:  pedidos, pagamentos, envios, sacolas, cupons e (sem --manter-catalogo) produtos, estoque e fotos.
 *
 * Uso:
 *   npm run db:reset-loja                                → só mostra o que seria apagado
 *   npm run db:reset-loja -- --confirmar                 → apaga tudo da loja
 *   npm run db:reset-loja -- --confirmar --manter-catalogo → apaga só o movimento (mantém produtos e fotos)
 */

const SALES_TABLES = ['shipments', 'payments', 'order_items', 'orders', 'cart_items', 'carts', 'coupons']
const CATALOG_TABLES = ['stock_movements', 'products', 'images']
const KEPT_TABLES = ['leads', 'admin_users']

async function main() {
  config()
  const args = process.argv.slice(2)
  const confirm = args.includes('--confirmar')
  const keepCatalog = args.includes('--manter-catalogo')
  const tables = keepCatalog ? SALES_TABLES : [...SALES_TABLES, ...CATALOG_TABLES]

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurada')
  const db = new DataSource({ ...buildTypeOrmOptions({ DATABASE_URL: url }), entities: [], migrations: [] })
  await db.initialize()

  try {
    const count = async (t: string) => Number((await db.query(`SELECT count(*)::int AS n FROM "${t}"`))[0].n)
    console.log(`\nBanco: ${new URL(url).host}\n`)
    console.log('Será APAGADO:')
    for (const t of tables) console.log(`  - ${t.padEnd(16)} ${await count(t)} registros`)
    console.log('Será MANTIDO:')
    for (const t of [...KEPT_TABLES, ...(keepCatalog ? CATALOG_TABLES : [])]) console.log(`  - ${t.padEnd(16)} ${await count(t)} registros`)

    if (!confirm) {
      console.log('\nNada foi apagado. Rode de novo com --confirmar para apagar.\n')
      return
    }

    await db.transaction(async (em) => {
      await em.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY`)
      // Numeração dos pedidos volta para #1001
      await em.query(`ALTER SEQUENCE "order_number_seq" RESTART WITH 1001`)
    })
    console.log('\nPronto: dados da loja apagados e numeração de pedidos reiniciada em #1001.\n')
  } finally {
    await db.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
