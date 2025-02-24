"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import FaceGuide from '../components/FaceGuide'

export default function Access() {
  const [message, setMessage] = useState("")
  const [isCameraActive, setIsCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  async function startVideo() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setIsCameraActive(true)
          setMessage("") // Limpiar mensajes previos
        }
      }
    } catch (error) {
      console.error("Error al iniciar la cámara:", error)
      setMessage("No se pudo acceder a la cámara. Por favor, verifica los permisos.")
      setIsCameraActive(false)
    }
  }

  async function handleAccess(type: "check_in" | "check_out") {
    if (!isCameraActive) {
      setMessage("Por favor, activa la cámara primero")
      return
    }

    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const imageData = canvas.toDataURL()

      try {
        const searchResponse = await fetch('/api/search-face', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData }),
        });

        const searchData = await searchResponse.json();

        if (!searchResponse.ok) {
          throw new Error(searchData.error || 'Failed to search face');
        }

        if (searchData.status === 'FACE_NOT_FOUND') {
          setMessage("No estás registrado en el sistema. Por favor, contacta a RRHH para registrarte.");
          return;
        }

        if (searchData.faceId) {
          const { data: employees, error } = await supabase
            .from("employees")
            .select("*")
            .eq("face_data", searchData.faceId)
            .maybeSingle()

          if (error) {
            if (!error.message.includes('no rows')) {
              throw error;
            }
            setMessage("Tu rostro fue reconocido pero no se encontraron tus datos en el sistema. Por favor, contacta a un administrador.");
            return;
          }

          if (!employees) {
            setMessage("No se encontraron tus datos en el sistema. Por favor, contacta a un administrador.");
            return;
          }

          const now = new Date()
          const { error: logError } = await supabase
            .from("access_logs")
            .insert({
              employee_id: employees.id,
              timestamp: now.toISOString(),
              type: type,
            })

          if (logError) throw logError

          const messages = {
            "check_in": [
              "¡Que tengas un excelente día!",
              "¡Tu actitud positiva hace la diferencia!",
              "¡Haz de hoy un día increíble!",
              "¡Eres capaz de cosas extraordinarias!",
              "¡Bienvenido a un nuevo día de oportunidades!"
            ],
            "check_out": [
              "¡Que descanses! Gracias por tu trabajo hoy.",
              "¡Hasta mañana! Buen descanso.",
              "¡Nos vemos pronto! Disfruta tu tiempo libre.",
              "¡Gracias por tu dedicación! Descansa bien.",
              "¡Hasta pronto! Tu esfuerzo hace la diferencia."
            ]
          }

          const typeMessages = messages[type];
          const randomMessage = typeMessages[Math.floor(Math.random() * typeMessages.length)];

          setMessage(`¡${type === "check_in" ? "Bienvenido" : "Hasta pronto"}, ${employees.name}! ${randomMessage}`);
        }
      } catch (error) {
        console.error("Error durante el reconocimiento facial:", error)
        setMessage("Ocurrió un error. Por favor, inténtalo de nuevo o contacta a soporte técnico.")
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Control de Acceso</h1>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="space-y-4">
          <div>
            <button
              onClick={startVideo}
              className={`w-full font-bold py-2 px-4 rounded ${
                isCameraActive 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
              disabled={isCameraActive}
            >
              {isCameraActive ? "Cámara Activada" : "Iniciar Cámara"}
            </button>
          </div>
          <div className="relative">
            <div className="text-center mb-2 text-gray-600">
              {isCameraActive 
                ? "Centre el rostro en la guía" 
                : "Active la cámara para comenzar"}
            </div>
            <div className="relative rounded-lg overflow-hidden">
              <video 
                ref={videoRef} 
                width="400" 
                height="300" 
                autoPlay 
                muted 
                className={`rounded-lg ${!isCameraActive && 'opacity-50'} w-full h-auto`}
              />
              {isCameraActive && <FaceGuide />}
              <canvas 
                ref={canvasRef} 
                width="400" 
                height="300" 
                className="absolute inset-0 w-full h-full" 
                style={{ objectFit: 'contain' }}
              />
            </div>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => handleAccess("check_in")}
              className={`w-full font-bold py-2 px-4 rounded ${
                isCameraActive
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-gray-300 cursor-not-allowed text-gray-500"
              }`}
              disabled={!isCameraActive}
            >
              Entrada
            </button>
            <button
              onClick={() => handleAccess("check_out")}
              className={`w-full font-bold py-2 px-4 rounded ${
                isCameraActive
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-gray-300 cursor-not-allowed text-gray-500"
              }`}
              disabled={!isCameraActive}
            >
              Salida
            </button>
          </div>
          {message && (
            <div className={`mt-4 p-4 rounded-lg text-center ${
              message.includes("error") || message.includes("verifica")
                ? "bg-red-100 text-red-800"
                : "bg-blue-100 text-blue-800"
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
