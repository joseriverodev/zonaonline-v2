'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { uploadImage, deleteImage } from '@/lib/cloudinary'
import { requireAuth } from '@/lib/auth-guard'

export interface ProductFormData {
  name: string
  measure: string
  price: number
  salePrice?: number | null
  stock: number
  image?: string
  imageId?: string | null
  categoryId: string
  gallery?: string[]
  videoUrl?: string | null
  variants?: { name: string; image: string; imageId: string | null; stock: number; price?: number | null }[]
}

interface VariantInput {
  name: string
  image: string
  imageId: string | null
  stock: number
  price?: number | null
}

interface FinalImage {
  url: string
  publicId: string | null
}

// ============ PRODUCTS ============

export async function getProducts() {
  try {
    const products = await db.product.findMany({
      include: { category: true, variants: true },
      orderBy: { createdAt: 'desc' },
    })
    return products
  } catch (error) {
    console.error('Error fetching products:', error)
    return []
  }
}

export async function getActiveProducts() {
  try {
    const products = await db.product.findMany({
      where: { isActive: true },
      include: { category: true, variants: true },
      orderBy: { createdAt: 'desc' },
    })
    return products
  } catch (error) {
    console.error('Error fetching active products:', error)
    return []
  }
}

export async function getProductById(id: string) {
  try {
    const product = await db.product.findUnique({
      where: { id },
      include: { category: true, variants: true },
    })
    return product
  } catch (error) {
    console.error('Error fetching product:', error)
    return null
  }
}

// Create product — receives images ALREADY uploaded to Cloudinary from the client.
// The server action only writes to the database (sub-second, no file transfers).
export async function createProduct(formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const name = formData.get('name') as string
    const measure = formData.get('measure') as string
    const price = parseFloat(formData.get('price') as string)
    const categoryId = formData.get('categoryId') as string
    const videoUrl = (formData.get('videoUrl') as string) || null

    const finalImagesRaw = formData.get('finalImages') as string
    let finalImages: FinalImage[] = []
    try {
      const parsed = JSON.parse(finalImagesRaw || '[]')
      if (Array.isArray(parsed)) finalImages = parsed
    } catch (parseError) {
      console.error('Error parsing finalImages JSON:', parseError)
      finalImages = []
    }

    if (finalImages.length === 0) return { success: false, error: 'Falta la imagen del producto' }
    const main = finalImages[0]

    const variantsRaw = formData.get('variants') as string
    let variants: VariantInput[] = []
    try {
      const parsed = JSON.parse(variantsRaw || '[]')
      if (Array.isArray(parsed)) {
        variants = parsed.map(v => ({
          ...v,
          stock: Number(v.stock) || 0,
          price: v.price ? Number(v.price) : null
        }))
      }
    } catch (parseError) {
      console.error('Error parsing variants JSON:', parseError)
      variants = []
    }

    const product = await db.product.create({
      data: {
        name, measure, price,
        image: main.url, imageId: main.publicId,
        categoryId, isActive: true, stock: 99, salePrice: null,
        gallery: finalImages.slice(1).map(i => i.url),
        videoUrl,
        variants: variants.length > 0
          ? { create: variants.map(v => ({ name: v.name, image: v.image, imageId: v.imageId, stock: v.stock, price: v.price })) }
          : undefined,
      },
      include: { category: true, variants: true },
    })

    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true, product }
  } catch (error) {
    console.error('Error creating product:', error)
    return { success: false, error: 'Error al crear el producto' }
  }
}

