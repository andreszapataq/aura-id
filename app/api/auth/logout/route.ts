import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  // Eliminar la cookie de autenticación
  const cookieStore = await cookies()
  cookieStore.delete('auth-token')
  
  return NextResponse.json({
    success: true,
    message: 'Sesión cerrada correctamente'
  })
}
