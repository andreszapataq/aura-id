"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"

export default function Login() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [passwordMatchError, setPasswordMatchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  
  // Obtener la URL de redirección de los parámetros de búsqueda
  const redirect = searchParams.get('redirect')
  
  // Usar el contexto de autenticación
  const { signIn, signUp, user } = useAuth()
  
  // Verificar si el usuario ya está autenticado
  useEffect(() => {
    if (user) {
      if (redirect) {
        router.push(decodeURIComponent(redirect))
      } else {
        router.push('/')
      }
    }
  }, [user, redirect, router])

  // Efecto para validar coincidencia de contraseñas en tiempo real
  useEffect(() => {
    if (isRegistering && password && confirmPassword && password !== confirmPassword) {
      setPasswordMatchError("Las contraseñas no coinciden.")
    } else {
      setPasswordMatchError(null)
    }
  }, [password, confirmPassword, isRegistering])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (isRegistering) {
        // Validar que las contraseñas coincidan
        if (password !== confirmPassword) {
          throw new Error("Las contraseñas no coinciden")
        }

        // Validar longitud de contraseña
        if (password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres")
        }

        // Registrar usuario
        const { error: signUpError } = await signUp(email, password, fullName, organizationName)

        if (signUpError) {
          throw new Error(signUpError.message || "Error al crear la cuenta")
        }

        setSuccess("¡Cuenta creada con éxito! Por favor, verifica tu correo electrónico para activar tu cuenta.")
        setIsRegistering(false)
        setPassword("")
        setConfirmPassword("")
        setFullName("")
        setOrganizationName("")
      } else {
        // Iniciar sesión
        const { error: signInError } = await signIn(email, password)

        if (signInError) {
          throw new Error(signInError.message || "Error al iniciar sesión")
        }

        // Si la autenticación es exitosa, el efecto se encargará de redirigir
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error en la operación")
    } finally {
      setLoading(false)
    }
  }

  // Cambiar entre inicio de sesión y registro
  const toggleMode = () => {
    setIsRegistering(!isRegistering)
    setError(null)
    setSuccess(null)
    setPassword("")
    setConfirmPassword("")
    setFullName("")
    setOrganizationName("")
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 py-12 flex justify-center items-center min-h-screen"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Image 
              src="/logo.svg" 
              alt="Aura ID Logo" 
              width={64} 
              height={64}
              className="mx-auto mb-4"
            />
          </Link>
          <h1 className="text-3xl font-bold mb-2">
            {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h1>
          <p className="text-gray-600">
            {isRegistering 
              ? 'Crea una cuenta para acceder al sistema' 
              : 'Accede al sistema de control de empleados'}
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-lg text-green-600">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="label">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input focus:shadow-blue-100"
                placeholder="ejemplo@correo.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input focus:shadow-blue-100"
                placeholder="Tu contraseña"
                required
              />
            </div>

            {isRegistering && (
              <>
                <div>
                  <label htmlFor="confirmPassword" className="label">
                    Confirmar Contraseña
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`input focus:shadow-blue-100 ${passwordMatchError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Confirma tu contraseña"
                    required
                  />
                  {passwordMatchError && (
                    <p className="mt-2 text-xs text-red-600">{passwordMatchError}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="fullName" className="label">
                    Nombre Completo
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input focus:shadow-blue-100"
                    placeholder="Tu nombre completo"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="organizationName" className="label">
                    Nombre de la Organización
                  </label>
                  <input
                    id="organizationName"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="input focus:shadow-blue-100"
                    placeholder="Nombre de tu empresa o equipo"
                    required
                  />
                </div>
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    {isRegistering ? 'Creando cuenta...' : 'Iniciando sesión...'}
                  </div>
                ) : isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={toggleMode} 
              className="text-[#014F59] hover:text-[#00BF71] text-sm font-medium"
            >
              {isRegistering 
                ? '¿Ya tienes una cuenta? Inicia sesión' 
                : '¿No tienes una cuenta? Regístrate'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
