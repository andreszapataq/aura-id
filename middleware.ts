import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Lista de rutas públicas que no requieren autenticación
const publicPaths = ['/login', '/auth/callback', '/auth/handle-session', '/kiosk-login'];

// Rutas que solo pueden acceder administradores
const adminOnlyPaths = ['/register', '/reports', '/admin'];

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
    
    // Comprobar si la ruta actual es una de las públicas
    const isPublicPath = publicPaths.includes(path);

    // Si es una ruta pública (login) y el usuario está logueado, redirigir según el rol
    if (isPublicPath && path === '/login' && session) { 
      // Obtener perfil del usuario
      const { data: profile } = await supabase
        .from('users')
        .select('role, is_kiosk')
        .eq('id', session.user.id)
        .single();
      
      // Redirigir kiosco a /access, admin a /
      if (profile?.is_kiosk) {
        return NextResponse.redirect(new URL('/access', request.url))
      }
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    // Si NO es una ruta pública y el usuario NO está logueado, redirigir al login
    if (!isPublicPath && !session) { 
      const loginUrl = new URL('/login', request.url)
      // Mantener el parámetro redirect si ya existe, o usar el path actual
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      loginUrl.searchParams.set('redirect', redirectParam ? redirectParam : encodeURIComponent(path))
      return NextResponse.redirect(loginUrl)
    }
    
    // Si hay sesión, verificar permisos por rol
    if (session) {
      // Obtener perfil del usuario
      const { data: profile } = await supabase
        .from('users')
        .select('role, is_kiosk, lock_session')
        .eq('id', session.user.id)
        .single();
      
      // Si es usuario kiosk, SOLO permitir /access
      if (profile?.is_kiosk && path !== '/access') {
        console.log('[Middleware] Usuario kiosco intentando acceder a:', path, '- Redirigiendo a /access');
        return NextResponse.redirect(new URL('/access', request.url))
      }
      
      // Verificar rutas exclusivas de admin
      const isAdminOnlyPath = adminOnlyPaths.some(adminPath => path.startsWith(adminPath));
      if (isAdminOnlyPath && profile?.role !== 'admin') {
        console.log('[Middleware] Usuario sin permisos de admin intentando acceder a:', path);
        return NextResponse.redirect(new URL('/', request.url))
      }
      
      // Agregar headers con información del rol (para uso en componentes)
      res.headers.set('x-user-role', profile?.role || 'user');
      res.headers.set('x-is-kiosk', profile?.is_kiosk ? 'true' : 'false');
    }
    
    // Si es pública y no logueado, o si es protegida y logueado con permisos, deja pasar
    return res
  } catch (error) {
    // Solo logear errores en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error('[Middleware] Error:', error)
    }
    // En caso de error, intenta redirigir a login solo si no es ya una ruta pública
    if (!publicPaths.includes(request.nextUrl.pathname)) {
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
