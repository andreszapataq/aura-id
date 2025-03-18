"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

import LivenessDetection from "@/components/LivenessDetection"

export default function Register() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [livenessStatus, setLivenessStatus] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [registeredEmployee, setRegisteredEmployee] = useState<{ 
    name: string, 
    employeeId: string, 
    registeredAt: string 
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState(5)

  const handleLivenessSuccess = (referenceImage: string, sessionId: string) => {
    console.log("Verificación facial exitosa", { sessionId });
    setLivenessStatus(true)
    setImage(referenceImage)
  }

  const handleLivenessError = (error: Error) => {
    console.error("Error en verificación facial:", error);
    setErrorMessage(error.message || "Error en la verificación facial");
    setLivenessStatus(false);
  }

  const handleLivenessCancel = () => {
    console.log("Verificación facial cancelada");
    setLivenessStatus(false);
  }

  const resetForm = () => {
    setName("")
    setEmployeeId("")
    setImage(null)
    setLivenessStatus(false)
    setErrorMessage(null)
    setRegisteredEmployee(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      if (!livenessStatus || !image) {
        throw new Error("Debe completar la prueba de detección facial")
      }

      const response = await fetch("/api/index-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageData: image,
          employeeId,
          name,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al registrar empleado")
      }

      setRegisteredEmployee({
        name: data.name,
        employeeId: data.employeeId,
        registeredAt: data.registeredAt
      })

      // Iniciar el contador para redirección
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            router.push("/")
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      console.error("Error al registrar:", error)
      setErrorMessage(error instanceof Error ? error.message : "Error desconocido")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 py-12 max-w-7xl"
    >
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3 text-gray-900">Registro de Empleados</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Complete el formulario y realice la verificación facial para registrar un nuevo empleado en el sistema
        </p>
      </div>

      {registeredEmployee ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card text-center max-w-lg mx-auto"
        >
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¡Registro Exitoso!</h2>
          
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between text-left">
                <span className="text-gray-600">Empleado:</span>
                <span className="font-medium text-gray-900">{registeredEmployee.name}</span>
              </div>
              <div className="flex justify-between text-left">
                <span className="text-gray-600">ID:</span>
                <span className="font-medium text-gray-900">{registeredEmployee.employeeId}</span>
              </div>
              <div className="flex justify-between text-left">
                <span className="text-gray-600">Registrado:</span>
                <span className="font-medium text-gray-900">{new Date(registeredEmployee.registeredAt).toLocaleString('es-CO')}</span>
              </div>
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">
            El empleado ha sido registrado correctamente en el sistema y puede utilizar el sistema de control de acceso facial.
          </p>
          
          <div className="flex flex-col space-y-4">
            <p className="text-sm text-gray-500">
              Redirección en <span className="font-bold">{countdown}</span> segundos...
            </p>
            <div className="flex space-x-4 justify-center">
              <button 
                onClick={() => router.push("/")}
                className="btn btn-primary"
              >
                Ir al Inicio
              </button>
              <button 
                onClick={resetForm}
                className="btn btn-outline"
              >
                Registrar Otro Empleado
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="card h-full">
              <div className="flex flex-col h-full">
                <h2 className="text-xl font-semibold mb-6">Verificación Facial</h2>
                
                {errorMessage && (
                  <div className="alert alert-error mb-6">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{errorMessage}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col flex-grow items-center">
                  {livenessStatus ? (
                    <div className="space-y-6 w-full">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
                        <svg className="h-6 w-6 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-800">Verificación completada con éxito</span>
                      </div>
                      
                      {image && (
                        <div className="relative w-full aspect-[3/4] max-w-xs mx-auto overflow-hidden rounded-lg border border-gray-200">
                          <Image
                            src={image}
                            alt="Imagen capturada"
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => {
                          setLivenessStatus(false);
                          setImage(null);
                        }}
                        className="btn btn-outline w-full"
                      >
                        Realizar nueva captura
                      </button>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-blue-700">
                              Complete la verificación facial mirando a la cámara y siguiendo las instrucciones en pantalla.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <LivenessDetection 
                        onSuccess={handleLivenessSuccess}
                        onError={handleLivenessError}
                        onCancel={handleLivenessCancel}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="card h-fit">
            <h2 className="text-xl font-semibold mb-6">Información del Empleado</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="label">
                  Nombre Completo
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Ingrese nombre completo"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="employeeId" className="label">
                  ID de Empleado
                </label>
                <input
                  id="employeeId"
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="input"
                  placeholder="Ej: EMP001"
                  required
                />
              </div>
              
              <div className="pt-4">
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isLoading || !livenessStatus}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Registrando...
                    </div>
                  ) : 'Registrar Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  )
}
