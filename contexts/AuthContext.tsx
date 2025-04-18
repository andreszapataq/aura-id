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

  // Cargar sesión de usuario al inicio y suscribirse a cambios
  useEffect(() => {
    setLoading(true); // Empieza cargando
    const getSessionAndSubscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Termina la carga inicial

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
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
        console.error('Error durante el inicio de sesión:', error);
        return { error };
      }
      // El listener onAuthStateChange actualizará el estado
      return { error: null };
    } catch (error) {
      console.error('Excepción durante el inicio de sesión:', error);
      return { error: error instanceof AuthError ? error : new AuthError('Error desconocido') };
    } finally {
      setLoading(false);
    }
  };

  // Función para registrar un nuevo usuario (LLAMA A LA EDGE FUNCTION)
  const signUp = async (email: string, password: string, fullName: string, organizationName: string) => {
    setLoading(true); // Indicar que algo está cargando
    try {
      // 1. Invocar la Edge Function 'create-user-and-org'
      const { data, error: functionError } = await supabase.functions.invoke('create-user-and-org', {
        // Pasamos los datos necesarios en el cuerpo de la solicitud
        body: { email, password, fullName, organizationName },
      });

      // 2. Manejar errores de la invocación o errores devueltos por la función
      if (functionError) {
        console.error('Error al invocar la Edge Function:', functionError);
        // Intenta obtener un mensaje de error más específico si la función lo envió en 'data.error'
        const errorMessage = data?.error || functionError.message || 'Ocurrió un error durante el registro.';
        // Devuelve un objeto compatible con tu tipo de retorno esperado
        return { error: new AuthError(errorMessage), user: null };
      }

      // 3. Éxito (la función se ejecutó sin errores)
      // La Edge Function ya creó la organización, el usuario en Auth y el perfil en la tabla 'users'.
      // No necesitamos devolver el 'user' aquí directamente.
      // El listener onAuthStateChange detectará automáticamente el estado
      // cuando el usuario inicie sesión por primera vez (después de confirmar el email, si aplica).

      // Opcional: Puedes mostrar un mensaje de éxito al usuario.
      // console.log('Registro iniciado. Revisa tu email para confirmar.');
      // alert('¡Registro exitoso! Revisa tu correo para confirmar (si es necesario) e inicia sesión.');

      // Devolvemos éxito. El estado de 'user' y 'session' se actualizará a través del listener.
      return { error: null, user: null };

    } catch (error) {
      // Capturar errores inesperados (ej. problemas de red al llamar la función)
      console.error('Error inesperado durante el proceso de signUp:', error);
      return { error: new AuthError(error instanceof Error ? error.message : 'Error desconocido en el cliente'), user: null };
    } finally {
       setLoading(false); // Quitar el estado de carga
    }
  };

  // Función para cerrar sesión
  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
         console.error('Error durante el cierre de sesión:', error);
      } else {
          // El listener onAuthStateChange actualizará session y user a null
          router.push('/login'); // Redirigir al login después de cerrar sesión
      }
    } catch (error) {
      console.error('Excepción durante el cierre de sesión:', error);
    } finally {
       setLoading(false);
    }
  };

  // Valor proporcionado por el contexto
  const value = {
    session,
    user,
    loading,
    signIn,
    signUp, // Esta es la nueva función signUp que llama a la Edge Function
    signOut
  };

  // Renderizar el proveedor con el valor y los componentes hijos
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 