"use client"

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface SimpleLivenessDetectionProps {
  onSuccess: (referenceImage: string, sessionId: string) => void;
  onError: (error: Error) => void;
  onCancel: () => void;
}

export default function SimpleLivenessDetection({ 
  onSuccess, 
  onError, 
  onCancel 
}: SimpleLivenessDetectionProps) {
  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Crear sesión de liveness
  const createSession = useCallback(async () => {
    try {
      const response = await fetch('/api/liveness/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Error al crear sesión de liveness');
      }
      
      const data = await response.json();
      setSessionId(data.sessionId);
      return data.sessionId;
    } catch (error) {
      console.error('Error creando sesión:', error);
      onError(error instanceof Error ? error : new Error('Error desconocido'));
      return null;
    }
  }, [onError]);

  // Inicializar cámara
  const initializeCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        const video = videoRef.current;
        
        // Configurar el video element
        video.srcObject = mediaStream;
        video.muted = true;
        video.playsInline = true;
        
        // Esperar a que los metadatos se carguen antes de reproducir
        return new Promise<boolean>((resolve) => {
          const handleLoadedMetadata = async () => {
            try {
              await video.play();
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
              resolve(true);
            } catch (playError) {
              console.error('Error al reproducir video:', playError);
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
              resolve(false);
            }
          };
          
          video.addEventListener('loadedmetadata', handleLoadedMetadata);
          
          // Timeout de seguridad
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve(false);
          }, 5000);
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error accediendo a la cámara:', error);
      
      let errorMessage = 'No se pudo acceder a la cámara.';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara y recarga la página.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No se encontró ninguna cámara en el dispositivo.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'La cámara está siendo usada por otra aplicación.';
        }
      }
      
      setError(errorMessage);
      onError(new Error(errorMessage));
      return false;
    }
  }, [onError]);

  // Capturar imagen de alta calidad
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;

    // Configurar canvas al tamaño del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Capturar frame actual
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convertir a base64 con alta calidad
    return canvas.toDataURL('image/jpeg', 0.95);
  }, []);

  // Proceso de captura con countdown
  const startCapture = useCallback(async () => {
    if (!sessionId) {
      const newSessionId = await createSession();
      if (!newSessionId) return;
    }

    setIsCapturing(true);
    setCountdown(3);

    // Countdown 3, 2, 1
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setCountdown(0);
    
    // Capturar imagen
    const imageData = captureImage();
    
    if (!imageData) {
      onError(new Error('No se pudo capturar la imagen'));
      setIsCapturing(false);
      return;
    }

    try {
      // Evaluar con el backend
      const response = await fetch('/api/liveness/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          referenceImage: imageData
        })
      });

      if (!response.ok) {
        throw new Error('Error en la evaluación de liveness');
      }

      const result = await response.json();
      
      if (result.isLive) {
        // Éxito - mostrar brevemente antes de continuar
        setTimeout(() => {
          onSuccess(imageData, sessionId!);
        }, 1000);
      } else {
        throw new Error('No se pudo verificar que sea una persona real. Inténtelo de nuevo.');
      }
    } catch (error) {
      console.error('Error en evaluación:', error);
      onError(error instanceof Error ? error : new Error('Error en la verificación'));
    } finally {
      setIsCapturing(false);
    }
  }, [sessionId, createSession, captureImage, onSuccess, onError]);

  // Función para reintentar inicialización
  const retryInitialization = useCallback(async () => {
    setError(null);
    setIsInitializing(true);
    setIsActive(false);
    
    const sessionId = await createSession();
    if (sessionId) {
      const cameraOk = await initializeCamera();
      if (cameraOk) {
        setIsActive(true);
      }
    }
    setIsInitializing(false);
  }, [createSession, initializeCamera]);

  // Inicializar componente
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      const sessionId = await createSession();
      if (!mounted) return;
      
      if (sessionId) {
        const cameraOk = await initializeCamera();
        if (!mounted) return;
        
        if (cameraOk) {
          setIsActive(true);
        }
      }
      setIsInitializing(false);
    };
    
    init();

    // Cleanup al desmontar
    return () => {
      mounted = false;
    };
  }, [createSession, initializeCamera]);

  // Cleanup del stream cuando cambia
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Mostrar error si existe
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center p-6">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={retryInitialization}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!isActive || isInitializing) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isInitializing ? 'Inicializando cámara...' : 'Cargando...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Video feed */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-auto max-h-96 object-cover"
          autoPlay
          muted
          playsInline
        />
        
        {/* Canvas oculto para captura */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Overlay para guía */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="border-4 border-blue-500 border-dashed rounded-full w-48 h-48 flex items-center justify-center">
            <span className="text-white text-sm text-center px-4">
              Posicione su rostro dentro del círculo
            </span>
          </div>
        </div>

        {/* Countdown overlay */}
        {countdown > 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-6xl font-bold text-white"
            >
              {countdown}
            </motion.div>
          </div>
        )}

        {/* Capturando overlay */}
        {isCapturing && countdown === 0 && (
          <div className="absolute inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center">
            <div className="text-white text-xl font-semibold bg-green-500 px-4 py-2 rounded-lg">
              ¡Capturando!
            </div>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="mt-6 flex justify-center space-x-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={startCapture}
          disabled={isCapturing}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {isCapturing ? 'Verificando...' : 'Iniciar Verificación'}
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Cancelar
        </motion.button>
      </div>

      {/* Instrucciones */}
      <div className="mt-4 text-center text-sm text-gray-600">
        <p>1. Posicione su rostro dentro del círculo</p>
        <p>2. Manténgase inmóvil durante la captura</p>
        <p>3. Asegúrese de tener buena iluminación</p>
      </div>
    </div>
  );
} 