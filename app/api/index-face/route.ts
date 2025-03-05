import { NextResponse } from 'next/server';
import { indexFace } from '@/lib/rekognition';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Validar la solicitud
    let body;
    try {
      body = await request.json();
      console.log("Datos recibidos en la solicitud:", {
        hasImageData: !!body.imageData,
        imageDataLength: body.imageData ? body.imageData.length : 0,
        employeeId: body.employeeId,
        name: body.name,
        allFields: Object.keys(body)
      });
    } catch (error) {
      console.error("Error al parsear el cuerpo de la solicitud:", error);
      return NextResponse.json({
        ok: false,
        error: 'Formato de solicitud inválido',
        details: { message: 'No se pudo parsear el cuerpo de la solicitud como JSON' }
      }, { status: 400 });
    }
    
    // Extraer y validar campos requeridos
    const { imageData, employeeId, name } = body;

    // Verificar todos los campos requeridos
    const missingFields = [];
    if (!imageData) missingFields.push('imageData');
    if (!employeeId) missingFields.push('employeeId');
    if (!name) missingFields.push('name');

    if (missingFields.length > 0) {
      console.error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
      return NextResponse.json({
        ok: false,
        error: 'Faltan campos requeridos',
        details: { 
          message: `Los siguientes campos son obligatorios: ${missingFields.join(', ')}`,
          missingFields
        }
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
      
      // Guardar datos del empleado en Supabase
      try {
        console.log("Intentando guardar en Supabase:", {
          name,
          employee_id: employeeId,
          face_data: faceId
        });
        
        const { error: insertError } = await supabase
          .from("employees")
          .insert({
            name,
            employee_id: employeeId,
            face_data: faceId,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error al guardar en Supabase:", {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          });
          
          // Si el error es de duplicación de ID de empleado
          if (insertError.code === "23505") {
            return NextResponse.json(
              { message: `El ID de empleado ${employeeId} ya está registrado en el sistema` },
              { status: 409 }
            );
          }
          
          return NextResponse.json(
            { message: "Error al guardar en la base de datos", details: insertError },
            { status: 500 }
          );
        }
        
        console.log("Datos guardados exitosamente en Supabase");
      } catch (dbError) {
        console.error("Error al interactuar con la base de datos:", dbError);
        return NextResponse.json({
          ok: false,
          error: 'Error al guardar en la base de datos',
          details: dbError instanceof Error ? { message: dbError.message } : { message: 'Error desconocido' }
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        faceId,
        employee: {
          id: employeeId,
          name: name,
          registeredAt: new Date().toISOString()
        },
        message: "Empleado registrado exitosamente"
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