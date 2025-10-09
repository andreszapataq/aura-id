'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// Definir tipos de roles
export type UserRole = 'user' | 'admin' | 'kiosk'

// Definir tipo de perfil de usuario
export type UserProfile = {
  id: string
  email: string
  role: UserRole
  is_kiosk: boolean
  lock_session: boolean
  organization_id: string
  full_name: string | null
  created_at: string
}

// Definir el tipo para el contexto
type AuthContextType = {
  session: Session | null
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  isKiosk: boolean
  canLogout: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, fullName: string, organizationName: string) => Promise<{ error: AuthError | null, user: User | null, message?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

// Crear contexto con valores predeterminados
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  isKiosk: false,
  canLogout: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, user: null, message: undefined }),
  signOut: async () => {},
  refreshProfile: async () => {}
})

// Hook para usar el contexto de autenticación
export const useAuth = () => useContext(AuthContext)

// Proveedor del contexto
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [isKiosk, setIsKiosk] = useState<boolean>(false)
  const [canLogout, setCanLogout] = useState<boolean>(true)
  const router = useRouter()

  // Función para cargar el perfil del usuario
  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Error al cargar perfil de usuario:', error);
        return;
      }

      if (profile) {
        setUserProfile(profile as UserProfile);
        setIsAdmin(profile.role === 'admin');
        setIsKiosk(profile.is_kiosk === true);
        setCanLogout(!profile.lock_session);
        
        logger.log('Perfil de usuario cargado:', {
          role: profile.role,
          isKiosk: profile.is_kiosk,
          canLogout: !profile.lock_session
        });
      }
    } catch (error) {
      logger.error('Error inesperado al cargar perfil:', error);
    }
  };

  // Función para refrescar el perfil
  const refreshProfile = async () => {
    if (user?.id) {
      await loadUserProfile(user.id);
    }
  };

  // Cargar sesión de usuario al inicio y suscribirse a cambios
  useEffect(() => {
    setLoading(true); // Empieza cargando
    const getSessionAndSubscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      // Cargar perfil si hay usuario
      if (session?.user) {
        await loadUserProfile(session.user.id);
      }
      
      setLoading(false); // Termina la carga inicial

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Cargar perfil si hay usuario
          if (session?.user) {
            await loadUserProfile(session.user.id);
          } else {
            // Limpiar perfil si no hay usuario
            setUserProfile(null);
            setIsAdmin(false);
            setIsKiosk(false);
            setCanLogout(true);
          }
          
          setLoading(false); // Actualiza estado de carga en cambios
        }
      );

      // Limpiar suscripción al desmontar el componente
      return () => {
        subscription.unsubscribe();
      };
    }

    getSessionAndSubscribe();
  }, []) // Se ejecuta solo una vez al montar el componente

  // Función para iniciar sesión
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        logger.error('Error durante el inicio de sesión:', error);
        return { error };
      }
      // El listener onAuthStateChange actualizará el estado
      return { error: null };
    } catch (error) {
      logger.error('Excepción durante el inicio de sesión:', error);
      return { error: error instanceof AuthError ? error : new AuthError('Error desconocido') };
    } finally {
      setLoading(false);
    }
  };

  // Función para registrar un nuevo usuario
  const signUp = async (email: string, password: string, fullName: string, organizationName: string) => {
    setLoading(true);
    try {
      // Llamar a la API route de registro
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          organizationName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('Error durante el registro:', data.error);
        return { error: new AuthError(data.error || 'Error al crear el usuario'), user: null };
      }

      // Usuario creado exitosamente
      // Ya NO iniciamos sesión automáticamente porque requiere confirmación de email
      logger.log('Usuario creado exitosamente. Requiere confirmación de email.');
      
      return { 
        error: null, 
        user: data.user,
        message: data.message || 'Por favor, revisa tu correo electrónico para confirmar tu cuenta.'
      };

    } catch (error) {
      logger.error('Error inesperado durante el proceso de signUp:', error);
      return { error: new AuthError(error instanceof Error ? error.message : 'Error desconocido en el cliente'), user: null };
    } finally {
      setLoading(false);
    }
  };

  // Función para cerrar sesión
  const signOut = async () => {
    // Verificar si el usuario puede cerrar sesión
    if (!canLogout) {
      logger.warn('Intento de cerrar sesión bloqueado para usuario kiosco');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
         logger.error('Error durante el cierre de sesión:', error);
      } else {
          // Limpiar estado local
          setUserProfile(null);
          setIsAdmin(false);
          setIsKiosk(false);
          setCanLogout(true);
          
          // El listener onAuthStateChange actualizará session y user a null
          router.push('/login'); // Redirigir al login después de cerrar sesión
      }
    } catch (error) {
      logger.error('Excepción durante el cierre de sesión:', error);
    } finally {
       setLoading(false);
    }
  };

  // Valor proporcionado por el contexto
  const value = {
    session,
    user,
    userProfile,
    loading,
    isAdmin,
    isKiosk,
    canLogout,
    signIn,
    signUp, // Esta es la nueva función signUp que llama a la Edge Function
    signOut,
    refreshProfile
  };

  // Renderizar el proveedor con el valor y los componentes hijos
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 