// Update product — same contract: finalImages already uploaded, cleanup of removed images
export async function updateProduct(id: string, formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const name = formData.get('name') as string
    const measure = formData.get('measure') as string
    const price = parseFloat(formData.get('price') as string)
    const categoryId = formData.get('categoryId') as string
    const videoUrl = (formData.get('videoUrl') as string) || null

    const finalImagesRaw = formData.get('finalImages') as string
    let finalImages: FinalImage[] = []
    try {
      const parsed = JSON.parse(finalImagesRaw || '[]')
      if (Array.isArray(parsed)) finalImages = parsed
    } catch (parseError) {
      console.error('Error parsing finalImages JSON:', parseError)
      finalImages = []
    }

    if (finalImages.length === 0) return { success: false, error: 'Falta la imagen del producto' }

    // Cleanup: delete from Cloudinary the old images that are no longer in the final list
    const oldProduct = await db.product.findUnique({ where: { id }, select: { image: true, imageId: true, gallery: true } })
    if (oldProduct) {
      const finalUrls = new Set(finalImages.map(i => i.url))
      const oldUrls = [oldProduct.image, ...(oldProduct.gallery || [])].filter(Boolean) as string[]
      for (const oldUrl of oldUrls) {
        if (!finalUrls.has(oldUrl) && oldUrl === oldProduct.image && oldProduct.imageId) {
          try { await deleteImage(oldProduct.imageId) } catch (e) {}
        }
      }
    }

    const variantsRaw = formData.get('variants') as string
    let variants: VariantInput[] = []
    try {
      const parsed = JSON.parse(variantsRaw || '[]')
      if (Array.isArray(parsed)) {
        variants = parsed.map(v => ({
          ...v,
          stock: Number(v.stock) || 0,
          price: v.price ? Number(v.price) : null
        }))
      }
    } catch (parseError) {
      console.error('Error parsing variants JSON:', parseError)
      variants = []
    }

    const main = finalImages[0]
    const product = await db.product.update({
      where: { id },
      data: {
        name, measure, price,
        image: main.url, imageId: main.publicId,
        categoryId,
        gallery: finalImages.slice(1).map(i => i.url),
        videoUrl,
        variants: {
          deleteMany: {},
          create: variants.map(v => ({ name: v.name, image: v.image, imageId: v.imageId, stock: v.stock, price: v.price })),
        },
      },
      include: { category: true, variants: true },
    })

    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true, product }
  } catch (error) {
    console.error('Error updating product:', error)
    return { success: false, error: 'Error al actualizar el producto' }
  }
}

export async function deleteProduct(id: string) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const product = await db.product.findUnique({ where: { id }, include: { variants: true } })
    if (product?.imageId) { try { await deleteImage(product.imageId) } catch (e) {} }
    for (const variant of product?.variants || []) {
      if (variant.imageId) { try { await deleteImage(variant.imageId) } catch (e) {} }
    }
    await db.product.delete({ where: { id } })
    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Error al eliminar el producto' }
  }
}

export async function toggleProductActive(id: string) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const product = await db.product.findUnique({ where: { id }, select: { isActive: true } })
    if (!product) return { success: false, error: 'Producto no encontrado' }
    const updatedProduct = await db.product.update({
      where: { id },
      data: { isActive: !product.isActive },
      include: { category: true, variants: true },
    })
    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true, product: updatedProduct }
  } catch (error) {
    return { success: false, error: 'Error al cambiar el estado' }
  }
}

export async function updateStock(id: string, newStock: number) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const updatedProduct = await db.product.update({
      where: { id },
      data: { stock: Math.max(0, newStock) },
      include: { category: true, variants: true },
    })
    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true, product: updatedProduct }
  } catch (error) {
    return { success: false, error: 'Error al actualizar stock' }
  }
}

// ============ CATEGORIES ============

export async function getCategories() {
  try {
    const categories = await db.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return categories
  } catch (error) { return [] }
}

export async function createCategory(formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const name = formData.get('name') as string
    const category = await db.category.create({ data: { name } })
    revalidatePath('/'); revalidatePath('/admin')
    return { success: true, category }
  } catch (error) { return { success: false, error: 'Error al crear la categoría' } }
}

export async function updateCategory(id: string, formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const name = formData.get('name') as string
    const category = await db.category.update({ where: { id }, data: { name } })
    revalidatePath('/'); revalidatePath('/admin')
    return { success: true, category }
  } catch (error) { return { success: false, error: 'Error al actualizar' } }
}

export async function deleteCategory(id: string) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const productsCount = await db.product.count({ where: { categoryId: id } })
    if (productsCount > 0) return { success: false, error: 'No se puede eliminar una categoría con productos' }
    await db.category.delete({ where: { id } })
    revalidatePath('/'); revalidatePath('/admin')
    return { success: true }
  } catch (error) { return { success: false, error: 'Error al eliminar' } }
}

export async function seedCategories() {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  const defaultCategories = [ 'Ropa', 'Calzado', 'Accesorios', 'Hogar y Decoración', 'Electrónica', 'Juguetes', 'Salud y Belleza' ]
  try {
    for (const name of defaultCategories) {
      await db.category.upsert({ where: { name }, create: { name }, update: {} })
    }
    return { success: true }
  } catch (error) { return { success: false, error: 'Error al crear categorías' } }
}