import { NextResponse } from 'next/server';
import { RekognitionClient, CreateFaceLivenessSessionCommand } from "@aws-sdk/client-rekognition";
import { logger } from '@/lib/logger';

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST() {
  try {
    logger.log("Creating liveness session with config:", {
      region: process.env.AWS_REGION,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
    });
    
    // Validate required environment variables
    if (!process.env.AWS_REGION) {
      throw new Error('AWS_REGION is not configured');
    }
    if (!process.env.AWS_ACCESS_KEY_ID) {
      throw new Error('AWS_ACCESS_KEY_ID is not configured');
    }
    if (!process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS_SECRET_ACCESS_KEY is not configured');
    }
    
    // Crear sesión sin configuración de almacenamiento en S3
    const command = new CreateFaceLivenessSessionCommand({
      ClientRequestToken: `session-${Date.now()}`,
      // No incluimos OutputConfig para evitar almacenar imágenes en S3
      // Configuración para Amplify
      KmsKeyId: process.env.AWS_KMS_KEY_ID, // Opcional, si usas KMS
    });
    
    const response = await rekognition.send(command);
    logger.log("Liveness session created:", response.SessionId);
    
    // Generar URL para verificación por correo
    const baseUrl = 'https://liveness.rekognition.amazonaws.com/';
    const region = process.env.AWS_REGION || 'us-east-1';
    const sessionId = response.SessionId;
    
    // Construir la URL completa para la verificación por correo
    const sessionUrl = `${baseUrl}?region=${region}&sessionId=${sessionId}`;
    
    return NextResponse.json({
      ok: true,
      sessionId: response.SessionId,
      sessionUrl: sessionUrl
    });
  } catch (error) {
    logger.error("Error creating liveness session:", error);
    
    let errorMessage = "Error desconocido";
    let errorDetails = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
    
    return NextResponse.json({
      ok: false,
      error: errorMessage,
      details: errorDetails
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 