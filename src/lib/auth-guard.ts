import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export async function requireAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value
  if (!token) return false

  const session = await db.adminSession.findUnique({
    where: { token },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      try { await db.adminSession.delete({ where: { token } }) } catch {}
    }
    return false
  }

  return true
}