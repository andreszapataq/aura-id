'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Definir el tipo para el contexto
type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, fullName: string, organizationName: string) => Promise<{ error: AuthError | null, user: User | null }>
  signOut: () => Promise<void>
}

// Crear contexto con valores predeterminados
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, user: null }),
  signOut: async () => {}
})

// Hook para usar el contexto de autenticación
export const useAuth = () => useContext(AuthContext)

// Proveedor del contexto
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const router = useRouter()

  // Cargar sesión de usuario al inicio
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user || null)
      setLoading(false)

      // Suscribirse a cambios en el estado de autenticación
      const { data: { subscription } } = await supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSession(session)
          setUser(session?.user || null)
          setLoading(false)
        }
      )

      return () => {
        subscription.unsubscribe()
      }
    }

    loadSession()
  }, [])

  // Función para iniciar sesión
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { error }
      }

      return { error: null }
    } catch (error) {
      console.error('Error durante el inicio de sesión:', error)
      return { error: error as AuthError }
    }
  }

  // Función para registrar un nuevo usuario
  const signUp = async (email: string, password: string, fullName: string, organizationName: string) => {
    try {
      // 1. Crear la organización
      const { data: organization, error: organizationError } = await supabase
        .from('organizations')
        .insert([{ name: organizationName, is_active: true }])
        .select()
        .single() // Asumimos que el nombre de la organización es único por ahora

      if (organizationError || !organization) {
        throw new Error(organizationError?.message || 'Error al crear la organización')
      }

      // 2. Crear el usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      })

      if (authError || !authData.user) {
        // Si falla la creación del usuario en Auth, intentar eliminar la organización creada
        await supabase.from('organizations').delete().eq('id', organization.id)
        throw new Error(authError?.message || 'Error al registrar el usuario en autenticación')
      }

      // 3. Crear el registro del usuario en la tabla 'users'
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id, // Usar el ID del usuario de Auth
          email: email,
          role: 'admin', // Asignar rol inicial, puede ser ajustado
          organization_id: organization.id
        }])

      if (userError) {
        // Si falla la creación en 'users', intentar eliminar el usuario de Auth y la organización
        // No intentar eliminar empleado ya que no se crea aquí
        await supabase.auth.admin.deleteUser(authData.user.id) // Requiere permisos de admin
        await supabase.from('organizations').delete().eq('id', organization.id)
        throw new Error(userError.message || 'Error al crear el registro del usuario')
      }
      
      // -- SECCIÓN ELIMINADA: Crear el registro del empleado en la tabla 'employees' --
      // El empleado se registrará a través de otra funcionalidad de la aplicación.

      // Si todo fue exitoso hasta aquí (Organización, Auth User, User)
      return { error: null, user: authData.user }

    } catch (error) {
      console.error('Error durante el registro completo:', error)
      return { error: error instanceof AuthError ? error : new AuthError(error instanceof Error ? error.message : 'Error desconocido'), user: null }
    }
  }

  // Función para cerrar sesión
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error durante el cierre de sesión:', error)
    }
  }

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 