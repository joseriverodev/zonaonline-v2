import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/products - Get all active products for public catalog
export async function GET() {
  try {
    const products = await db.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: true,
        variants: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json([], { status: 500 })
  }
}