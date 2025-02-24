"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import FaceGuide from '../components/FaceGuide'

interface LastAccessLog {
  type: 'check_in' | 'check_out';
  timestamp: string;
}

export default function Access() {
  const [message, setMessage] = useState("")
  const [isCameraActive, setIsCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [lastLog, setLastLog] = useState<LastAccessLog | null>(null)

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

  function getWelcomeMessage(name: string, type: string, isFirstLog: boolean, isTemporaryExit: boolean) {
    const timeOfDay = new Date().getHours();
    const messages = {
      "check_in": {
        first: [ // Mensajes para la primera entrada del día
          timeOfDay < 12 
            ? `¡Buenos días ${name}! Que tengas una excelente jornada.`
            : timeOfDay < 19
              ? `¡Buenas tardes ${name}! Bienvenido al trabajo.`
              : `¡Buenas noches ${name}! Bienvenido a tu turno.`,
          "¡Que sea un día productivo y positivo!",
          "¡Comencemos este día con energía!",
          "¡Bienvenido! Hoy será un gran día.",
        ],
        return: [ // Mensajes para regresos después de recesos
          "¡Bienvenido de vuelta!",
          "¡Continuemos con las actividades!",
          "¡Adelante con el resto de la jornada!",
          "¡De vuelta al trabajo!",
        ]
      },
      "check_out": {
        temporary: [ // Mensajes para salidas temporales
          "¡Hasta pronto!",
          "¡Te esperamos de vuelta!",
          "¡Nos vemos en un rato!",
          "¡Regresa pronto!",
        ],
        final: [ // Mensajes para la salida final del día
          timeOfDay < 12 
            ? "¡Que tengas un excelente resto del día!"
            : timeOfDay < 19
              ? "¡Que tengas una excelente tarde!"
              : "¡Que descanses! Nos vemos mañana.",
          "¡Gracias por tu trabajo de hoy!",
          "¡Hasta mañana! Disfruta tu tiempo libre.",
          "¡Que tengas un buen descanso!",
        ]
      }
    };

    if (type === "check_in") {
      const messageArray = isFirstLog ? messages.check_in.first : messages.check_in.return;
      return messageArray[Math.floor(Math.random() * messageArray.length)];
    } else {
      const messageArray = isTemporaryExit ? messages.check_out.temporary : messages.check_out.final;
      return messageArray[Math.floor(Math.random() * messageArray.length)];
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

          if (error || !employees) {
            if (error && !error.message.includes('no rows')) {
              throw error;
            }
            setMessage("Tu rostro fue reconocido pero no se encontraron tus datos en el sistema. Por favor, contacta a un administrador.");
            return;
          }

          // Obtener los registros del día actual
          const today = new Date();
          const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
          
          const { data: todayAccess, error: accessError } = await supabase
            .from("access_logs")
            .select("*")
            .eq("employee_id", employees.id)
            .gte("timestamp", startOfDay)
            .order("timestamp", { ascending: false });

          if (accessError) throw accessError;

          // Determinar si es el primer registro del día y si es una salida temporal
          const isFirstLog = !todayAccess || todayAccess.length === 0;
          const isTemporaryExit = type === "check_out" && 
            today.getHours() < 17 && // Asumiendo que 17:00 es una hora típica de salida
            todayAccess && 
            todayAccess.length > 0;

          // Manejar registro incompleto del día anterior
          if (lastLog && lastLog.type === "check_in") {
            const lastAccessDate = new Date(lastLog.timestamp);
            const isLastAccessToday = lastAccessDate >= new Date(startOfDay);
            
            if (!isLastAccessToday && lastLog.type === "check_in") {
              // Registrar salida automática del día anterior
              await supabase.from("access_logs").insert({
                employee_id: employees.id,
                timestamp: new Date(lastAccessDate.getFullYear(), 
                                  lastAccessDate.getMonth(), 
                                  lastAccessDate.getDate(), 
                                  23, 59, 59).toISOString(),
                type: "check_out",
                auto_generated: true
              });
              
              setMessage("Se registró automáticamente la salida del día anterior.");
              await new Promise(resolve => setTimeout(resolve, 3000)); // Mostrar mensaje por 3 segundos
            }
          }

          // Validar el tipo de registro actual
          if (todayAccess && todayAccess.length > 0) {
            const lastAccessType = todayAccess[0].type;

            // No permitir dos registros del mismo tipo consecutivos
            if (type === lastAccessType) {
              const actionType = type === "check_in" ? "entrada" : "salida";
              setMessage(`No puedes registrar una ${actionType} dos veces seguidas. Por favor, registra una ${type === "check_in" ? "salida" : "entrada"}.`);
              return;
            }
          }

          // Registrar nuevo acceso
          const now = new Date()
          const { error: logError } = await supabase
            .from("access_logs")
            .insert({
              employee_id: employees.id,
              timestamp: now.toISOString(),
              type: type,
            })

          if (logError) throw logError

          const welcomeMessage = getWelcomeMessage(
            employees.name, 
            type, 
            isFirstLog, 
            isTemporaryExit
          );

          setMessage(welcomeMessage);
          setLastLog({ type, timestamp: now.toISOString() });
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
