"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import FaceGuide from '../components/FaceGuide'

export default function Access() {
  const [message, setMessage] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  async function startVideo() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    }
  }

  async function recognizeFace() {
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
          // Fetch employee data from Supabase
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
          const { error: logError } = await supabase.from("access_logs").insert({
            employee_id: employees.id,
            timestamp: now.toISOString(),
            type: "check_in",
          })

          if (logError) throw logError

          const motivationalMessages = [
            "¡Que tengas un excelente día!",
            "¡Tu actitud positiva hace la diferencia!",
            "¡Cree en ti mismo y estarás a medio camino!",
            "¡Haz de hoy un día increíble!",
            "¡Eres capaz de cosas extraordinarias!",
          ]

          const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]

          setMessage(`¡Bienvenido, ${employees.name}! ${randomMessage}`)
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
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Start Camera
            </button>
          </div>
          <div className="relative">
            <div className="text-center mb-2 text-gray-600">
              Centre el rostro en la guía
            </div>
            <div className="relative rounded-lg overflow-hidden">
              <video 
                ref={videoRef} 
                width="400" 
                height="300" 
                autoPlay 
                muted 
                className="rounded-lg"
              />
              <FaceGuide />
              <canvas 
                ref={canvasRef} 
                width="400" 
                height="300" 
                className="absolute top-0 left-0" 
              />
            </div>
          </div>
          <div>
            <button
              onClick={recognizeFace}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
            >
              Check In/Out
            </button>
          </div>
          {message && <div className="mt-4 p-4 bg-blue-100 text-blue-800 rounded-lg">{message}</div>}
        </div>
      </div>
    </div>
  )
}
