import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    let config = await db.siteConfig.findFirst()
    if (!config) {
      config = await db.siteConfig.create({ data: { id: 1 } })
    }
    return NextResponse.json(config)
  } catch (error) {
    return NextResponse.json({
      whatsapp: "000000000000",
      heroTitle: "Welcome to our store",
      heroSubtitle: "Browse our catalog and order via WhatsApp",
      heroImage: "/hero-banner.png"
    })
  }
}