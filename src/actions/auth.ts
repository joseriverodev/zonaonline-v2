'use server'

import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const SESSION_DURATION_HOURS = 24

export async function login(password: string): Promise<{ success: boolean; error?: string }> {
  if (password !== ADMIN_PASSWORD) {
    return { success: false, error: 'Invalid password' }
  }

  // Generate session token
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000)

  // Store session in database
  await db.adminSession.create({
    data: {
      token,
      expiresAt,
    },
  })

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  })

  return { success: true }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value

  if (token) {
    // Delete session from database
    try {
      await db.adminSession.delete({
        where: { token },
      })
    } catch {
      // Session might not exist
    }
  }

  // Clear cookie
  cookieStore.delete('admin_session')
}

export async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value

  if (!token) {
    return false
  }

  // Check session in database
  const session = await db.adminSession.findUnique({
    where: { token },
  })

  if (!session || session.expiresAt < new Date()) {
    // Session expired or doesn't exist
    if (session) {
      try {
        await db.adminSession.delete({ where: { token } })
      } catch {
        // Ignore errors
      }
    }
    return false
  }

  return true
}
