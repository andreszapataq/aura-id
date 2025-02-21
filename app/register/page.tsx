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

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models")
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models")
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models")
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
      const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      if (detections) {
        const canvas = canvasRef.current
        const displaySize = { width: videoRef.current.width, height: videoRef.current.height }
        faceapi.matchDimensions(canvas, displaySize)
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        setCapturedImage(canvas.toDataURL())
      } else {
        alert("No face detected. Please try again.")
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (!capturedImage) {
        throw new Error("No face image captured")
      }

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
      console.error("Error registering employee:", error)
      alert("Failed to register employee. Please try again.")
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
              <img src={capturedImage || "/placeholder.svg"} alt="Captured face" className="mt-4 rounded-lg" />
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
