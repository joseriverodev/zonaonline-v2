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

export async function createProduct(formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const name = formData.get('name') as string
    const measure = formData.get('measure') as string
    const price = parseFloat(formData.get('price') as string)
    const categoryId = formData.get('categoryId') as string
    const stock = parseInt(formData.get('stock') as string) || 0
    const videoUrl = (formData.get('videoUrl') as string) || null

    const salePriceRaw = formData.get('salePrice') as string
    const salePrice = salePriceRaw ? parseFloat(salePriceRaw) : null

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

    const imageFiles = formData.getAll('images') as File[]
    let image = ''
    let imageId = null
    const galleryUrls: string[] = []

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      if (file.size > 0) {
        const res = await uploadImage(file)
        if (i === 0) {
          image = res.url
          imageId = res.publicId
        } else {
          galleryUrls.push(res.url)
        }
      }
    }

    const product = await db.product.create({
      data: {
        name, measure, price, salePrice, image, imageId, categoryId, isActive: true, stock,
        gallery: galleryUrls,
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

export async function updateProduct(id: string, formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const name = formData.get('name') as string
    const measure = formData.get('measure') as string
    const price = parseFloat(formData.get('price') as string)
    const categoryId = formData.get('categoryId') as string
    const stock = parseInt(formData.get('stock') as string) || 0
    const videoUrl = (formData.get('videoUrl') as string) || null

    const salePriceRaw = formData.get('salePrice') as string
    const salePrice = salePriceRaw ? parseFloat(salePriceRaw) : null

    const existingOrderedUrls = JSON.parse(formData.get('orderedUrls') as string || '[]') as string[]

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

    const oldProduct = await db.product.findUnique({ where: { id }, select: { image: true, imageId: true, gallery: true } })
    const oldUrls = [oldProduct?.image, ...(oldProduct?.gallery || [])].filter(Boolean) as string[]

    let finalImage = ''
    let finalImageId = null
    const finalGallery: string[] = []

    const newFiles = formData.getAll('images') as File[]
    let fileIndex = 0

    for (let i = 0; i < existingOrderedUrls.length; i++) {
      const url = existingOrderedUrls[i]
      if (url === 'NEW_FILE') {
        if (newFiles[fileIndex]) {
          const res = await uploadImage(newFiles[fileIndex])
          if (i === 0) {
            finalImage = res.url
            finalImageId = res.publicId
          } else {
            finalGallery.push(res.url)
          }
          fileIndex++
        }
      } else {
        if (i === 0) {
          finalImage = url
          finalImageId = oldProduct?.image === url ? oldProduct.imageId : null
        } else {
          finalGallery.push(url)
        }
      }
    }

    for (const oldUrl of oldUrls) {
      if (!existingOrderedUrls.includes(oldUrl)) {
        if (oldUrl === oldProduct?.image && oldProduct.imageId) {
          try { await deleteImage(oldProduct.imageId) } catch (e) {}
        }
      }
    }

    const currentVariants = await db.productVariant.findMany({ where: { productId: id } })
    for (const cv of currentVariants) {
      const stillExists = variants.find(v => v.imageId === cv.imageId)
      if (!stillExists && cv.imageId) {
        try { await deleteImage(cv.imageId) } catch (e) {}
      }
    }

    const product = await db.product.update({
      where: { id },
      data: {
        name, measure, price, salePrice, image: finalImage, imageId: finalImageId, categoryId, stock,
        gallery: finalGallery,
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

export async function uploadVariantImage(formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const imageFile = formData.get('image') as File
    if (!imageFile || imageFile.size === 0) return { success: false, error: 'No se proporcionó imagen' }
    const uploadResult = await uploadImage(imageFile)
    return { success: true, image: uploadResult.url, imageId: uploadResult.publicId }
  } catch (error) {
    return { success: false, error: 'Error al subir la imagen' }
  }
}

export async function deleteVariantImage(imageId: string) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    await deleteImage(imageId)
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Error al eliminar la imagen' }
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