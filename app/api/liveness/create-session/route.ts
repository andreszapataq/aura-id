import { NextResponse } from 'next/server';
import { RekognitionClient, CreateFaceLivenessSessionCommand } from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST() {
  try {
    console.log("Creating liveness session with config:", {
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_S3_BUCKET,
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
    if (!process.env.AWS_S3_BUCKET) {
      throw new Error('AWS_S3_BUCKET is not configured');
    }
    
    const command = new CreateFaceLivenessSessionCommand({
      ClientRequestToken: `session-${Date.now()}`,
      Settings: {
        OutputConfig: {
          S3Bucket: process.env.AWS_S3_BUCKET,
          S3KeyPrefix: 'liveness-sessions/'
        }
      },
      // Configuración para Amplify
      KmsKeyId: process.env.AWS_KMS_KEY_ID, // Opcional, si usas KMS
    });
    
    const response = await rekognition.send(command);
    console.log("Liveness session created:", response.SessionId);
    
    return NextResponse.json({
      ok: true,
      sessionId: response.SessionId
    });
  } catch (error) {
    console.error("Error creating liveness session:", error);
    
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