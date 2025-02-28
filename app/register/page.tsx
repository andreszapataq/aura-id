"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import LivenessDetection from '../../components/LivenessDetection'
import Image from 'next/image'

export default function Register() {
  const [name, setName] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [message, setMessage] = useState("")
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showFormGuide, setShowFormGuide] = useState(false)
  const [showLivenessDetection, setShowLivenessDetection] = useState(false)
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null)
  const [livenessStatus, setLivenessStatus] = useState<'none' | 'checking' | 'success' | 'failed'>('none')

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

  function handleLivenessSuccess(referenceImage: string, sessionId: string) {
    setCapturedImage(referenceImage)
    setLivenessSessionId(sessionId)
    setLivenessStatus('success')
    setShowLivenessDetection(false)
    setShowFormGuide(true)
    setMessage("Verificación exitosa. Por favor complete el formulario.")
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (!capturedImage) {
        throw new Error("No se ha capturado ninguna imagen")
      }

      if (!name.trim() || !employeeId.trim()) {
        throw new Error("Por favor, complete todos los campos")
      }

      // Verificamos si el ID ya existe
      const { data: existingEmployee } = await supabase
        .from("employees")
        .select("employee_id")
        .eq("employee_id", employeeId)
        .single();

      if (existingEmployee) {
        alert(`El ID de empleado ${employeeId} ya está registrado en el sistema. Por favor, utilice un ID diferente.`);
        return;
      }

      const indexResponse = await fetch('/api/index-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: capturedImage,
          employeeId: employeeId,
        }),
      });

      const indexData = await indexResponse.json();
      
      if (!indexResponse.ok) {
        if (indexResponse.status === 409) {
          alert(`No se puede completar el registro: ${indexData.details.message}`);
          return;
        }
        throw new Error(indexData.error || "Error en el registro");
      }

      if (!indexData.faceId) {
        throw new Error("No se recibió ID de rostro del servidor");
      }

      const employeeData = {
        name,
        employee_id: employeeId,
        face_data: indexData.faceId,
        liveness_session_id: livenessSessionId, // Guardar el ID de sesión de liveness
      };

      const { error: supabaseError } = await supabase
        .from("employees")
        .insert(employeeData);

      if (supabaseError) {
        if (supabaseError.code === '23505') {
          alert(`El ID de empleado ${employeeId} ya está en uso. Por favor, utilice un ID diferente.`);
          return;
        }
        throw new Error(supabaseError.message || "Error al guardar en la base de datos");
      }

      setMessage("¡Empleado registrado exitosamente!")
      // Resetear formulario
      setName("")
      setEmployeeId("")
      setCapturedImage(null)
      setLivenessSessionId(null)
      setLivenessStatus('none')
      setIsCameraActive(false)
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
    } catch (error) {
      console.error("Error al registrar empleado:", error)
      setMessage(
        error instanceof Error 
          ? `Error: ${error.message}` 
          : "Error al registrar empleado. Por favor, intente nuevamente."
      )
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Registro de Empleado</h1>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
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
                  className={`w-full font-bold py-2 px-4 rounded ${
                    capturedImage && name && employeeId
                      ? "bg-blue-500 hover:bg-blue-600 text-white"
                      : "bg-gray-300 cursor-not-allowed text-gray-500"
                  }`}
                  disabled={!capturedImage || !name || !employeeId}
                >
                  Registrar
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

            {message && (
              <div className={`mt-4 p-4 rounded-lg text-center ${
                message.includes("error") || message.includes("verifica")
                  ? "bg-red-100 text-red-800"
                  : "bg-green-100 text-green-800"
              }`}>
                {message}
              </div>
            )}

            {/* Indicador de estado de verificación de presencia */}
            {livenessStatus !== 'none' && (
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
    </div>
  )
}
