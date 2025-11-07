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
  const MAX_CONSECUTIVE_TIMEOUTS = 2; // Después de 2 timeouts consecutivos, entrar en modo espera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);
  const [consecutiveTimeouts, setConsecutiveTimeouts] = useState(0);
  const [isWaitingMode, setIsWaitingMode] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    
    // Cleanup: cancelar cualquier timeout pendiente al desmontar
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []); // Sin dependencias para evitar bucle infinito

  // Función wrapper para handlers de botón
  const handleRetryClick = () => {
    // Cancelar cualquier reintento automático pendiente
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    // Resetear todos los estados relevantes antes de reintentar
    setConsecutiveTimeouts(0);
    setIsWaitingMode(false);
    setError(null);
    setIsLoading(false);
    setSessionId(null);
    setSessionUrl(null);
    setStatus(null);
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
      setConsecutiveTimeouts(0); // Resetear contador en éxito
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

  // Renderizar pantalla de modo espera
  if (isWaitingMode) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl min-h-[400px]">
        <div className="bg-white rounded-full p-6 mb-6 shadow-lg">
          <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-3">Sistema en Espera</h3>
        <p className="text-gray-600 text-center mb-6 max-w-md">
          Toque el botón cuando esté listo para iniciar la verificación facial
        </p>
        <button
          onClick={() => {
            setIsWaitingMode(false);
            setConsecutiveTimeouts(0);
            setError(null);
            createNewSession(0);
          }}
          className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          ▶ Iniciar Verificación
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
          let isTimeout = false;
          
          try {
            const errorObj = typeof error === 'object' && error ? error : {};
            const errorStr = String(error);
            
            // Verificar si es TIMEOUT de múltiples formas
            isTimeout = (
              ('state' in errorObj && (errorObj as { state?: string }).state === 'TIMEOUT') ||
              errorStr.includes('TIMEOUT') ||
              errorStr.includes('timeout') ||
              errorStr.includes('Timeout')
            );
            
            if (isTimeout) {
              logger.log('⏱️ TIMEOUT detectado en verificación de liveness');
              errorMessage = 'Tiempo agotado';
              shouldRetry = true;
            }
            else if (errorStr.includes('credentials') || errorStr.includes('CredentialsError')) {
              errorMessage = 'Error de credenciales de AWS. Verifique la configuración del Identity Pool.';
              logger.error('❌ Error de credenciales AWS:', error);
            }
            else if (errorStr.includes('network') || errorStr.includes('NetworkError')) {
              errorMessage = 'Error de conexión de red. Verifique su conexión a internet.';
              shouldRetry = true;
            }
            else if ('state' in errorObj && (errorObj as { state?: string }).state === 'SERVER_ERROR') {
              logger.log('Detectado error de servidor AWS:', error);
              errorMessage = 'Error en el servidor de verificación AWS.';
              shouldRetry = true;
            }
            else if (errorStr.includes('region') || errorStr.includes('identity pool')) {
              errorMessage = 'Error de configuración de AWS. Verifique las variables de entorno.';
              logger.error('❌ Error de configuración AWS:', error);
            }
            // Si el error está vacío, probablemente es un timeout
            else if (errorStr === '{}' || errorStr === '[object Object]') {
              logger.log('⏱️ Error vacío detectado - probablemente TIMEOUT');
              errorMessage = 'Tiempo agotado';
              shouldRetry = true;
              isTimeout = true;
            }
            else if (typeof error === 'object') {
              errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error));
            } else {
              errorMessage = errorStr;
            }
          } catch (parseError) {
            logger.error('Error al procesar el error:', parseError);
            errorMessage = 'Error no serializable';
          }
          
          // Decidir si reintentar automáticamente
          if (shouldRetry || isTimeout) {
            logger.log('⏳ Reintentando automáticamente después de error/timeout...');
            
            // Mensaje específico para TIMEOUT
            if (isTimeout) {
              logger.log('⏱️ TIMEOUT detectado - verificando timeouts consecutivos');
              
              // Verificar timeouts consecutivos
              const newTimeoutCount = consecutiveTimeouts + 1;
              setConsecutiveTimeouts(newTimeoutCount);
              
              if (newTimeoutCount >= MAX_CONSECUTIVE_TIMEOUTS) {
                // Después de X timeouts, entrar en modo espera
                logger.log(`🛑 ${newTimeoutCount} timeouts consecutivos detectados. Entrando en modo espera.`);
                setIsWaitingMode(true);
                setIsLoading(false);
                setError(null);
                return; // NO reintentar automáticamente
              }
              
              setError('⏱️ Tiempo agotado. Preparando nueva verificación...');
            } else {
              logger.log('🔄 Error recuperable - reintentando automáticamente');
              setError('🔄 Reintentando verificación automáticamente...');
            }
            
            // No llamar a onError para errores recuperables - reintentar silenciosamente
            // Cancelar cualquier reintento anterior antes de programar uno nuevo
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            retryTimeoutRef.current = setTimeout(() => {
              setError(null);
              retryTimeoutRef.current = null;
              createNewSession(0);
            }, 3000);
          } else {
            // Solo para errores NO recuperables
            logger.error('🔍 Error NO recuperable en la verificación de presencia:', {
              error,
              errorType: typeof error,
              errorKeys: error ? Object.keys(error) : [],
              errorMessage,
              shouldRetry
            });
            
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
        disableStartScreen={true}
        components={{
          PhotosensitiveWarning: () => null,
        }}
        displayText={{
          hintCenterFaceText: 'Centre su rostro',
          hintTooManyFacesText: 'Asegúrese de que solo aparezca un rostro',
          hintFaceDetectedText: 'Rostro detectado',
          hintCanNotIdentifyText: 'Muévase para que podamos ver su rostro claramente',
          hintTooCloseText: 'Aléjese un poco',
          hintTooFarText: 'Acérquese más',
          hintConnectingText: 'Conectando...',
          hintVerifyingText: 'Verificando...',
          hintIlluminationTooBrightText: 'Muévase a un lugar con menos luz',
          hintIlluminationTooDarkText: 'Muévase a un lugar con más luz',
          hintIlluminationNormalText: 'Iluminación correcta',
          hintHoldFaceForFreshnessText: 'Mantenga la posición',
          hintMoveFaceFrontOfCameraText: 'Colóquese frente a la cámara',
          hintMatchIndicatorText: 'Verificación en progreso...',
          cameraMinSpecificationsHeadingText: 'Requisitos mínimos de la cámara no cumplidos',
          cameraMinSpecificationsMessageText: 'Su cámara no cumple con los requisitos mínimos. Por favor, use una cámara con mejor resolución.',
          cameraNotFoundHeadingText: 'No se encontró cámara',
          cameraNotFoundMessageText: 'No se detectó ninguna cámara. Por favor, conecte una cámara y vuelva a intentarlo.',
          a11yVideoLabelText: 'Video en vivo de verificación facial',
          cancelLivenessCheckText: 'Cancelar verificación',
          goodFitCaptionText: 'Posición correcta',
          tooFarCaptionText: 'Demasiado lejos',
          hintCenterFaceInstructionText: 'Centre su rostro dentro del óvalo',
          startScreenBeginCheckText: 'Iniciar verificación de video',
          waitingCameraPermissionText: 'Esperando permisos de la cámara',
          recordingIndicatorText: 'Grabando',
          retryCameraPermissionsText: 'Reintentar',
          errorLabelText: 'Error',
          timeoutHeaderText: 'Tiempo Agotado',
          timeoutMessageText: 'No se completó la verificación a tiempo. Manténgase frente a la cámara y siga las instrucciones. Reintentando automáticamente...',
          faceDistanceHeaderText: 'Distancia incorrecta',
          faceDistanceMessageText: 'Por favor, ajuste su distancia a la cámara.',
          multipleFacesHeaderText: 'Múltiples rostros detectados',
          multipleFacesMessageText: 'Asegúrese de que solo aparezca un rostro en la cámara.',
          clientHeaderText: 'Error del cliente',
          clientMessageText: 'Ha ocurrido un error. Por favor, intente nuevamente.',
          serverHeaderText: 'Error del servidor',
          serverMessageText: 'No se pudo procesar su solicitud. Por favor, intente más tarde.',
          landscapeHeaderText: 'Orientación no soportada',
          landscapeMessageText: 'Por favor, gire su dispositivo a modo vertical.',
          portraitMessageText: 'Por favor, mantenga su dispositivo en modo vertical.',
          tryAgainText: 'Intentar nuevamente'
        }}
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

        /* Ocultar botón de cerrar (X) */
        [data-testid="close-icon"],
        [aria-label="Close"],
        .amplify-button--link[aria-label*="Cancel"],
        .amplify-button--link[aria-label*="Cancelar"],
        button[aria-label*="cancel" i],
        button[aria-label*="cancelar" i],
        button[aria-label*="close" i],
        button[aria-label*="cerrar" i] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        /* Ocultar el botón X específico del componente de Amplify */
        .amplify-liveness__cancel-button,
        .amplify-button--close {
          display: none !important;
        }

        /* OCULTAR COMPLETAMENTE el indicador "Grabando" para evitar sobreposición */
        [data-testid="recording-indicator"],
        .amplify-liveness__recording-indicator,
        .amplify-liveness-recording-indicator,
        .amplify-liveness__stream-text,
        [class*="recording"],
        [class*="Recording"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          pointer-events: none !important;
        }

        /* Ocultar cualquier elemento que contenga el texto "Grabando" o "Recording" */
        div:has-text("Grabando"),
        div:has-text("Recording"),
        span:has-text("Grabando"),
        span:has-text("Recording") {
          display: none !important;
        }

        /* Ajustar el contenedor de instrucciones para mejor visibilidad y evitar superposiciones */
        .amplify-liveness__hint-container,
        .amplify-liveness-hint-container {
          background-color: rgba(0, 0, 0, 0.8) !important;
          padding: 12px 20px !important;
          border-radius: 12px !important;
          margin: 20px auto !important;
          max-width: 85% !important;
          text-align: center !important;
          position: relative !important;
          z-index: 100 !important;
        }

        /* Mejorar la visibilidad del texto de instrucciones con tamaño reducido */
        .amplify-liveness__hint-text,
        .amplify-liveness-hint-text {
          font-size: 16px !important;
          font-weight: 600 !important;
          color: #ffffff !important;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6) !important;
          line-height: 1.3 !important;
          letter-spacing: 0.3px !important;
        }

        /* Forzar ocultar elementos con posicionamiento absoluto en la parte superior */
        .amplify-liveness-detector > div > div:first-child {
          position: relative !important;
        }

        .amplify-liveness-detector [style*="position: absolute"][style*="top"] {
          display: none !important;
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
