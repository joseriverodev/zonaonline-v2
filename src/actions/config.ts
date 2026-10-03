'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { uploadImage } from '@/lib/cloudinary'
import { requireAuth } from '@/lib/auth-guard'

export async function getSiteConfig() {
  try {
    let config = await db.siteConfig.findFirst()
    if (!config) {
      config = await db.siteConfig.create({ data: { id: 1 } })
    }
    return config
  } catch (error) {
    return null
  }
}

export async function updateSiteConfig(formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const whatsapp = formData.get('whatsapp') as string
    const phoneCall = formData.get('phoneCall') as string
    const instagram = formData.get('instagram') as string
    const tiktok = formData.get('tiktok') as string

    await db.siteConfig.upsert({
      where: { id: 1 },
      update: { whatsapp, phoneCall, instagram, tiktok },
      create: { id: 1, whatsapp, phoneCall, instagram, tiktok }
    })

    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Error al actualizar configuración' }
  }
}

// ============ BANNERS ============

export async function getActiveBanners() {
  try {
    return await db.banner.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })
  } catch (error) {
    return []
  }
}

export async function getAllBanners() {
  try {
    return await db.banner.findMany({ orderBy: { order: 'asc' } })
  } catch (error) {
    return []
  }
}

export async function upsertBanner(formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const id = formData.get('id') as string | null

    const titleLine1 = (formData.get('titleLine1') as string) || null
    const titleLine2 = (formData.get('titleLine2') as string) || null
    const subtitle = (formData.get('subtitle') as string) || null
    const buttonText = (formData.get('buttonText') as string) || null
    const buttonLink = (formData.get('buttonLink') as string) || null
    const textPosition = (formData.get('textPosition') as string) || 'ml'
    const textColor = (formData.get('textColor') as string) || 'white'
    const textColor2 = (formData.get('textColor2') as string) || 'pink'
    const fontFamily = (formData.get('fontFamily') as string) || 'playfair'
    const overlayColor = (formData.get('overlayColor') as string) || 'black'
    const mobileImageFocus = (formData.get('mobileImageFocus') as string) || 'center'

    const rawOpacity = formData.get('overlayOpacity')
    const overlayOpacity = rawOpacity ? parseInt(rawOpacity.toString(), 10) : 0

    const imageFile = formData.get('image') as File | null
    const mobileImageFile = formData.get('mobileImage') as File | null

    let imageUrl = (formData.get('currentImage') as string) || ""
    let mobileImageUrl = (formData.get('currentMobileImage') as string) || null

    // Si es actualización, buscar imágenes actuales en BD si no vienen nuevas
    if (id) {
      const existingBanner = await db.banner.findUnique({ where: { id } })
      if (existingBanner) {
        if (!imageUrl) imageUrl = existingBanner.imageUrl
        if (!mobileImageUrl) mobileImageUrl = existingBanner.mobileImageUrl
      }
    }

    if (imageFile && imageFile.size > 0) {
      const res = await uploadImage(imageFile)
      imageUrl = res.url
    }

    if (mobileImageFile && mobileImageFile.size > 0) {
      const resMobile = await uploadImage(mobileImageFile)
      mobileImageUrl = resMobile.url
    }

    if (!imageUrl) return { success: false, error: 'La imagen principal es obligatoria' }

    const dataPayload = {
      titleLine1, titleLine2, subtitle, buttonText, buttonLink,
      textPosition, textColor, textColor2, fontFamily,
      overlayColor, overlayOpacity, mobileImageFocus,
      imageUrl, mobileImageUrl
    }

    if (id) {
      await db.banner.update({ where: { id }, data: dataPayload })
    } else {
      let order = 0
      try {
        const count = await db.banner.count()
        order = count
      } catch (e) {}
      await db.banner.create({ data: { ...dataPayload, order } })
    }

    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Error saving banner:', error)
    const errorMsg = error instanceof Error ? error.message : 'Error al guardar banner'
    return { success: false, error: errorMsg }
  }
}

export async function deleteBanner(id: string) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    await db.banner.delete({ where: { id } })
    revalidatePath('/')
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Error al eliminar banner' }
  }
}

// ============ COUPONS ============

export async function getCoupons() {
  try {
    return await db.coupon.findMany({ orderBy: { createdAt: 'desc' } })
  } catch (error) {
    return []
  }
}

export async function createCoupon(formData: FormData) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    const code = (formData.get('code') as string).toUpperCase().trim()
    const discountPercentage = parseFloat(formData.get('discountPercentage') as string)
    if (!code || isNaN(discountPercentage)) return { success: false, error: 'Datos inválidos' }

    await db.coupon.create({ data: { code, discountPercentage } })
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Error al crear cupón (quizás ya existe)' }
  }
}

export async function deleteCoupon(id: string) {
  const authed = await requireAuth()
  if (!authed) return { success: false, error: 'No autorizado' }

  try {
    await db.coupon.delete({ where: { id } })
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Error al eliminar' }
  }
}