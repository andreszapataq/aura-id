"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import LivenessDetection from '@/components/LivenessDetection'

interface LastAccessLog {
  type: 'check_in' | 'check_out';
  timestamp: string;
}

export default function Access() {
  const [message, setMessage] = useState("")
  const [lastLog, setLastLog] = useState<LastAccessLog | null>(null)
  const [showLivenessDetection, setShowLivenessDetection] = useState(true) // Iniciar con verificación de presencia activa
  const [livenessStatus, setLivenessStatus] = useState<'none' | 'checking' | 'success' | 'failed'>('checking')
  const [verifiedImage, setVerifiedImage] = useState<string | null>(null)

  // Iniciar verificación de presencia automáticamente al cargar la página
  useEffect(() => {
    setShowLivenessDetection(true)
    setLivenessStatus('checking')
  }, [])

  function handleLivenessSuccess(referenceImage: string) {
    setVerifiedImage(referenceImage)
    setLivenessStatus('success')
    setShowLivenessDetection(false)
    setMessage("Verificación exitosa. Ahora puede registrar entrada o salida.")
  }

  function handleLivenessError(error: Error) {
    console.error("Error en verificación de presencia:", error)
    setLivenessStatus('failed')
    setShowLivenessDetection(false)
    setMessage(`Error: ${error.message}`)
  }

  function handleLivenessCancel() {
    // Al cancelar, reiniciar la verificación
    setShowLivenessDetection(true)
    setLivenessStatus('checking')
  }

  function getFirstName(fullName: string): string {
    const nameParts = fullName.trim().split(' ');
    
    // Si tiene más de 2 palabras, tomar las dos primeras (nombre compuesto)
    if (nameParts.length > 2) {
      return `${nameParts[0]} ${nameParts[1]}`;
    }
    
    // Si tiene solo 2 palabras o menos, tomar la primera
    return nameParts[0];
  }

  function getWelcomeMessage(fullName: string, type: string, isFirstLog: boolean, isTemporaryExit: boolean) {
    const timeOfDay = new Date().getHours();
    const name = getFirstName(fullName);
    
    const messages = {
      "check_in": {
        first: [ // Primera entrada del día
          timeOfDay < 12 
            ? `¡Buenos días ${name}! Que tengas una excelente jornada.`
            : timeOfDay < 19
              ? `¡Buenas tardes ${name}! Bienvenido al trabajo.`
              : `¡Buenas noches ${name}! Bienvenido a tu turno.`,
          `¡Hola ${name}! Que sea un día productivo y positivo.`,
          `¡Bienvenido ${name}! Hoy será un gran día.`,
          `¡${name}, es un gusto verte! Comencemos este día con energía.`,
        ],
        return: [ // Regresos después de recesos
          `¡Bienvenido de vuelta ${name}!`,
          `¡${name}, continuemos con las actividades!`,
          `¡Adelante ${name}, sigamos con el resto de la jornada!`,
          `¡${name}, qué bueno tenerte de vuelta!`,
        ]
      },
      "check_out": {
        temporary: [ // Salidas temporales
          `¡Hasta pronto ${name}!`,
          `¡${name}, te esperamos de vuelta!`,
          `¡Nos vemos en un rato ${name}!`,
          `¡${name}, que disfrutes tu descanso!`,
        ],
        final: [ // Salida final del día
          timeOfDay < 12 
            ? `¡${name}, que tengas un excelente resto del día!`
            : timeOfDay < 19
              ? `¡${name}, que tengas una excelente tarde!`
              : `¡${name}, que descanses! Nos vemos mañana.`,
          `¡Gracias por tu trabajo de hoy ${name}!`,
          `¡Hasta mañana ${name}! Disfruta tu tiempo libre.`,
          `¡${name}, que tengas un buen descanso!`,
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
    if (livenessStatus !== 'success' || !verifiedImage) {
      setMessage("Debe completar la verificación de presencia primero")
      return
    }

    try {
      const searchResponse = await fetch('/api/search-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData: verifiedImage }),
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
        
        // Resetear el estado de verificación después de un registro exitoso
        setLivenessStatus('none');
        setVerifiedImage(null);
        // Mostrar nuevamente la verificación de presencia para un nuevo registro
        setTimeout(() => {
          setShowLivenessDetection(true);
          setLivenessStatus('checking');
        }, 5000); // Esperar 5 segundos antes de reiniciar la verificación
      }
    } catch (error) {
      console.error("Error durante el reconocimiento facial:", error)
      setMessage("Ocurrió un error. Por favor, inténtalo de nuevo o contacta a soporte técnico.")
    }
  }

  function reiniciarVerificacion() {
    setShowLivenessDetection(true);
    setLivenessStatus('checking');
    setMessage("");
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Control de Acceso</h1>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        {showLivenessDetection ? (
          <LivenessDetection
            onSuccess={handleLivenessSuccess}
            onError={handleLivenessError}
            onCancel={handleLivenessCancel}
          />
        ) : (
          <div className="space-y-4">
            {livenessStatus === 'success' && (
              <div className="mb-4 p-4 bg-green-50 rounded-lg text-center">
                <div className="text-green-600 font-semibold">
                  ✓ Verificación de presencia exitosa
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Ahora puede registrar su entrada o salida
                </p>
              </div>
            )}
            
            <div className="flex space-x-4">
              <button
                onClick={() => handleAccess("check_in")}
                className={`w-full font-bold py-2 px-4 rounded ${
                  livenessStatus === 'success'
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-gray-300 cursor-not-allowed text-gray-500"
                }`}
                disabled={livenessStatus !== 'success'}
              >
                Entrada
              </button>
              <button
                onClick={() => handleAccess("check_out")}
                className={`w-full font-bold py-2 px-4 rounded ${
                  livenessStatus === 'success'
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gray-300 cursor-not-allowed text-gray-500"
                }`}
                disabled={livenessStatus !== 'success'}
              >
                Salida
              </button>
            </div>
            
            {livenessStatus === 'failed' && (
              <button
                onClick={reiniciarVerificacion}
                className="w-full mt-4 font-bold py-2 px-4 rounded bg-blue-500 hover:bg-blue-600 text-white"
              >
                Reintentar Verificación
              </button>
            )}
            
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
        )}
      </div>
    </div>
  )
}
