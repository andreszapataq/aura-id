'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// Placeholder para un componente Spinner/Loader visualmente más atractivo
// Si usas Shadcn/ui, podrías importar y usar <Spinner /> o similar aquí.
const Loader = () => (
  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
);

export default function HandleSessionPage() {
  const router = useRouter()
  // Necesitamos crear un cliente Supabase aquí en el cliente
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const hash = window.location.hash.substring(1) // Quita el # inicial
    console.log('[Handle Session Client] Hash detected:', hash);

    if (hash) {
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      // No necesitamos expiresIn ni tokenType para setSession
      // const expiresIn = params.get('expires_in') 
      // const tokenType = params.get('token_type')

      console.log('[Handle Session Client] Parsed tokens:', { 
        accessToken: accessToken ? 'present' : 'null', 
        refreshToken: refreshToken ? 'present' : 'null' 
      });

      if (accessToken && refreshToken) {
        console.log('[Handle Session Client] Setting session...');
        // Establecer la sesión en el cliente Supabase
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error }) => {
          if (error) {
            console.error('[Handle Session Client] Error setting session:', error)
            // Redirigir a login si falla el setSession
            router.push('/login?error=session_set_failed')
          } else {
            console.log('[Handle Session Client] Session set successfully. Redirecting to /');
            // Limpiar el hash de la URL por estética y seguridad
            window.location.hash = ''
            // Redirigir a la página principal
            // Usamos replace para no guardar esta página intermedia en el historial
            router.replace('/') 
          }
        })
      } else {
        console.error('[Handle Session Client] Tokens not found in hash. Redirecting to login.');
        router.push('/login?error=tokens_not_found')
      }
    } else {
      // Si no hay hash, algo fue mal, redirigir a login
      console.warn('[Handle Session Client] No hash found. Redirecting to login.');
      router.push('/login?error=no_hash')
    }

    // El effect solo debe correr una vez al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Dependencias vacías para ejecutar solo al montar

  // Contenedor principal para centrar el contenido
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Loader />
      <p className="mt-4 text-lg text-gray-700">Procesando autenticación...</p>
    </div>
  );
} 