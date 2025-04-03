import { createBrowserClient } from '@supabase/ssr'

// Crear cliente de Supabase para el navegador
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Función de ayuda para obtener la sesión del usuario
export const getUserSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Error al obtener la sesión:', error)
    return null
  }
  return data.session
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
