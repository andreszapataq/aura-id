"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { supabase } from "@/lib/supabase"

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
        throw new Error("No face image captured")
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
        throw new Error(indexData.error || "Failed to index face");
      }

      if (!indexData.faceId) {
        throw new Error("No face ID returned from the server");
      }

      // Crear el objeto de datos del empleado
      const employeeData = {
        name,
        employee_id: employeeId,
        face_data: indexData.faceId,
      };

      // Save employee data to Supabase
      const { error: supabaseError } = await supabase
        .from("employees")
        .insert(employeeData);

      if (supabaseError) {
        console.error("Supabase error:", supabaseError);
        throw new Error(supabaseError.message || "Error saving to database");
      }

      alert("Employee registered successfully!")
      // Reset form
      setName("")
      setEmployeeId("")
      setCapturedImage(null)
    } catch (error) {
      console.error("Error registering employee:", error);
      alert(
        error instanceof Error 
          ? `Error: ${error.message}` 
          : "Failed to register employee. Please try again."
      );
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
