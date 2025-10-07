"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"

interface KioskInfo {
  id: string
  email: string
  createdAt: string
}

interface KioskCredentials {
  email: string
  password: string
}

export default function KioskManagement() {
  const { isAdmin, loading } = useAuth()
  const router = useRouter()
  const [kioskExists, setKioskExists] = useState(false)
  const [kioskInfo, setKioskInfo] = useState<KioskInfo | null>(null)
  const [credentials, setCredentials] = useState<KioskCredentials | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Redirigir si no es admin
  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/')
    }
  }, [isAdmin, loading, router])

  // Cargar estado del kiosco al montar
  useEffect(() => {
    if (isAdmin) {
      checkKioskStatus()
    }
  }, [isAdmin])

  const checkKioskStatus = async () => {
    try {
      const response = await fetch('/api/kiosk/status')
      const data = await response.json()

      if (response.ok) {
        setKioskExists(data.exists)
        setKioskInfo(data.kiosk)
      }
    } catch (error) {
      console.error('Error al verificar estado del kiosco:', error)
    }
  }

  const handleCreateKiosk = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setCredentials(null)

    try {
      const response = await fetch('/api/kiosk/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || data.error || 'Error al crear terminal kiosco')
        return
      }

      setSuccess('Terminal kiosco creada exitosamente')
      setCredentials(data.credentials)
      setKioskExists(true)
      await checkKioskStatus()
    } catch (error) {
      console.error('Error al crear kiosco:', error)
      setError('Error de conexión. Intente nuevamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!confirm('¿Está seguro de que desea resetear la contraseña del kiosco?')) {
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setCredentials(null)

    try {
      const response = await fetch('/api/kiosk/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || data.error || 'Error al resetear contraseña')
        return
      }

      setSuccess('Contraseña reseteada exitosamente')
      setCredentials(data.credentials)
    } catch (error) {
      console.error('Error al resetear contraseña:', error)
      setError('Error de conexión. Intente nuevamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setSuccess(`${field} copiado al portapapeles`)
    setTimeout(() => setSuccess(null), 2000)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 py-12 max-w-4xl"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-900">Gestión de Terminal Kiosco</h1>
        <p className="text-gray-600">
          Configure y administre la terminal kiosco para el control de acceso de empleados
        </p>
      </div>

      {/* Mensajes de error y éxito */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="alert alert-error mb-6"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="alert alert-success mb-6"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{success}</span>
        </motion.div>
      )}

      {/* Mostrar credenciales si están disponibles */}
      {credentials && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-amber-50 border-2 border-amber-200 mb-8"
        >
          <div className="flex items-start mb-4">
            <svg className="w-6 h-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-amber-900 mb-2">⚠️ Credenciales del Kiosco</h3>
              <p className="text-sm text-amber-800 mb-4">
                Guarde estas credenciales de forma segura. La contraseña no se podrá recuperar, solo resetear.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email del Kiosco</label>
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded border">
                <code className="text-sm text-gray-800">{credentials.email}</code>
                <button
                  onClick={() => copyToClipboard(credentials.email, 'Email')}
                  className="btn btn-sm btn-outline ml-2"
                >
                  Copiar
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded border">
                <code className="text-sm text-gray-800">
                  {showPassword ? credentials.password : '••••••••••••••••'}
                </code>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-sm btn-outline"
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(credentials.password, 'Contraseña')}
                    className="btn btn-sm btn-outline"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Estado del kiosco */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-6">Estado de la Terminal</h2>

        {kioskExists && kioskInfo ? (
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="bg-green-500 h-3 w-3 rounded-full mr-3 animate-pulse"></div>
              <div>
                <p className="font-medium text-green-900">Terminal Kiosco Activa</p>
                <p className="text-sm text-green-700">La terminal está configurada y lista para usar</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-medium text-gray-900">{kioskInfo.email}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Creada el</p>
                <p className="font-medium text-gray-900">
                  {new Date(kioskInfo.createdAt).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleResetPassword}
                disabled={isLoading}
                className="btn btn-outline w-full"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent"></div>
                    Reseteando...
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Resetear Contraseña
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="bg-gray-400 h-3 w-3 rounded-full mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">No hay terminal kiosco configurada</p>
                <p className="text-sm text-gray-600">Cree una terminal para habilitar el modo kiosco</p>
              </div>
            </div>

            <button
              onClick={handleCreateKiosk}
              disabled={isLoading}
              className="btn btn-primary w-full btn-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Creando Terminal...
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Crear Terminal Kiosco
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="card bg-blue-50 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">ℹ️ Instrucciones de Uso</h3>
        <div className="space-y-3 text-sm text-blue-800">
          <div className="flex">
            <span className="font-bold mr-2">1.</span>
            <p>Cree una terminal kiosco para su organización (solo puede haber una por organización)</p>
          </div>
          <div className="flex">
            <span className="font-bold mr-2">2.</span>
            <p>Guarde las credenciales generadas de forma segura</p>
          </div>
          <div className="flex">
            <span className="font-bold mr-2">3.</span>
            <p>Use las credenciales para iniciar sesión en la terminal kiosco</p>
          </div>
          <div className="flex">
            <span className="font-bold mr-2">4.</span>
            <p>La terminal kiosco solo tendrá acceso a la página de control de acceso</p>
          </div>
          <div className="flex">
            <span className="font-bold mr-2">5.</span>
            <p>El usuario kiosco NO podrá cerrar sesión ni acceder a otras páginas</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

