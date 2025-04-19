import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Este Route Handler AHORA solo redirige al manejador del lado del cliente
// que puede leer el fragmento hash (#access_token=...)
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  // Redirige inmediatamente a una página del lado del cliente
  // Pasa la URL original (incluyendo el hash) como parámetro si es necesario,
  // aunque la página cliente puede leer window.location.hash directamente.
  console.log('[Auth Callback Server] Redirigiendo a /auth/handle-session');
  return NextResponse.redirect(`${origin}/auth/handle-session`)
}
