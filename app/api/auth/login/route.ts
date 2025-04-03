import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Aquí normalmente verificarías las credenciales contra una base de datos
    // Este es un ejemplo simple que acepta un usuario fijo para demostración
    
    if (email === 'admin@aura-id.com' && password === 'admin123') {
      // Crear un token (en una aplicación real usarías JWT u otro método seguro)
      const token = 'ejemplo-token-seguro'
      
      // Establecer cookie de sesión
      const cookieStore = await cookies()
      cookieStore.set({
        name: 'auth-token',
        value: token,
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 semana
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      })
      
      return NextResponse.json({
        success: true,
        message: 'Inicio de sesión exitoso'
      })
    } else {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Error en inicio de sesión:', error)
    return NextResponse.json(
      { error: 'Error en el servidor' },
      { status: 500 }
    )
  }
}
