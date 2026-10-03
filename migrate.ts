import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

// La base VIEJA de tu mamá, leída con SQL crudo (su schema es distinto al v2)
const V1_DATABASE_URL = process.env.V1_DATABASE_URL || ''

const v1Pool = new Pool({
  connectionString: V1_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// La base NUEVA v2, con Prisma (su schema sí coincide)
const v2 = new PrismaClient()

async function main() {
  if (!V1_DATABASE_URL) {
    throw new Error('Falta V1_DATABASE_URL en el .env')
  }

  console.log('=== MIGRACIÓN ZonaOnline v1 → v2 ===\n')

  // 1. Categorías (SQL crudo, solo columnas que sabemos que existen en v1)
  const catResult = await v1Pool.query(
    'SELECT id, name FROM "Category" ORDER BY "createdAt" ASC'
  )
  const sourceCategories = catResult.rows
  console.log(`Categorías encontradas en v1: ${sourceCategories.length}`)

  const categoryMap = new Map<string, string>()

  for (const cat of sourceCategories) {
    const existing = await v2.category.findUnique({ where: { name: cat.name } })
    if (existing) {
      categoryMap.set(cat.id, existing.id)
      console.log(`  categoría ya existía: ${cat.name}`)
    } else {
      const created = await v2.category.create({
        data: { name: cat.name },
      })
      categoryMap.set(cat.id, created.id)
      console.log(`  categoría creada: ${cat.name}`)
    }
  }

  // 2. Productos
  const prodResult = await v1Pool.query(
    'SELECT id, name, measure, price, image, "imageId", "isActive", "categoryId" FROM "Product" ORDER BY "createdAt" ASC'
  )
  const sourceProducts = prodResult.rows
  console.log(`\nProductos encontrados en v1: ${sourceProducts.length}`)

  const productMap = new Map<string, string>()

  for (const p of sourceProducts) {
    const newCategoryId = categoryMap.get(p.categoryId)
    if (!newCategoryId) {
      console.error(`  ⚠ producto sin categoría mapeada: ${p.name}`)
      continue
    }

    const created = await v2.product.create({
      data: {
        name: p.name,
        measure: p.measure,
        price: p.price,
        image: p.image,
        imageId: p.imageId,
        isActive: p.isActive,
        categoryId: newCategoryId,
        stock: 99,
        salePrice: null,
        gallery: [],
      },
    })
    productMap.set(p.id, created.id)
  }
  console.log(`Productos creados en v2: ${productMap.size}`)

  // 3. Variantes
  const varResult = await v1Pool.query(
    'SELECT id, name, image, "imageId", "productId" FROM "ProductVariant"'
  )
  const sourceVariants = varResult.rows
  console.log(`\nVariantes encontradas en v1: ${sourceVariants.length}`)

  let variantCount = 0
  for (const v of sourceVariants) {
    const newProductId = productMap.get(v.productId)
    if (!newProductId) {
      console.error(`  ⚠ variante sin producto mapeado: ${v.name}`)
      continue
    }

    await v2.productVariant.create({
      data: {
        name: v.name,
        image: v.image,
        imageId: v.imageId,
        productId: newProductId,
        stock: 99,
        price: null,
      },
    })
    variantCount++
  }
  console.log(`Variantes creadas en v2: ${variantCount}`)

  // 4. SiteConfig con el WhatsApp de tu mamá
  const whatsappNumber = process.env.WHATSAPP_NUMBER || '000000000000'
  await v2.siteConfig.upsert({
    where: { id: 1 },
    update: { whatsapp: whatsappNumber },
    create: { id: 1, whatsapp: whatsappNumber },
  })
  console.log(`\nSiteConfig creado con WhatsApp: ${whatsappNumber}`)

  // 5. Reporte de consistencia
  const v2Categories = await v2.category.count()
  const v2Products = await v2.product.count()
  const v2Variants = await v2.productVariant.count()

  console.log('\n=== REPORTE DE CONSISTENCIA ===')
  console.log(`Categorías:  v1=${sourceCategories.length}  →  v2=${v2Categories}`)
  console.log(`Productos:   v1=${sourceProducts.length}  →  v2=${v2Products}`)
  console.log(`Variantes:   v1=${sourceVariants.length}  →  v2=${v2Variants}`)

  const ok =
    sourceCategories.length === v2Categories &&
    sourceProducts.length === productMap.size &&
    sourceVariants.length === variantCount

  if (ok && productMap.size === sourceProducts.length) {
    console.log('\n✅ MIGRACIÓN CONSISTENTE')
  } else {
    console.log('\n❌ DISCREPANCIA DETECTADA: revisa los mensajes ⚠ de arriba')
  }

  await v1Pool.end()
}

main()
  .catch((e) => {
    console.error('Error fatal en la migración:', e)
    process.exit(1)
  })
  .finally(async () => {
    await v2.$disconnect()
  })