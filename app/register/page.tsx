"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import FaceGuide from '../components/FaceGuide'

export default function Register() {
  const [name, setName] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    initializeCollection();
  }, []);

  async function initializeCollection() {
    try {
      const response = await fetch('/api/init-collection', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }
      console.log('Collection initialization:', data.message);
    } catch (error) {
      console.error('Error initializing collection:', error);
    }
  }

  async function startVideo() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    }
  }

  async function captureImage() {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      setCapturedImage(canvas.toDataURL("image/jpeg"))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (!capturedImage) {
        throw new Error("No se ha capturado ninguna imagen")
      }

      // Primero verificamos si el ID ya existe
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

      // Crear el objeto de datos del empleado
      const employeeData = {
        name,
        employee_id: employeeId,
        face_data: indexData.faceId,
      };

      // Guardar datos del empleado en Supabase
      const { error: supabaseError } = await supabase
        .from("employees")
        .insert(employeeData);

      if (supabaseError) {
        // Manejo específico para error de duplicado
        if (supabaseError.code === '23505') {
          alert(`El ID de empleado ${employeeId} ya está en uso. Por favor, utilice un ID diferente.`);
          return;
        }
        
        console.error("Error de Supabase:", supabaseError);
        throw new Error(supabaseError.message || "Error al guardar en la base de datos");
      }

      alert("¡Empleado registrado exitosamente!")
      // Resetear formulario
      setName("")
      setEmployeeId("")
      setCapturedImage(null)
    } catch (error) {
      console.error("Error al registrar empleado:", error);
      alert(
        error instanceof Error 
          ? `Error: ${error.message}` 
          : "Error al registrar empleado. Por favor, intente nuevamente."
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Registro de Empleado</h1>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>
          <div>
            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
              Employee ID
            </label>
            <input
              type="text"
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>
          <div>
            <button
              type="button"
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
              type="button"
              onClick={captureImage}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
            >
              Capture Image
            </button>
          </div>
          {capturedImage && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={capturedImage} 
                alt="Captured face" 
                width={400} 
                height={300}
                className="mt-4 rounded-lg"
              />
            </div>
          )}
          <div>
            <button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded"
            >
              Register Employee
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
