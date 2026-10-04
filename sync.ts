import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const V1_DATABASE_URL = process.env.V1_DATABASE_URL || ''

const v1Pool = new Pool({
  connectionString: V1_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const v2 = new PrismaClient()

function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function main() {
  if (!V1_DATABASE_URL) throw new Error('Falta V1_DATABASE_URL en el .env')

  console.log('=== SINCRONIZACIÓN v1 → v2 ===\n')

  // 1. Categorías: upsert por nombre exacto
  const catResult = await v1Pool.query('SELECT id, name FROM "Category" ORDER BY "createdAt" ASC')
  const categoryMap = new Map<string, string>()
  for (const cat of catResult.rows) {
    const existing = await v2.category.findUnique({ where: { name: cat.name } })
    if (existing) {
      categoryMap.set(cat.id, existing.id)
    } else {
      const created = await v2.category.create({ data: { name: cat.name } })
      categoryMap.set(cat.id, created.id)
      console.log(`categoría nueva: ${cat.name}`)
    }
  }
  console.log(`Categorías v1 procesadas: ${catResult.rows.length}\n`)

  // 2. Índice de v2: TODOS los productos por clave (arrays, para respetar duplicados)
  const v2Products = await v2.product.findMany()
  const v2Index = new Map<string, { id: string }[]>()
  for (const p of v2Products) {
    const key = `${normalizeText(p.name)}::${p.categoryId}`
    if (!v2Index.has(key)) v2Index.set(key, [])
    v2Index.get(key)!.push({ id: p.id })
  }

  // 3. Productos v1 en orden estable
  const prodResult = await v1Pool.query(
    'SELECT id, name, measure, price, image, "imageId", "isActive", "categoryId" FROM "Product" ORDER BY "createdAt" ASC, id ASC'
  )
  const sourceProducts = prodResult.rows

  const syncedV2Ids = new Set<string>()
  let updated = 0
  let created = 0

  for (const p of sourceProducts) {
    const newCategoryId = categoryMap.get(p.categoryId)
    if (!newCategoryId) {
      console.error(`  ⚠ producto sin categoría mapeada: ${p.name}`)
      continue
    }

    const key = `${normalizeText(p.name)}::${newCategoryId}`
    const queue = v2Index.get(key)
    const match = queue && queue.length > 0 ? queue.shift()! : null

    let v2ProductId: string
    if (match) {
      await v2.product.update({
        where: { id: match.id },
        data: {
          name: p.name, measure: p.measure, price: p.price,
          image: p.image, imageId: p.imageId, isActive: p.isActive, categoryId: newCategoryId,
        },
      })
      v2ProductId = match.id
      updated++
    } else {
      const createdProduct = await v2.product.create({
        data: {
          name: p.name, measure: p.measure, price: p.price,
          image: p.image, imageId: p.imageId, isActive: p.isActive,
          categoryId: newCategoryId, stock: 99, salePrice: null, gallery: [],
        },
      })
      v2ProductId = createdProduct.id
      created++
      console.log(`producto nuevo: ${p.name}`)
    }
    syncedV2Ids.add(v2ProductId)

    // Variantes de este producto: reemplazo completo
    const varResult = await v1Pool.query(
      'SELECT name, image, "imageId" FROM "ProductVariant" WHERE "productId" = $1',
      [p.id]
    )
    await v2.productVariant.deleteMany({ where: { productId: v2ProductId } })
    for (const v of varResult.rows) {
      await v2.productVariant.create({
        data: { name: v.name, image: v.image, imageId: v.imageId, productId: v2ProductId, stock: 99, price: null },
      })
    }
  }
  console.log(`\nProductos actualizados: ${updated}`)
  console.log(`Productos creados: ${created}`)

  // 4. Huérfanos: productos de v2 sin correspondencia en v1
  const orphans = v2Products.filter(p => !syncedV2Ids.has(p.id))
  for (const orphan of orphans) {
    await v2.product.delete({ where: { id: orphan.id } })
    console.log(`producto eliminado (no existe en v1): ${orphan.name}`)
  }
  console.log(`Productos eliminados: ${orphans.length}`)

  // 5. Categorías vacías de v2 que ya no existen en v1
  const v1CategoryNames = new Set(catResult.rows.map(c => c.name.toLowerCase()))
  const v2Categories = await v2.category.findMany({ include: { _count: { select: { products: true } } } })
  for (const cat of v2Categories) {
    if (!v1CategoryNames.has(cat.name.toLowerCase()) && cat._count.products === 0) {
      await v2.category.delete({ where: { id: cat.id } })
      console.log(`categoría eliminada: ${cat.name}`)
    }
  }

  // 6. Reporte
  const v2CatCount = await v2.category.count()
  const v2ProdCount = await v2.product.count()
  const v2VarCount = await v2.productVariant.count()
  const v1VarCount = await v1Pool.query('SELECT COUNT(*) as c FROM "ProductVariant"')

  console.log('\n=== REPORTE DE CONSISTENCIA ===')
  console.log(`Categorías:  v1=${catResult.rows.length}  →  v2=${v2CatCount}`)
  console.log(`Productos:   v1=${sourceProducts.length}  →  v2=${v2ProdCount}`)
  console.log(`Variantes:   v1=${v1VarCount.rows[0].c}  →  v2=${v2VarCount}`)

  if (catResult.rows.length === v2CatCount && sourceProducts.length === v2ProdCount && parseInt(v1VarCount.rows[0].c) === v2VarCount) {
    console.log('\n✅ SINCRONIZACIÓN CONSISTENTE: v2 es espejo exacto de v1')
  } else {
    console.log('\n❌ DISCREPANCIA: revisa los mensajes ⚠ de arriba')
  }

  await v1Pool.end()
}

main()
  .catch((e) => {
    console.error('Error fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await v2.$disconnect()
  })