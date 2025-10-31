import { createBrowserClient } from '@supabase/ssr'

// Crear cliente de Supabase para el navegador
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Función de ayuda para obtener la sesión del usuario
export const getUserSession = async () => {
  // Consultar al servidor para autenticar el usuario actual
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error al obtener el usuario:', error)
    return null
  }
  // Mantener interfaz similar (session-like) para no romper llamadas existentes
  return data.user ? ({ user: data.user } as unknown as { user: unknown }) : null
}

// Función para obtener el usuario actual
export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error al obtener el usuario:', error)
    return null
  }
  return data.user
}
