"use client"

import { useState, useRef, useEffect } from "react"
import * as faceapi from "face-api.js"
import { supabase } from "@/lib/supabase"

export default function Access() {
  const [message, setMessage] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector')
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68')
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition')
  }

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
      const detections = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (detections) {
        const faceDescriptor = detections.descriptor

        // Fetch all employees from Supabase
        const { data: employees, error } = await supabase.from("employees").select("*")

        if (error) {
          console.error("Error fetching employees:", error)
          setMessage("An error occurred. Please try again.")
          return
        }

        // Compare face with stored employee faces
        let matchedEmployee = null
        for (const employee of employees) {
          const storedDescriptor = new Float32Array(Object.values(JSON.parse(employee.face_data)))
          const distance = faceapi.euclideanDistance(faceDescriptor, storedDescriptor)
          if (distance < 0.6) {
            // Adjust this threshold as needed
            matchedEmployee = employee
            break
          }
        }

        if (matchedEmployee) {
          const now = new Date()
          const { error } = await supabase.from("access_logs").insert({
            employee_id: matchedEmployee.id,
            timestamp: now.toISOString(),
            type: "check_in", // You might want to determine if it's check-in or check-out based on the last log
          })

          if (error) {
            console.error("Error logging access:", error)
            setMessage("An error occurred. Please try again.")
          } else {
            const motivationalMessages = [
              "Have a great day ahead!",
              "Your positive attitude can make a difference!",
              "Believe you can and you're halfway there!",
              "Make today amazing!",
              "You're capable of amazing things!",
            ]

            const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]

            setMessage(`Welcome, ${matchedEmployee.name}! ${randomMessage}`)
          }
        } else {
          setMessage("Face not recognized. Please try again or contact an administrator.")
        }
      } else {
        setMessage("No face detected. Please try again.")
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Employee Check In/Out</h1>
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
            <video ref={videoRef} width="400" height="300" autoPlay muted className="rounded-lg" />
            <canvas ref={canvasRef} width="400" height="300" className="absolute top-0 left-0" />
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
