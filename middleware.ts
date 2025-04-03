import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  try {
    // Crear cliente de Supabase para el middleware
    const res = NextResponse.next()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get: (name) => request.cookies.get(name)?.value,
          set: (name, value, options) => {
            res.cookies.set({ name, value, ...options })
          },
          remove: (name, options) => {
            res.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    // Verificar si hay una sesión
    const { data: { session } } = await supabase.auth.getSession()
    
    // URL actual y de login
    const path = request.nextUrl.pathname
    const isAuthRoute = path === '/login'

    // Si es una ruta de autenticación y el usuario está logueado, redirigir a la home
    if (isAuthRoute && session) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    // Si no es ruta de autenticación y el usuario no está logueado, redirigir al login
    if (!isAuthRoute && !session) {
      // Guardar la URL a la que intentaba acceder
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', encodeURIComponent(path))
      return NextResponse.redirect(loginUrl)
    }
    
    return res
  } catch (error) {
    console.error('Error en middleware:', error)
    // En caso de error, permitir el acceso pero redirigir a login en rutas protegidas
    if (request.nextUrl.pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }
}

// Especificar las rutas donde aplicar el middleware
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
