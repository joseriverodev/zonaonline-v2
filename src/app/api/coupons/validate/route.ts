import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = (searchParams.get('code') || '').toUpperCase()
  if (!code) return NextResponse.json({ valid: false })

  try {
    const coupon = await db.coupon.findFirst({ where: { code, isActive: true } })
    if (coupon) return NextResponse.json({ valid: true, coupon })
    return NextResponse.json({ valid: false })
  } catch (error) {
    return NextResponse.json({ valid: false })
  }
}