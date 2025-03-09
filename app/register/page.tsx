"use client"

import { useState, useRef } from "react"
import LivenessDetection from '@/components/LivenessDetection'
import Image from 'next/image'
import { useRouter } from "next/navigation"

export default function Register() {
  const [name, setName] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [message, setMessage] = useState("")
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showFormGuide, setShowFormGuide] = useState(false)
  const [showLivenessDetection, setShowLivenessDetection] = useState(false)
  const [livenessStatus, setLivenessStatus] = useState<'none' | 'checking' | 'success' | 'failed'>('none')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [registeredEmployee, setRegisteredEmployee] = useState<{name: string, id: string, registeredAt: string, snapshotUrl?: string} | null>(null)
  const [isOrphanFace, setIsOrphanFace] = useState(false)

  async function startVideo() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setIsCameraActive(true)
          setMessage("") // Limpiar mensajes previos
          setCapturedImage(null) // Resetear imagen capturada al iniciar cámara
        }
      }
    } catch (error) {
      console.error("Error al iniciar la cámara:", error)
      setMessage("No se pudo acceder a la cámara. Por favor, verifica los permisos.")
      setIsCameraActive(false)
    }
  }

  function startLivenessDetection() {
    if (isCameraActive && videoRef.current?.srcObject) {
      // Detener la cámara actual antes de iniciar la detección de presencia
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
    }
    
    setShowLivenessDetection(true)
    setLivenessStatus('checking')
  }

  function handleLivenessSuccess(referenceImage: string) {
    console.log("Verificación exitosa con imagen:", referenceImage.substring(0, 50) + "...");
    
    // Verificar que la imagen sea válida
    if (!referenceImage || referenceImage === 'data:image/jpeg;base64,undefined' || referenceImage === 'data:image/jpeg;base64,') {
      console.error("Imagen de referencia inválida recibida en el registro");
      setMessage("Error: La imagen capturada no es válida. Por favor, intente nuevamente.");
      setLivenessStatus('failed');
      return;
    }
    
    // Verificar que la imagen tenga un formato válido
    if (!referenceImage.startsWith('data:image/jpeg;base64,') && !referenceImage.startsWith('data:image/png;base64,')) {
      console.error("Formato de imagen no válido:", referenceImage.substring(0, 30));
      setMessage("Error: El formato de la imagen no es válido. Por favor, intente nuevamente.");
      setLivenessStatus('failed');
      return;
    }
    
    // Verificar que la imagen tenga un tamaño razonable
    if (referenceImage.length < 1000) {
      console.error("Imagen demasiado pequeña:", referenceImage.length, "bytes");
      setMessage("Error: La imagen capturada es demasiado pequeña. Por favor, intente nuevamente.");
      setLivenessStatus('failed');
      return;
    }
    
    console.log("Imagen válida recibida, tamaño:", referenceImage.length, "bytes");
    setCapturedImage(referenceImage);
    setLivenessStatus('success');
    setShowLivenessDetection(false);
    setShowFormGuide(true);
  }

  function handleLivenessError(error: Error) {
    console.error("Error en verificación de presencia:", error)
    setLivenessStatus('failed')
    setShowLivenessDetection(false)
    setMessage(`Error: ${error.message}`)
  }

  function handleLivenessCancel() {
    setShowLivenessDetection(false)
    setLivenessStatus('none')
    // Reiniciar la cámara normal
    startVideo()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess(false)

    // Validar todos los campos requeridos
    if (!capturedImage) {
      setError("Por favor, complete la verificación de identidad primero")
      setIsLoading(false)
      return
    }

    if (!name.trim()) {
      setError("Por favor, ingrese el nombre del empleado")
      setIsLoading(false)
      return
    }

    if (!employeeId.trim()) {
      setError("Por favor, ingrese el ID del empleado")
      setIsLoading(false)
      return
    }

    try {
      const requestData = {
        imageData: capturedImage,
        employeeId: employeeId.trim(),
        name: name.trim(),
      };
      
      console.log("Enviando datos para registro:", {
        hasImageData: !!capturedImage,
        imageDataLength: capturedImage ? capturedImage.length : 0,
        employeeId,
        name
      });
      
      const response = await fetch("/api/index-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json()

      if (!response.ok) {
        // Manejar específicamente el error de rostro ya registrado
        if (response.status === 409) {
          if (data.employeeData) {
            const similarityText = data.similarity ? ` (Similitud: ${Math.round(data.similarity)}%)` : '';
            setError(`Este rostro ya está registrado como ${data.employeeData.name} (ID: ${data.employeeData.employee_id})${similarityText}`);
            
            // Mostrar un mensaje más detallado con la información del empleado existente
            setRegisteredEmployee({
              name: data.employeeData.name,
              id: data.employeeData.employee_id,
              registeredAt: new Date(data.employeeData.created_at || new Date()).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }),
              snapshotUrl: data.employeeData.snapshot_url || null
            });
          } else if (data.isOrphan) {
            // Caso especial: rostro huérfano detectado (existe en AWS pero no en la base de datos)
            setError(`Se detectó un rostro en AWS Rekognition, pero no hay empleados registrados en la base de datos. Esto indica una desincronización. Se recomienda limpiar la colección.`);
            setIsOrphanFace(true);
          } else if (data.similarity) {
            // Si solo tenemos información de similitud (sin empleado asociado)
            setError(`Se detectó un rostro muy similar en el sistema (Similitud: ${Math.round(data.similarity)}%). No se permite el registro para evitar duplicados.`);
          } else {
            setError(`Error: ${data.message || 'Este rostro ya está registrado en el sistema'}`);
          }
          setIsLoading(false);
          return;
        }
        
        // Manejar otros tipos de errores
        const errorMessage = data.message || data.error || "Error al registrar empleado";
        const errorDetails = data.details ? ` (${JSON.stringify(data.details)})` : '';
        console.error(`Error en la respuesta (${response.status}):`, errorMessage, data);
        
        // Guardar los datos de la respuesta para depuración
        const debugInfo = JSON.stringify(data, null, 2);
        console.log("Datos completos de la respuesta:", debugInfo);
        
        // Mostrar mensaje de error específico según el código de estado
        if (response.status === 400) {
          setError(`Error en los datos enviados: ${errorMessage}`);
        } else if (response.status === 500) {
          setError(`Error en el servidor: ${errorMessage}`);
        } else {
          setError(`Error (${response.status}): ${errorMessage}${errorDetails}`);
        }
        
        setIsLoading(false)
        return
      }

      // Registro exitoso
      setSuccess(true)
      const registrationDate = new Date(data.employee?.registeredAt || new Date()).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      setRegisteredEmployee({
        name: data.employee?.name || name,
        id: data.employee?.id || employeeId,
        registeredAt: registrationDate,
        snapshotUrl: data.employee?.snapshotUrl || null
      });
      
      // Iniciar cuenta regresiva para redirección
      let secondsLeft = 5
      setCountdown(secondsLeft)
      
      const countdownInterval = setInterval(() => {
        secondsLeft -= 1
        setCountdown(secondsLeft)
        
        if (secondsLeft <= 0) {
          clearInterval(countdownInterval)
          router.push("/")
        }
      }, 1000)
      
    } catch (error) {
      console.error("Error al registrar:", error)
      setError(error instanceof Error ? error.message : "Error desconocido al registrar empleado")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Registro de Empleado</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex flex-col">
            <div className="font-bold mb-1">Error al registrar empleado</div>
            <p>{error}</p>
            {registeredEmployee && (
              <div className="mt-3 p-3 bg-white rounded border border-red-200">
                <h3 className="font-bold text-red-800 mb-2">Información del empleado existente:</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-semibold">Nombre:</div>
                  <div>{registeredEmployee.name}</div>
                  <div className="font-semibold">ID:</div>
                  <div>{registeredEmployee.id}</div>
                  <div className="font-semibold">Registrado el:</div>
                  <div>{registeredEmployee.registeredAt}</div>
                </div>
              </div>
            )}
            
            {isOrphanFace && (
              <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                <h3 className="font-bold text-blue-800 mb-2">Rostro huérfano detectado</h3>
                <p className="text-sm text-blue-700 mb-2">
                  Se ha detectado un rostro en AWS Rekognition que no tiene correspondencia en la base de datos.
                  Esto suele ocurrir cuando:
                </p>
                <ul className="list-disc list-inside text-sm text-blue-700 mb-3 pl-2">
                  <li>Se han eliminado registros de la base de datos pero no de AWS</li>
                  <li>Se han realizado pruebas previas sin completar el registro</li>
                  <li>Ha ocurrido un error de sincronización entre sistemas</li>
                </ul>
                <p className="text-sm text-blue-700 mb-3">
                  Se recomienda limpiar la colección de rostros para resolver este problema.
                </p>
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    setError("Limpiando colección de rostros...");
                    
                    try {
                      // Verificar si existe la clave ADMIN_API_KEY en localStorage
                      const adminKey = localStorage.getItem('ADMIN_API_KEY') || 'admin-key';
                      
                      const response = await fetch(`/api/clean-collection?key=${adminKey}`);
                      const data = await response.json();
                      
                      if (!response.ok) {
                        setError(`Error al limpiar colección: ${data.message || "Error desconocido"}`);
                        setIsLoading(false);
                        return;
                      }
                      
                      setError("Colección limpiada exitosamente. Intente registrar nuevamente.");
                      setIsLoading(false);
                      setIsOrphanFace(false);
                    } catch (error) {
                      setError(`Error al limpiar colección: ${error instanceof Error ? error.message : "Error desconocido"}`);
                      setIsLoading(false);
                    }
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded text-sm font-medium w-full"
                >
                  Limpiar colección de rostros
                </button>
              </div>
            )}
            
            {error.includes("rostro similar") && !isOrphanFace && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
                <p className="text-yellow-800 font-medium mb-2">¿Cree que esto es un error?</p>
                <p className="text-sm text-yellow-700 mb-3">
                  Si está seguro de que este rostro no está registrado y desea forzar el registro, puede usar el siguiente botón:
                </p>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      setError("Intentando forzar el registro...");
                      
                      try {
                        const requestData = {
                          imageData: capturedImage,
                          employeeId: employeeId.trim(),
                          name: name.trim(),
                        };
                        
                        const response = await fetch("/api/index-face?force=true", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify(requestData),
                        });
                        
                        const data = await response.json();
                        
                        if (!response.ok) {
                          setError(`Error al forzar registro: ${data.message || "Error desconocido"}`);
                          setIsLoading(false);
                          return;
                        }
                        
                        // Registro exitoso
                        setSuccess(true);
                        setError("");
                        const registrationDate = new Date(data.employee?.registeredAt || new Date()).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        
                        setRegisteredEmployee({
                          name: data.employee?.name || name,
                          id: data.employee?.id || employeeId,
                          registeredAt: registrationDate,
                          snapshotUrl: data.employee?.snapshotUrl || null
                        });
                        
                        // Iniciar cuenta regresiva
                        let count = 5;
                        setCountdown(count);
                        const timer = setInterval(() => {
                          count--;
                          setCountdown(count);
                          if (count <= 0) {
                            clearInterval(timer);
                            router.push("/");
                          }
                        }, 1000);
                      } catch (error) {
                        setError(`Error inesperado: ${error instanceof Error ? error.message : "Error desconocido"}`);
                        setIsLoading(false);
                      }
                    }}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded text-sm font-medium"
                  >
                    Forzar registro (use con precaución)
                  </button>
                  
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      setError("Limpiando colección de rostros...");
                      
                      try {
                        // Verificar si existe la clave ADMIN_API_KEY en localStorage
                        const adminKey = localStorage.getItem('ADMIN_API_KEY') || 'admin-key';
                        
                        const response = await fetch(`/api/clean-collection?key=${adminKey}`);
                        const data = await response.json();
                        
                        if (!response.ok) {
                          setError(`Error al limpiar colección: ${data.message || "Error desconocido"}`);
                          setIsLoading(false);
                          return;
                        }
                        
                        setError("Colección limpiada exitosamente. Intente registrar nuevamente.");
                        setIsLoading(false);
                      } catch (error) {
                        setError(`Error al limpiar colección: ${error instanceof Error ? error.message : "Error desconocido"}`);
                        setIsLoading(false);
                      }
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded text-sm font-medium"
                  >
                    Limpiar colección de rostros
                  </button>
                </div>
                <p className="text-xs text-yellow-600 mt-2">
                  Nota: La limpieza de la colección eliminará todos los rostros registrados en AWS Rekognition. Use solo si está seguro de que no hay empleados registrados en la base de datos.
                </p>
              </div>
            )}
            
            <button 
              onClick={() => {
                setError("");
                setRegisteredEmployee(null);
                setIsOrphanFace(false);
              }}
              className="mt-2 bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm self-end"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      
      {success && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="text-center">
              <div className="bg-green-100 p-3 rounded-full inline-flex mb-4">
                <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Registro Exitoso!</h2>
              <p className="text-gray-600 mb-6">
                El empleado ha sido registrado correctamente en el sistema.
              </p>
              
              {registeredEmployee && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div className="font-semibold text-left">Nombre:</div>
                    <div className="text-left">{registeredEmployee.name}</div>
                    <div className="font-semibold text-left">ID:</div>
                    <div className="text-left">{registeredEmployee.id}</div>
                    <div className="font-semibold text-left">Registrado el:</div>
                    <div className="text-left">{registeredEmployee.registeredAt}</div>
                  </div>
                  
                  {registeredEmployee.snapshotUrl && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Imagen de registro:</p>
                      <div className="relative rounded overflow-hidden">
                        <Image 
                          src={registeredEmployee.snapshotUrl} 
                          alt="Imagen de registro" 
                          width={300}
                          height={300}
                          className="mx-auto object-cover"
                          unoptimized={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <p className="text-sm text-gray-500 mb-4">
                Redirigiendo a la página principal en <span className="font-bold">{countdown}</span> segundos...
              </p>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                Ir a la página principal
              </button>
            </div>
          </div>
        </div>
      )}
      
      {!success && (
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md mx-auto">
          {showLivenessDetection ? (
            <LivenessDetection
              onSuccess={handleLivenessSuccess}
              onError={handleLivenessError}
              onCancel={handleLivenessCancel}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className={`space-y-4 ${showFormGuide && !name ? 'animate-pulse' : ''}`}>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (showFormGuide) setShowFormGuide(false)
                  }}
                  className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                    showFormGuide && !name ? 'border-blue-500 ring-2 ring-blue-200' : ''
                  }`}
                  required
                />
              </div>
              <div className={`space-y-4 ${showFormGuide && name && !employeeId ? 'animate-pulse' : ''}`}>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  ID de Empleado
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value)
                    if (showFormGuide) setShowFormGuide(false)
                  }}
                  className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                    showFormGuide && name && !employeeId ? 'border-blue-500 ring-2 ring-blue-200' : ''
                  }`}
                  required
                />
              </div>
              
              {!capturedImage && (
                <>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={startLivenessDetection}
                      className="w-full font-bold py-2 px-4 rounded bg-green-500 hover:bg-green-600 text-white"
                    >
                      Verificar Presencia
                    </button>
                  </div>
                  <div className="text-center mt-2 text-sm text-gray-600">
                    Haga clic en el botón para iniciar la verificación de presencia
                  </div>
                </>
              )}
              
              {capturedImage && (
                <>
                  <div className="mt-4">
                    <div className="text-center mb-2 text-gray-600">Imagen capturada:</div>
                    <div className="relative rounded-lg overflow-hidden">
                      <Image 
                        src={capturedImage} 
                        alt="Imagen capturada" 
                        className="w-full h-auto rounded-lg"
                        width={400}
                        height={300}
                        unoptimized={true}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || livenessStatus !== 'success'}
                    className={`w-full py-2 px-4 rounded ${
                      isLoading || livenessStatus !== 'success'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                    } text-white`}
                  >
                    {isLoading ? 'Registrando...' : 'Registrar Empleado'}
                  </button>
                </>
              )}
              
              {capturedImage && showFormGuide && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <div className="text-center text-green-600 font-semibold mb-2">
                    ✓ Verificación de presencia exitosa
                  </div>
                  <div className="text-sm text-gray-600">
                    <p className="font-medium mb-2">Próximos pasos:</p>
                    {(!name || !employeeId) && (
                      <p>Complete los campos: {[
                        !name && "Nombre Completo",
                        !employeeId && "ID del Empleado"
                      ].filter(Boolean).join(" y ")}</p>
                    )}
                    {name && employeeId && (
                      <p>Haga clic en &quot;Registrar&quot; para completar el proceso</p>
                    )}
                  </div>
                </div>
              )}

              {message && !showFormGuide && (
                <div className={`mt-4 p-4 rounded-lg text-center ${
                  message.includes("error") || message.includes("verifica")
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}>
                  {message}
                </div>
              )}

              {livenessStatus !== 'none' && !capturedImage && (
                <div className={`mt-4 p-3 rounded-lg flex items-center ${
                  livenessStatus === 'checking' ? 'bg-yellow-50 text-yellow-700' :
                  livenessStatus === 'success' ? 'bg-green-50 text-green-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  {livenessStatus === 'checking' && (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-yellow-500 rounded-full border-t-transparent mr-2"></div>
                      <span>Verificando presencia...</span>
                    </>
                  )}
                  {livenessStatus === 'success' && (
                    <>
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>Verificación exitosa</span>
                    </>
                  )}
                  {livenessStatus === 'failed' && (
                    <>
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                      <span>Verificación fallida</span>
                    </>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  )
}
