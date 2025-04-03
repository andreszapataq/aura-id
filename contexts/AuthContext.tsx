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
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null, user: User | null }>
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
  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      })

      if (error) {
        return { error, user: null }
      }

      return { error: null, user: data.user }
    } catch (error) {
      console.error('Error durante el registro:', error)
      return { error: error as AuthError, user: null }
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