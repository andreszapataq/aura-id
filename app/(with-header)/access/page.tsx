"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import LivenessDetection from "@/components/LivenessDetection"
import { useAuth } from "@/contexts/AuthContext"

type AccessType = "check_in" | "check_out" | null

interface LastAccessLog {
  name: string;
  employeeId: string;
  timestamp: string;
  type: string;
}

export default function Access() {
  const { isKiosk } = useAuth()
  const [accessType, setAccessType] = useState<AccessType>(null)
  const [livenessStatus, setLivenessStatus] = useState<boolean>(false)
  const [image, setImage] = useState<string | null>(null)
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastAccessLogs, setLastAccessLogs] = useState<LastAccessLog[]>([])
  const [faceId, setFaceId] = useState<string | null>(null)
  const [isSearchingFace, setIsSearchingFace] = useState(false)

  useEffect(() => {
    // Iniciar la detección de presencia automáticamente
    startLivenessDetection();
    
    // Cargar últimos registros de acceso
    fetchLastAccessLogs();
  }, []);

  const fetchLastAccessLogs = async () => {
    try {
      const response = await fetch('/api/access/last-logs?limit=5');
      if (response.ok) {
        const data = await response.json();
        setLastAccessLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Error al cargar los últimos registros:", error);
    }
  };

  const startLivenessDetection = () => {
    setLivenessStatus(false);
    setImage(null);
    setLivenessSessionId(null);
    setMessage(null);
    setFaceId(null);
    setIsSearchingFace(false);
  };

  const handleLivenessSuccess = async (referenceImage: string, sessionId: string) => {
    // Verificar que la imagen sea válida
    if (!referenceImage || 
        referenceImage === 'data:image/jpeg;base64,undefined' || 
        referenceImage === 'data:image/jpeg;base64,') {
      setMessage({ 
        text: "Error: La imagen capturada no es válida. Por favor, intente nuevamente.", 
        isError: true 
      });
      return;
    }
    
    // Verificar formato de imagen
    if (!referenceImage.startsWith('data:image/jpeg;base64,') && 
        !referenceImage.startsWith('data:image/png;base64,')) {
      setMessage({ 
        text: "Error: El formato de la imagen no es válido.", 
        isError: true 
      });
      return;
    }
    
    // Verificar tamaño de imagen
    if (referenceImage.length < 1000) {
      setMessage({ 
        text: "Error: La imagen capturada es demasiado pequeña.", 
        isError: true 
      });
      return;
    }
    
    setLivenessStatus(true);
    setImage(referenceImage);
    setLivenessSessionId(sessionId);
    
    // Buscar el rostro en AWS Rekognition
    await searchEmployeeFace(referenceImage);
  };

  const searchEmployeeFace = async (imageData: string) => {
    setIsSearchingFace(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/search-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData }),
      });
      
      const data = await response.json();
      
      if (data.status === 'FACE_NOT_FOUND' || !data.faceId) {
        setMessage({
          text: 'Rostro no registrado. Por favor, contacte al administrador para registrarse en el sistema.',
          isError: true,
        });
        setFaceId(null);
        
        // En modo kiosco, reiniciar después de 8 segundos para que pueda leer el mensaje
        if (isKiosk) {
          setTimeout(() => {
            startLivenessDetection();
          }, 8000);
        }
        return;
      }
      
      // Rostro encontrado, obtener información del empleado
      setFaceId(data.faceId);
      
      // Intentar obtener el nombre del empleado
      try {
        const employeeResponse = await fetch(`/api/employees/${data.faceId}`);
        if (employeeResponse.ok) {
          const employeeData = await employeeResponse.json();
          setMessage({
            text: `✅ Bienvenido/a, ${employeeData.name}. Por favor, seleccione su acción:`,
            isError: false,
          });
        } else {
          setMessage({
            text: '✅ Rostro identificado. Por favor, seleccione su acción:',
            isError: false,
          });
        }
      } catch (error) {
        console.error('Error al obtener información del empleado:', error);
        setMessage({
          text: '✅ Rostro identificado. Por favor, seleccione su acción:',
          isError: false,
        });
      }
    } catch (error) {
      console.error('Error al buscar rostro:', error);
      setMessage({
        text: 'Error de conexión con el servidor. Por favor, inténtelo nuevamente más tarde.',
        isError: true,
      });
      
      // Reiniciar después de 5 segundos
      setTimeout(() => {
        startLivenessDetection();
      }, 5000);
    } finally {
      setIsSearchingFace(false);
    }
  };

  const handleLivenessError = (error: Error) => {
    console.error("Error en verificación facial:", error);
    
    // Verificar si es un error de TIMEOUT
    const errorMessage = error.message || '';
    if (errorMessage.includes('TIMEOUT') || errorMessage.includes('tiempo') || errorMessage.includes('Tiempo agotado')) {
      // No mostrar mensaje de error para TIMEOUT, ya que se reintenta automáticamente
      setMessage({ 
        text: '⏱️ Preparando nueva verificación. Por favor, espere...', 
        isError: false 
      });
      
      // El componente LivenessDetection se encargará de reintentar automáticamente
      return;
    }
    
    // Para otros errores, mostrar el mensaje
    setMessage({ text: `Error: ${errorMessage}`, isError: true });
    setLivenessStatus(false);
  };

  const handleLivenessCancel = () => {
    setLivenessStatus(false);
  };

  const generateWelcomeMessage = (name: string, type: string): string => {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour < 12) greeting = 'Buenos días';
    else if (hour < 18) greeting = 'Buenas tardes';
    else greeting = 'Buenas noches';
    
    if (type === 'check_in') {
      return `¡${greeting}, ${name}! Bienvenido/a.`;
    } else {
      return `¡${greeting}, ${name}! Que tengas un buen día.`;
    }
  };

  const registerAccess = async (type: AccessType) => {
    if (!livenessStatus || !image) {
      setMessage({ text: "Por favor, complete la verificación facial primero", isError: true });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    setAccessType(type);
    
    try {
      const response = await fetch("/api/access/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageData: image,
          type: type,
          sessionId: livenessSessionId,
        }),
      });
      
      // Comprobar si la respuesta es JSON antes de analizarla
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("La respuesta no es JSON:", await response.text());
        throw new Error("Error en el servidor: respuesta no válida");
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        // Manejo especial para errores de registro consecutivo
        if (data.error && (
            data.error.includes("No puede registrar entrada dos veces seguidas") || 
            data.error.includes("No puede registrar salida dos veces seguidas")
        )) {
          setMessage({ 
            text: data.error, 
            isError: true 
          });
          return; // Importante: no lanzar una excepción para este caso específico
        }
        
        throw new Error(data.error || "Error en el registro de acceso");
      }
      
      // Si hay un registro pendiente de cierre del día anterior, se habrá generado automáticamente
      if (data.autoCloseGenerated) {
        setMessage({ 
          text: "Se ha generado automáticamente un registro de salida para una entrada anterior sin salida registrada.", 
          isError: false 
        });
      }
      
      if (data.employee) {
        const welcomeMessage = generateWelcomeMessage(data.employee.name, type || 'check_in');
        setMessage({ text: welcomeMessage, isError: false });
        
        // Actualizar la lista de registros recientes
        fetchLastAccessLogs();
      } else {
        setMessage({ 
          text: "No se pudo identificar al empleado. Por favor, inténtelo nuevamente.", 
          isError: true 
        });
      }
      
      // Reiniciar para una nueva verificación después de 5 segundos
      setTimeout(() => {
        startLivenessDetection();
      }, 5000);
    } catch (error) {
      console.error("Error al registrar acceso:", error);
      setMessage({ 
        text: "Error de conexión con el servidor. Por favor, inténtelo nuevamente más tarde.", 
        isError: true 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={isKiosk ? "h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col" : "container mx-auto px-4 py-12 max-w-7xl"}
    >
      {/* Indicador de modo kiosco */}
      {isKiosk && (
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 shadow-md">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Aura ID</h2>
                <p className="text-xs text-white">Terminal Kiosco</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="text-xs text-white">{new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
          </div>
        </div>
      )}

      {!isKiosk && (
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900">Control de Acceso</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Registre su entrada y salida diaria a través del sistema de reconocimiento facial
          </p>
        </div>
      )}

      <div className={isKiosk ? "flex-grow flex items-center justify-center px-4" : "grid grid-cols-1 lg:grid-cols-3 gap-8"}>
        <div className={isKiosk ? "w-full max-w-4xl" : "lg:col-span-2"}>
          <div className={isKiosk ? "bg-white rounded-3xl shadow-2xl p-8 min-h-[600px] flex flex-col" : "card h-full"}>
            <div className="flex flex-col h-full">
              {!isKiosk && <h2 className="text-xl font-semibold mb-6">Verificación de Identidad</h2>}
              {isKiosk && <h2 className="text-3xl font-bold mb-2 text-center text-gray-800">Verificación Facial</h2>}
              {isKiosk && <p className="text-center text-gray-600 mb-8">Colóquese frente a la cámara para identificarse</p>}

              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-6 p-4 rounded-lg flex items-center ${
                    message.isError ? "alert alert-error" : "alert alert-success"
                  }`}
                >
                  <div className="flex items-center">
                    {message.isError ? (
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span>{message.text}</span>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col flex-grow justify-center items-center">
                {!livenessStatus ? (
                  <div className="w-full max-w-lg">
                    <LivenessDetection
                      onSuccess={handleLivenessSuccess}
                      onError={handleLivenessError}
                      onCancel={handleLivenessCancel}
                    />
                  </div>
                ) : isSearchingFace ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
                    <p className="text-lg font-medium text-gray-700">Identificando rostro...</p>
                    <p className="text-sm text-gray-500 mt-2">Por favor, espere un momento</p>
                  </div>
                ) : faceId ? (
                  <div className="flex flex-col items-center w-full">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn h-16 text-lg bg-green-500 text-white hover:bg-green-600 shadow-md border-0 relative overflow-hidden transition-all duration-300 group"
                        onClick={() => registerAccess("check_in")}
                        disabled={loading}
                      >
                        {loading && accessType === "check_in" ? (
                          <div className="flex items-center justify-center">
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            Procesando...
                          </div>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-green-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <div className="relative flex items-center justify-center">
                              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                              </svg>
                              Registrar Entrada
                            </div>
                          </>
                        )}
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn h-16 text-lg bg-red-500 text-white hover:bg-red-600 shadow-md border-0 relative overflow-hidden transition-all duration-300 group"
                        onClick={() => registerAccess("check_out")}
                        disabled={loading}
                      >
                        {loading && accessType === "check_out" ? (
                          <div className="flex items-center justify-center">
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            Procesando...
                          </div>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-red-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <div className="relative flex items-center justify-center">
                              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              Registrar Salida
                            </div>
                          </>
                        )}
                      </motion.button>
                    </div>
                    
                    {!loading && (
                      <button
                        className="btn btn-outline mt-6"
                        onClick={startLivenessDetection}
                      >
                        Reiniciar Verificación
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full max-w-md">
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
                      <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Rostro No Registrado</h3>
                      <p className="text-gray-700 mb-6">
                        Su rostro no se encuentra en el sistema. Por favor, contacte al administrador para registrarse.
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={startLivenessDetection}
                      >
                        Intentar con Otro Rostro
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Ocultar panel de últimos registros en modo kiosco */}
        {!isKiosk && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-6">Últimos Registros</h2>
            
            {lastAccessLogs.length > 0 ? (
            <div className="overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {lastAccessLogs.map((log, index) => (
                  <motion.li 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="py-4"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white ${
                          log.type === 'check_in' ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {log.type === 'check_in' ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {log.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {log.employeeId} · {new Date(log.timestamp).toLocaleString('es-CO', {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div>
                        <span className={`badge ${
                          log.type === 'check_in' ? 'badge-green' : 'badge-red'
                        }`}>
                          {log.type === 'check_in' ? 'Entrada' : 'Salida'}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No hay registros recientes</p>
            </div>
          )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
