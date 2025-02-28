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
    // Validar la solicitud
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("Error al parsear el cuerpo de la solicitud:", error);
      return NextResponse.json({
        ok: false,
        error: 'Formato de solicitud inválido',
        details: { message: 'No se pudo parsear el cuerpo de la solicitud como JSON' }
      }, { status: 400 });
    }

    const { sessionId } = body;

    if (!sessionId) {
      console.error("Solicitud sin sessionId");
      return NextResponse.json({
        ok: false,
        error: 'Se requiere sessionId',
        details: { message: 'El campo sessionId es obligatorio' }
      }, { status: 400 });
    }

    console.log("Evaluando sesión de liveness:", sessionId);
    
    // Obtener resultados de la sesión de AWS Rekognition
    let response;
    try {
      const command = new GetFaceLivenessSessionResultsCommand({
        SessionId: sessionId
      });
      
      response = await rekognition.send(command);
    } catch (error) {
      console.error("Error al obtener resultados de AWS Rekognition:", error);
      return NextResponse.json({
        ok: false,
        error: 'Error al obtener resultados de AWS Rekognition',
        details: error instanceof Error ? { 
          message: error.message,
          name: error.name
        } : { message: 'Error desconocido' }
      }, { status: 500 });
    }
    
    console.log("Resultados de la sesión:", {
      status: response.Status,
      confidence: response.Confidence,
      hasReferenceImage: !!response.ReferenceImage,
      referenceImageBytes: response.ReferenceImage ? !!response.ReferenceImage.Bytes : false
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
    
    // Verificar si tenemos una imagen de referencia
    if (!response.ReferenceImage || !response.ReferenceImage.Bytes) {
      console.error("No se encontró imagen de referencia o está vacía:", {
        hasReferenceImage: !!response.ReferenceImage,
        hasBytes: response.ReferenceImage ? !!response.ReferenceImage.Bytes : false
      });
      
      // A pesar de no tener imagen de referencia, si el estado es SUCCEEDED, 
      // devolvemos una respuesta exitosa con un indicador para capturar la imagen en el cliente
      if (response.Status === 'SUCCEEDED') {
        console.log("Sesión exitosa pero sin imagen de referencia. Solicitando captura de imagen en el cliente.");
        return NextResponse.json({
          ok: true,
          status: response.Status,
          confidence: response.Confidence,
          captureImageInClient: true,
          error: null
        });
      }
      
      return NextResponse.json({
        ok: false,
        status: response.Status,
        confidence: response.Confidence,
        error: 'No se encontró imagen de referencia o está vacía'
      });
    }
    
    // Verificar el tipo de datos de ReferenceImage.Bytes
    const bytesType = typeof response.ReferenceImage.Bytes;
    let bytesLength = 0;
    let processedImage = '';
    
    console.log("Tipo de datos de ReferenceImage.Bytes:", bytesType);
    
    // Procesar la imagen según su tipo
    try {
      if (bytesType === 'string') {
        const strBytes = response.ReferenceImage.Bytes as unknown as string;
        bytesLength = strBytes.length;
        processedImage = strBytes;
      } else if (response.ReferenceImage.Bytes instanceof Uint8Array) {
        const bytes = response.ReferenceImage.Bytes as Uint8Array;
        bytesLength = bytes.length;
        processedImage = Buffer.from(bytes).toString('base64');
      } else if (Buffer.isBuffer(response.ReferenceImage.Bytes)) {
        const bytes = response.ReferenceImage.Bytes as Buffer;
        bytesLength = bytes.length;
        processedImage = bytes.toString('base64');
      } else {
        console.error("Formato de imagen no reconocido:", bytesType);
        return NextResponse.json({
          ok: false,
          error: `Formato de imagen no reconocido: ${bytesType}`,
          details: { bytesType }
        });
      }
    } catch (error) {
      console.error("Error al procesar la imagen:", error);
      return NextResponse.json({
        ok: false,
        error: 'Error al procesar la imagen de referencia',
        details: error instanceof Error ? { message: error.message } : { message: 'Error desconocido' }
      });
    }
    
    console.log("Longitud de los bytes de la imagen:", bytesLength);
    
    // Verificar que la imagen no esté vacía
    if (bytesLength === 0 || !processedImage) {
      console.error("Imagen de referencia vacía");
      return NextResponse.json({
        ok: false,
        error: 'Imagen de referencia vacía',
        details: { bytesLength, hasProcessedImage: !!processedImage }
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
    
    // Respuesta exitosa
    return NextResponse.json({
      ok: true,
      status: response.Status,
      confidence: response.Confidence,
      referenceImage: {
        Bytes: processedImage
      },
      imageInfo: {
        type: bytesType,
        length: bytesLength,
        format: processedImage.startsWith('/9j/') ? 'jpeg' : 'unknown'
      }
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