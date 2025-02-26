"use client"

import { useState, useEffect, useCallback } from 'react';
import { Amplify } from 'aws-amplify';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';
import '@aws-amplify/ui-react-liveness/styles.css';

// Reemplázala con esta configuración mínima
Amplify.configure({
  aws_cognito_identity_pool_id: process.env.NEXT_PUBLIC_AWS_IDENTITY_POOL_ID,
  aws_project_region: process.env.NEXT_PUBLIC_AWS_REGION,
});

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
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Función para crear una nueva sesión
  const createNewSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSessionUrl(null);
    
    try {
      // If we've exceeded max retries, show a more permanent error
      if (retryCount >= MAX_RETRIES) {
        setError('Se ha excedido el número máximo de intentos. Por favor, inténtelo más tarde.');
        setIsLoading(false);
        return;
      }
      
      console.log('Intentando crear sesión de liveness...');
      
      const response = await fetch('/api/liveness/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      // Log the response status for debugging
      console.log('Estado de respuesta:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error en la respuesta de la API:', errorText);
        throw new Error(`Error en la respuesta: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Sesión creada con éxito:', data.sessionId);
      
      if (!data.sessionId) {
        throw new Error('No se recibió ID de sesión en la respuesta');
      }
      
      setSessionId(data.sessionId);
      // Reset retry count on success
      setRetryCount(0);
    } catch (error) {
      console.error('Error detallado al crear la sesión:', error);
      
      // Provide more specific error message based on the error
      let errorMessage = 'Error al crear la sesión de verificación';
      
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      
      setError(errorMessage);
      onError(error instanceof Error ? error : new Error('Error desconocido'));
      
      // Automatically retry after a delay for certain errors
      if (retryCount < MAX_RETRIES) {
        console.log(`Reintentando en 5 segundos (intento ${retryCount + 1} de ${MAX_RETRIES})...`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setIsLoading(true);
          createNewSession();
        }, 5000);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onError, retryCount, MAX_RETRIES]);

  // Crear sesión al montar el componente
  useEffect(() => {
    createNewSession();
  }, [createNewSession]);

  const handleAnalysisComplete = async (result: { sessionId: string }) => {
    try {
      console.log('Análisis completado con sessionId:', result.sessionId);
      if (result.sessionId) {
        // Verificar el resultado de la sesión
        const response = await fetch('/api/liveness/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            sessionId: result.sessionId 
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error en la respuesta de la API:', errorText);
          throw new Error(`Error en la respuesta: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Datos de evaluación recibidos:', data);
        
        // Si la sesión está en estado CREATED, mostrar el enlace para completarla
        if (data.status === 'CREATED' && data.sessionUrl) {
          setSessionUrl(data.sessionUrl);
          setError('La sesión de verificación no ha sido completada. Por favor, complete el proceso siguiendo el enlace proporcionado.');
          return;
        }
        
        if (data.ok && data.referenceImage) {
          // Convertir la imagen de referencia a formato base64
          const referenceImage = `data:image/jpeg;base64,${data.referenceImage.Bytes}`;
          onSuccess(referenceImage, result.sessionId);
        } else {
          console.error('Datos de evaluación inválidos:', data);
          setError(data.error || 'La verificación de presencia falló');
          throw new Error(data.error || 'La verificación de presencia falló');
        }
      } else {
        throw new Error('No se recibió ID de sesión');
      }
    } catch (error) {
      console.error('Error en handleAnalysisComplete:', error);
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
          onClick={createNewSession}
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
          onClick={createNewSession}
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
          onClick={createNewSession}
          className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Intentar nuevamente
        </button>
      </div>
    );
  }

  return (
    <div className="liveness-container">
      <FaceLivenessDetector
        sessionId={sessionId}
        region={'us-east-1'}
        onAnalysisComplete={() => {
          console.log('onAnalysisComplete llamado con sessionId:', sessionId);
          return Promise.resolve(handleAnalysisComplete({ sessionId: sessionId || '' }));
        }}
        onError={(error) => {
          // Intentar extraer información útil del error
          let errorMessage = 'Desconocido';
          
          try {
            if (error) {
              // Intentar convertir el error a string JSON si es posible
              if (typeof error === 'object') {
                errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error));
                
                // Manejo específico para SERVER_ERROR
                if (error.state === 'SERVER_ERROR') {
                  console.log('Detectado error de servidor AWS:', error);
                  errorMessage = 'Error en el servidor de verificación. Por favor, espere mientras reintentamos automáticamente.';
                  
                  // Reintentar automáticamente después de un error de servidor
                  setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                    createNewSession();
                  }, 3000);
                  
                  // Retornar temprano para evitar mostrar el mensaje de error
                  setError('Reintentando verificación automáticamente...');
                  return Promise.resolve();
                }
              } else {
                errorMessage = String(error);
              }
            }
          } catch {
            errorMessage = 'Error no serializable';
          }
          
          console.error('Error detallado en la verificación de presencia:', {
            error,
            errorType: typeof error,
            errorKeys: error ? Object.keys(error) : [],
            errorMessage
          });
          
          // Verificar si es un error vacío o un error de servidor genérico
          if (errorMessage === '{}' || errorMessage.includes('SERVER_ERROR')) {
            errorMessage = 'Error en el servidor de verificación. Reintentando automáticamente...';
            
            // Reintentar automáticamente después de un error de servidor genérico
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              createNewSession();
            }, 5000);
            
            setError('Reintentando verificación automáticamente...');
          } else {
            setError(`Error en la verificación de presencia: ${errorMessage}`);
          }
          
          onError(new Error(`Error en la verificación de presencia: ${errorMessage}`));
          return Promise.resolve();
        }}
        onUserCancel={() => {
          console.log('Usuario canceló la verificación');
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
      <style jsx>{`
        .liveness-container {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          border-radius: 8px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
} 