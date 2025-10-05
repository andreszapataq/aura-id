"use client"

import { useState, useEffect, useCallback, useRef } from 'react';
import awsconfig from '@/aws-exports';
import { Amplify } from 'aws-amplify';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import { logger } from '@/lib/logger';
import '@aws-amplify/ui-react/styles.css';
import '@aws-amplify/ui-react-liveness/styles.css';

// Configurar Amplify y verificar configuración
try {
  logger.log('Configurando AWS Amplify con:', {
    region: awsconfig.aws_project_region,
    identityPoolId: awsconfig.aws_cognito_identity_pool_id,
    hasIdentityPool: !!awsconfig.aws_cognito_identity_pool_id
  });
  
  Amplify.configure(awsconfig);
  logger.log('AWS Amplify configurado exitosamente');
} catch (error) {
  logger.error('Error al configurar AWS Amplify:', error);
}

interface LivenessDetectionProps {
  onSuccess: (referenceImage: string, sessionId: string) => void;
  onError: (error: Error) => void;
  onCancel: () => void;
}

export default function LivenessDetection({ 
  onSuccess, 
  onError, 
  onCancel 
}: LivenessDetectionProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const MAX_RETRIES = 3;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);

  // Función para crear una nueva sesión
  const createNewSession = useCallback(async (currentRetryCount = 0) => {
    setIsLoading(true);
    setError(null);
    setSessionUrl(null);
    
    try {
      // If we've exceeded max retries, show a more permanent error
      if (currentRetryCount >= MAX_RETRIES) {
        setError('Se ha excedido el número máximo de intentos. Por favor, inténtelo más tarde.');
        setIsLoading(false);
        return;
      }
      
      logger.log('Intentando crear sesión de liveness...');
      
      const response = await fetch('/api/liveness/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      logger.log('Estado de respuesta:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Error en la respuesta de la API:', errorText);
        throw new Error(`Error en la respuesta: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      logger.log('Sesión creada con éxito:', data.sessionId);
      
      if (!data.sessionId) {
        throw new Error('No se recibió ID de sesión en la respuesta');
      }
      
      setSessionId(data.sessionId);
    } catch (error) {
      logger.error('Error detallado al crear la sesión:', error);
      
      // Provide more specific error message based on the error
      let errorMessage = 'Error al crear la sesión de verificación';
      
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      
      setError(errorMessage);
      onError(error instanceof Error ? error : new Error('Error desconocido'));
      
      // Automatically retry after a delay for certain errors
      if (currentRetryCount < MAX_RETRIES) {
        const nextRetryCount = currentRetryCount + 1;
        logger.log(`Reintentando en 5 segundos (intento ${nextRetryCount} de ${MAX_RETRIES})...`);
        setTimeout(() => {
          setIsLoading(true);
          createNewSession(nextRetryCount);
        }, 5000);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onError, MAX_RETRIES]);

  // Crear sesión al montar el componente (solo una vez)
  useEffect(() => {
    createNewSession(0);
  }, []); // Sin dependencias para evitar bucle infinito

  // Función wrapper para handlers de botón
  const handleRetryClick = () => {
    createNewSession(0);
  };

  // Función para capturar imagen de la webcam
  const captureImageFromWebcam = useCallback(async (): Promise<string | null> => {
    try {
      logger.log('Intentando capturar imagen de la webcam...');
      
      // Crear elementos temporales si no existen
      const video = videoRef.current || document.createElement('video');
      const canvas = canvasRef.current || document.createElement('canvas');
      
      if (!videoRef.current) {
        video.style.display = 'none';
        document.body.appendChild(video);
      }
      
      if (!canvasRef.current) {
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
      }
      
      // Obtener acceso a la cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      
      // Configurar el video
      video.srcObject = stream;
      video.play();
      
      // Esperar a que el video esté listo
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });
      
      // Dar tiempo para que la cámara se ajuste
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Configurar el canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Capturar la imagen
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }
      
      // Dibujar el video en el canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Obtener la imagen como base64
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      
      // Detener la cámara
      stream.getTracks().forEach(track => track.stop());
      
      // Limpiar elementos temporales
      if (!videoRef.current) {
        document.body.removeChild(video);
      }
      
      if (!canvasRef.current) {
        document.body.removeChild(canvas);
      }
      
      logger.log('Imagen capturada exitosamente:', imageData.substring(0, 50) + '...');
      return imageData;
    } catch (error) {
      logger.error('Error al capturar imagen de la webcam:', error);
      return null;
    }
  }, []);

  const handleAnalysisComplete = async (result: { sessionId: string }) => {
    try {
      logger.log('Análisis completado con sessionId:', result.sessionId);
      if (!result.sessionId) {
        const errorMsg = 'No se recibió ID de sesión';
        logger.error(errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Verificar el resultado de la sesión
      let response;
      try {
        response = await fetch('/api/liveness/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            sessionId: result.sessionId 
          }),
        });
      } catch (fetchError) {
        const errorMsg = 'Error de red al evaluar la sesión';
        logger.error(errorMsg, fetchError);
        setError(`${errorMsg}. Por favor, verifique su conexión a internet.`);
        throw new Error(errorMsg);
      }
      
      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.error || `Error ${response.status}`;
          logger.error('Error en la respuesta de la API:', errorData);
        } catch {
          errorText = await response.text();
          logger.error('Error en la respuesta de la API (texto plano):', errorText);
        }
        
        const errorMsg = `Error en la respuesta: ${response.status} - ${errorText}`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      let data;
      try {
        data = await response.json();
        logger.log('Datos de evaluación recibidos:', data);
      } catch (jsonError) {
        const errorMsg = 'Error al procesar la respuesta del servidor';
        logger.error(errorMsg, jsonError);
        setError(`${errorMsg}. La respuesta no es un JSON válido.`);
        throw new Error(errorMsg);
      }
      
      // Verificar si los datos están vacíos o son inválidos
      if (!data || Object.keys(data).length === 0) {
        logger.error('Datos de evaluación vacíos o inválidos');
        setError('No se recibieron datos de evaluación del servidor. Por favor, intente nuevamente.');
        throw new Error('Datos de evaluación inválidos: ' + JSON.stringify(data));
      }
      
      // Si la sesión está en estado CREATED, mostrar el enlace para completarla
      if (data.status === 'CREATED' && data.sessionUrl) {
        setSessionUrl(data.sessionUrl);
        setError('La sesión de verificación no ha sido completada. Por favor, complete el proceso siguiendo el enlace proporcionado.');
        return;
      }
      
      if (!data.ok) {
        logger.error('Datos de evaluación inválidos:', data);
        const errorMsg = data.error || 'La verificación de presencia falló';
        const detailsMsg = data.details ? ` (${JSON.stringify(data.details)})` : '';
        setError(`${errorMsg}${detailsMsg}`);
        throw new Error(errorMsg);
      }
      
      let referenceImage = '';
      
      // Verificar si el servidor indica que debemos capturar la imagen en el cliente
      if (data.captureImageInClient || (!data.referenceImage?.Bytes)) {
        logger.log('El servidor indica que debemos capturar la imagen en el cliente o no hay imagen de referencia');
        
        // Cambiar el estado a éxito para mostrar el mensaje de mantener posición
        setStatus('success');
        
        // Esperar un momento para que el usuario mantenga la posición
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const capturedImage = await captureImageFromWebcam();
        
        if (!capturedImage) {
          logger.error('No se pudo capturar la imagen de la webcam');
          setError('No se pudo capturar la imagen de la webcam. Por favor, intente nuevamente.');
          throw new Error('No se pudo capturar la imagen de la webcam');
        }
        
        logger.log('Usando imagen capturada localmente');
        referenceImage = capturedImage;
      }
      // Verificar si tenemos una imagen de referencia válida de AWS
      else if (data.referenceImage && data.referenceImage.Bytes) {
        logger.log('Usando imagen de referencia de AWS Rekognition');
        logger.log('Información de la imagen:', data.imageInfo || 'No disponible');
        referenceImage = `data:image/jpeg;base64,${data.referenceImage.Bytes}`;
      } else {
        logger.warn('No se recibió imagen de referencia válida de AWS');
        setError('No se recibió imagen de referencia. Por favor, intente nuevamente.');
        throw new Error('No se recibió imagen de referencia válida');
      }
      
      // Verificar que la imagen no sea undefined o vacía
      if (!referenceImage || referenceImage === 'data:image/jpeg;base64,undefined' || referenceImage === 'data:image/jpeg;base64,') {
        logger.error('Imagen de referencia inválida:', referenceImage);
        setError('La imagen de referencia es inválida. Por favor, intente nuevamente.');
        throw new Error('Imagen de referencia inválida');
      }
      
      logger.log('Verificación exitosa con imagen válida');
      onSuccess(referenceImage, result.sessionId);
    } catch (error) {
      logger.error('Error en handleAnalysisComplete:', error);
      onError(error instanceof Error ? error : new Error('Error desconocido'));
    }
  };

  // Renderizar pantalla de carga
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-600">Preparando verificación...</p>
      </div>
    );
  }

  // Renderizar mensaje de error si no se pudo crear la sesión
  if (!sessionId) {
    return (
      <div className="text-center p-4 bg-red-100 text-red-800 rounded-lg">
        <p>No se pudo iniciar la sesión de verificación.</p>
        <button 
          onClick={handleRetryClick}
          className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Intentar nuevamente
        </button>
      </div>
    );
  }

  // Renderizar mensaje de error y enlace si la sesión no está completa
  if (error && sessionUrl) {
    return (
      <div className="text-center p-4 bg-yellow-100 text-yellow-800 rounded-lg">
        <p className="mb-3">{error}</p>
        <a 
          href={sessionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Completar verificación
        </a>
        <button 
          onClick={handleRetryClick}
          className="mt-3 ml-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Iniciar nueva verificación
        </button>
      </div>
    );
  }

  // Renderizar mensaje de error genérico
  if (error) {
    return (
      <div className="text-center p-4 bg-red-100 text-red-800 rounded-lg">
        <p>{error}</p>
        <button 
          onClick={handleRetryClick}
          className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Intentar nuevamente
        </button>
      </div>
    );
  }

  return (
    <div className="liveness-container">
      {/* Elementos ocultos para captura de imagen */}
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <FaceLivenessDetector
        sessionId={sessionId}
        region={'us-east-1'}
        onAnalysisComplete={() => {
          logger.log('onAnalysisComplete llamado con sessionId:', sessionId);
          return Promise.resolve(handleAnalysisComplete({ sessionId: sessionId || '' }));
        }}
        onError={(error) => {
          // Intentar extraer información útil del error
          let errorMessage = 'Desconocido';
          let shouldRetry = false;
          
          try {
            logger.log('Error completo recibido:', error);
            logger.log('Tipo de error:', typeof error);
            logger.log('Keys del error:', error ? Object.keys(error) : []);
            
            if (error) {
              const errorStr = String(error);
              const errorObj = typeof error === 'object' ? error : {};
              
              // Manejo específico para errores comunes
              if (errorStr.includes('credentials') || errorStr.includes('CredentialsError')) {
                errorMessage = 'Error de credenciales de AWS. Verifique la configuración del Identity Pool.';
                logger.error('❌ Error de credenciales AWS:', error);
              }
              else if (errorStr.includes('network') || errorStr.includes('NetworkError')) {
                errorMessage = 'Error de conexión de red. Verifique su conexión a internet.';
                shouldRetry = true;
              }
              else if ('state' in errorObj && errorObj.state === 'SERVER_ERROR') {
                logger.log('Detectado error de servidor AWS:', error);
                errorMessage = 'Error en el servidor de verificación AWS.';
                shouldRetry = true;
              }
              else if (errorStr.includes('region') || errorStr.includes('identity pool')) {
                errorMessage = 'Error de configuración de AWS. Verifique las variables de entorno.';
                logger.error('❌ Error de configuración AWS:', error);
              }
              // Intentar convertir el error a string JSON si es posible
              else if (typeof error === 'object') {
                errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error));
              } else {
                errorMessage = errorStr;
              }
            }
          } catch (parseError) {
            logger.error('Error al procesar el error:', parseError);
            errorMessage = 'Error no serializable';
          }
          
          logger.error('🔍 Error detallado en la verificación de presencia:', {
            error,
            errorType: typeof error,
            errorKeys: error ? Object.keys(error) : [],
            errorMessage,
            shouldRetry
          });
          
          // Decidir si reintentar automáticamente
          if (shouldRetry && (errorMessage === '{}' || errorMessage.includes('SERVER_ERROR') || errorMessage.includes('network'))) {
            logger.log('⏳ Reintentando automáticamente...');
            setError('Reintentando verificación automáticamente...');
            
            setTimeout(() => {
              createNewSession(0);
            }, 3000);
          } else {
            setError(`Error en la verificación de presencia: ${errorMessage}`);
            onError(new Error(`Error en la verificación de presencia: ${errorMessage}`));
          }
          
          return Promise.resolve();
        }}
        onUserCancel={() => {
          logger.log('Usuario canceló la verificación');
          onCancel();
          return Promise.resolve();
        }}
        disableStartScreen={false}
        displayText={
          {
            camera: {
              loading: "Inicializando cámara...",
            },
            instructions: {
              header: "Siga las instrucciones para verificar su presencia",
              preparing: "Preparando...",
            },
            oval: {
              positionFace: "Posicione su rostro dentro del óvalo",
              tooClose: "Aleje su rostro",
              tooFar: "Acerque su rostro",
            },
            challenges: {
              analyzing: "Analizando...",
              faceDetected: "Rostro detectado",
              lookStraight: "Mire al frente",
              moveHead: "Mueva su cabeza lentamente",
              blink: "Parpadee",
              smile: "Sonría",
              allComplete: "¡Verificación completada!",
            },
            feedback: {
              success: "Verificación exitosa",
            },
            buttons: {
              cancel: "Cancelar",
              retry: "Reintentar",
            }
          } as Record<string, unknown>
        }
      />
      
      {status === 'success' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 text-white p-4 z-10">
          <div className="bg-green-500 rounded-full p-4 mb-4">
            <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <p className="text-xl font-bold mb-2">¡Verificación exitosa!</p>
          <p className="text-center mb-4 text-white/90">Mantenga su posición mientras capturamos su imagen...</p>
          <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
            <div className="bg-green-500 h-2.5 rounded-full animate-[progress_3s_ease-in-out]" style={{ width: '100%' }}></div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        /* Personalizar colores del componente de AWS Amplify */
        .amplify-liveness-oval {
          border-color: #0EA5E9 !important;
        }
        
        .amplify-liveness-success-text {
          color: #22C55E !important;
        }
        
        .amplify-liveness-button {
          background-color: #0EA5E9 !important;
          color: white !important;
          border-radius: 0.75rem !important;
          font-weight: 500 !important;
        }

        .amplify-liveness-button:hover {
          background-color: #0284C7 !important;
        }
        
        .amplify-liveness-icon-success {
          color: #22C55E !important;
        }
        
        .amplify-liveness-error-text {
          color: #EF4444 !important;
        }
        
        .amplify-liveness-progress-indicator {
          background-color: #0EA5E9 !important;
        }

        .amplify-liveness-container {
          border-radius: 1rem !important;
          overflow: hidden !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
        }

        .amplify-liveness-challenge-indicator {
          border-radius: 9999px !important;
        }

        .amplify-liveness-challenge-indicator-completed {
          background-color: #22C55E !important;
        }
      `}</style>
      
      <style jsx>{`
        .liveness-container {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          position: relative;
          border-radius: 1rem;
          overflow: hidden;
        }
        
        @keyframes progress {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
} 