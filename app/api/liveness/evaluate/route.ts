import { NextResponse } from 'next/server';
import { RekognitionClient, GetFaceLivenessSessionResultsCommand } from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({
        ok: false,
        error: 'Se requiere sessionId'
      }, { status: 400 });
    }

    console.log("Evaluando sesión de liveness:", sessionId);
    
    const command = new GetFaceLivenessSessionResultsCommand({
      SessionId: sessionId
    });
    
    const response = await rekognition.send(command);
    console.log("Resultados de la sesión:", {
      status: response.Status,
      confidence: response.Confidence,
      hasReferenceImage: !!response.ReferenceImage
    });
    
    // Verificar el estado de la sesión
    if (response.Status === 'CREATED') {
      return NextResponse.json({
        ok: false,
        status: response.Status,
        error: 'La sesión de verificación no ha sido completada',
        sessionUrl: `https://facialrecognition.rekognition.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/face-liveness/?sessionId=${sessionId}&region=${process.env.AWS_REGION || 'us-east-1'}`
      });
    }
    
    if (response.Status !== 'SUCCEEDED') {
      return NextResponse.json({
        ok: false,
        status: response.Status,
        error: `La verificación de presencia falló con estado: ${response.Status}`
      });
    }
    
    if (!response.ReferenceImage) {
      return NextResponse.json({
        ok: false,
        error: 'No se encontró imagen de referencia'
      });
    }
    
    // Si la confianza es menor al umbral, rechazar
    const confidenceThreshold = 90; // 90%
    if ((response.Confidence || 0) < confidenceThreshold) {
      return NextResponse.json({
        ok: false,
        confidence: response.Confidence,
        error: `Confianza insuficiente: ${response.Confidence}%`
      });
    }
    
    return NextResponse.json({
      ok: true,
      status: response.Status,
      confidence: response.Confidence,
      referenceImage: response.ReferenceImage
    });
  } catch (error) {
    console.error("Error evaluando sesión de liveness:", error);
    
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