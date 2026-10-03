import { db } from './src/lib/db'

async function main() {
  console.log('Sembrando base de datos...')

  // Create default categories
  const categoryNames = [
    'Ropa',
    'Calzado',
    'Accesorios',
    'Bebé',
    'Niños',
    'Hogar y Decoración',
    'Electrónica',
    'Cocina',
    'Joyas',
    'Juguetes',
    'Salud y Belleza'
  ]

  console.log('Creando categorías...')
  const categories = await Promise.all(
    categoryNames.map((name) =>
      db.category.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  )

  console.log(`Creadas ${categories.length} categorías`)

  // Helper to find category by name
  const findCategory = (name: string) => categories.find((c) => c.name === name)

  // Create sample products
  const products = [
    {
      name: 'Camiseta Algodón',
      measure: 'Talla M',
      price: 15.99,
      category: 'Ropa',
      image: '/products/camiseta.png',
    },
    {
      name: 'Zapatos Deportivos',
      measure: 'Talla 42',
      price: 45.50,
      category: 'Calzado',
      image: '/products/zapatos.png',
    },
    {
      name: 'Bolso de Mano',
      measure: 'Mediano',
      price: 29.99,
      category: 'Accesorios',
      image: '/products/bolso.png',
    },
    {
      name: 'Pañales Premium',
      measure: 'Pack 50',
      price: 18.75,
      category: 'Bebé',
      image: '/products/panales.png',
    },
    {
      name: 'Juego de Mesa Educativo',
      measure: 'Caja',
      price: 24.99,
      category: 'Niños',
      image: '/products/juego.png',
    },
    {
      name: 'Lámpara Decorativa',
      measure: 'Grande',
      price: 35.00,
      category: 'Hogar y Decoración',
      image: '/products/lampara.png',
    },
    {
      name: 'Auriculares Bluetooth',
      measure: 'Unidad',
      price: 59.99,
      category: 'Electrónica',
      image: '/products/auriculares.png',
    },
    {
      name: 'Set de Ollas',
      measure: '5 piezas',
      price: 89.99,
      category: 'Cocina',
      image: '/products/ollas.png',
    },
    {
      name: 'Collar de Plata',
      measure: '45cm',
      price: 75.00,
      category: 'Joyas',
      image: '/products/collar.png',
    },
    {
      name: 'Peluche Suave',
      measure: '30cm',
      price: 12.50,
      category: 'Juguetes',
      image: '/products/peluche.png',
    },
    {
      name: 'Crema Hidratante',
      measure: '250ml',
      price: 14.99,
      category: 'Salud y Belleza',
      image: '/products/crema.png',
    },
  ]

  console.log('Creando productos de ejemplo...')
  for (const product of products) {
    const category = findCategory(product.category)
    if (!category) {
      console.log(`Categoría no encontrada: ${product.category}`)
      continue
    }

    await db.product.upsert({
      where: {
        id: `${product.name.toLowerCase().replace(/\s+/g, '-')}-seed`
      },
      update: {
        name: product.name,
        measure: product.measure,
        price: product.price,
        image: product.image,
        categoryId: category.id,
      },
      create: {
        id: `${product.name.toLowerCase().replace(/\s+/g, '-')}-seed`,
        name: product.name,
        measure: product.measure,
        price: product.price,
        image: product.image,
        categoryId: category.id,
      },
    })
  }

  console.log(`Creados ${products.length} productos`)
  console.log('¡Base de datos sembrada exitosamente!')
}

main()
  .catch((e) => {
    console.error('Error sembrando la base de datos:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
