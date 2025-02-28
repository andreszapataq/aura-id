import { NextResponse } from 'next/server';
import { indexFace } from '@/lib/rekognition';

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
    
    const { imageData, employeeId } = body;

    // Validar parámetros
    if (!imageData) {
      console.error("Falta imageData en la solicitud");
      return NextResponse.json({
        ok: false,
        error: 'Se requiere imageData',
        details: { message: 'El campo imageData es obligatorio' }
      }, { status: 400 });
    }

    if (!employeeId) {
      console.error("Falta employeeId en la solicitud");
      return NextResponse.json({
        ok: false,
        error: 'Se requiere employeeId',
        details: { message: 'El campo employeeId es obligatorio' }
      }, { status: 400 });
    }
    
    // Validar formato de imagen
    if (!imageData.startsWith('data:image/jpeg;base64,') && !imageData.startsWith('data:image/png;base64,')) {
      console.error("Formato de imagen no válido");
      return NextResponse.json({
        ok: false,
        error: 'Formato de imagen no válido',
        details: { 
          message: 'La imagen debe estar en formato base64 con prefijo data:image/jpeg;base64, o data:image/png;base64,',
          prefix: imageData.substring(0, 30)
        }
      }, { status: 400 });
    }
    
    // Validar tamaño de imagen
    if (imageData.length < 1000) {
      console.error("Imagen demasiado pequeña:", imageData.length, "bytes");
      return NextResponse.json({
        ok: false,
        error: 'Imagen demasiado pequeña',
        details: { 
          message: 'La imagen es demasiado pequeña para ser procesada',
          size: imageData.length
        }
      }, { status: 400 });
    }

    console.log(`Indexando rostro para empleado ${employeeId}. Tamaño de imagen: ${imageData.length} bytes`);
    
    try {
      const faceId = await indexFace(imageData, employeeId);
      
      if (!faceId) {
        console.error("No se pudo indexar el rostro: no se recibió faceId");
        return NextResponse.json({
          ok: false,
          error: 'No se pudo indexar el rostro',
          details: { message: 'No se recibió ID de rostro de AWS Rekognition' }
        }, { status: 500 });
      }
      
      console.log(`Rostro indexado exitosamente con ID: ${faceId}`);
      
      return NextResponse.json({
        ok: true,
        faceId,
      });
    } catch (error: unknown) {
      console.error("Error al indexar rostro:", error);
      
      // Tratamos el error como un objeto con propiedades name y message
      const awsError = error as { name?: string; message?: string };
      
      // Manejar errores específicos de AWS
      if (awsError.name === 'InvalidParameterException') {
        return NextResponse.json({
          ok: false,
          error: 'Parámetros inválidos para AWS Rekognition',
          details: { message: awsError.message }
        }, { status: 400 });
      }
      
      if (awsError.name === 'InvalidImageFormatException') {
        return NextResponse.json({
          ok: false,
          error: 'Formato de imagen no válido para AWS Rekognition',
          details: { message: awsError.message }
        }, { status: 400 });
      }
      
      if (awsError.name === 'ImageTooLargeException') {
        return NextResponse.json({
          ok: false,
          error: 'Imagen demasiado grande para AWS Rekognition',
          details: { message: awsError.message }
        }, { status: 400 });
      }
      
      if (awsError.name === 'AccessDeniedException') {
        return NextResponse.json({
          ok: false,
          error: 'Acceso denegado a AWS Rekognition',
          details: { message: awsError.message }
        }, { status: 403 });
      }
      
      if (awsError.name === 'ResourceNotFoundException') {
        return NextResponse.json({
          ok: false,
          error: 'Recurso no encontrado en AWS Rekognition',
          details: { message: awsError.message }
        }, { status: 404 });
      }
      
      if (awsError.name === 'ThrottlingException') {
        return NextResponse.json({
          ok: false,
          error: 'Límite de velocidad excedido en AWS Rekognition',
          details: { message: awsError.message }
        }, { status: 429 });
      }
      
      if (awsError.name === 'ProvisionedThroughputExceededException') {
        return NextResponse.json({
          ok: false,
          error: 'Capacidad aprovisionada excedida en AWS Rekognition',
          details: { message: awsError.message }
        }, { status: 429 });
      }
      
      if (awsError.name === 'FaceAlreadyExistsException') {
        return NextResponse.json({
          ok: false,
          error: 'El rostro ya existe en la colección',
          details: { message: awsError.message }
        }, { status: 409 });
      }
      
      // Error genérico
      return NextResponse.json({
        ok: false,
        error: 'Error al indexar rostro',
        details: { 
          message: awsError.message || 'Error desconocido',
          name: awsError.name || 'UnknownError'
        }
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error general en el endpoint:", error);
    
    return NextResponse.json({
      ok: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? { 
        message: error.message,
        name: error.name
      } : { message: 'Error desconocido' }
    }, { status: 500 });
  }
} 