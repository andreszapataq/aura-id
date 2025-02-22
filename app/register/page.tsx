"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import * as faceapi from "face-api.js"
import { supabase } from "@/lib/supabase"

export default function Register() {
  const [name, setName] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let stream: MediaStream | null = null;
    const videoElement = videoRef.current;

    const initialize = async () => {
      try {
        await loadModels();
        stream = await startVideo();
      } catch (error) {
        console.error("Initialization error:", error);
      }
    };

    initialize();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, []);

  async function loadModels() {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition')
      ]);
      setIsLoading(false);
      console.log('Modelos cargados');
    } catch (error) {
      setIsLoading(false);
      console.error('Error modelos:', error);
    }
  }

  async function startVideo(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(error => {
          if (error.name !== 'AbortError') {
            throw error;
          }
        });
      }
      return stream;
    } catch (error) {
      console.error("Camera error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setCameraError(errorMessage);
      throw error;
    }
  }

  async function captureImage() {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      const detections = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks();

      if (!detections) {
        throw new Error("No se detectó un rostro. Por favor intenta de nuevo");
      }

      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Asegurar dimensiones correctas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedImage(canvas.toDataURL());
      
    } catch (error) {
      console.error("Capture error:", error);
      alert(error instanceof Error ? error.message : "Error al capturar imagen");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!capturedImage) {
      alert("⚠️ Primero captura una imagen con el botón 'Capture Image'");
      return;
    }

    try {
      const { error } = await supabase.from("employees").insert({
        name,
        employee_id: employeeId,
        face_data: capturedImage,
      })

      if (error) throw error

      alert("Employee registered successfully!")
      // Reset form
      setName("")
      setEmployeeId("")
      setCapturedImage(null)
    } catch (error) {
      console.error("Error:", error);
      alert(error instanceof Error ? error.message : "Error desconocido");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Register New Employee</h1>
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
            <video ref={videoRef} width="400" height="300" autoPlay muted className="rounded-lg" />
            <canvas ref={canvasRef} width="400" height="300" className="absolute top-0 left-0" />
            {cameraError && (
              <div className="absolute inset-0 bg-red-100/80 flex items-center justify-center p-4 text-center">
                <p className="text-red-600 font-medium">{cameraError}</p>
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={captureImage}
              className={`w-full text-white font-bold py-2 px-4 rounded ${
                isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Cargando modelos...' : 'Capturar Imagen'}
            </button>
          </div>
          {capturedImage && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedImage || "/placeholder.svg"} alt="Captured face" className="mt-4 rounded-lg" />
            </div>
          )}
          <div>
            <button
              type="submit"
              className={`w-full bg-indigo-500 text-white font-bold py-2 px-4 rounded ${
                !capturedImage ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600"
              }`}
              disabled={!capturedImage}
            >
              Registrar Empleado
            </button>
          </div>
          {isLoading && <p>Cargando modelos de detección facial...</p>}
        </form>
      </div>
    </div>
  )
}
