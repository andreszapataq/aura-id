import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Obtener el token de autenticación de las cookies
  const authToken = request.cookies.get('auth-token')?.value
  
  // Verificar si el usuario está autenticado
  const isAuthenticated = !!authToken
  
  // Obtener la ruta actual
  const path = request.nextUrl.pathname
  
  // Si el usuario intenta acceder a la página de login estando ya autenticado
  // redirigir a la página principal
  if (path === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  // Si el usuario no está autenticado y trata de acceder a una ruta protegida
  // redirigir al login
  if (!isAuthenticated && path !== '/login') {
    // Guardar la URL a la que intentaba acceder para redirigir después del login
    const loginUrl = new URL('/login', request.url)
    
    // Pasar la URL original como parámetro de redirección
    loginUrl.searchParams.set('redirect', encodeURIComponent(path))
    
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

// Configuración de las rutas donde aplicar el middleware
export const config = {
  // Aplicar a todas las rutas excepto a activos estáticos y archivos de API específicos
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
