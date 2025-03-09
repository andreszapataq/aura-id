import { NextResponse } from 'next/server';
import { indexFace, checkFaceExists } from '@/lib/rekognition';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Verificar si se está forzando el registro
    const url = new URL(request.url);
    const forceRegister = url.searchParams.get('force') === 'true';
    
    if (forceRegister) {
      console.log("Se está forzando el registro a pesar de posibles coincidencias");
    }
    
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

    // Verificar si el rostro ya existe en la colección (solo si no se está forzando el registro)
    if (!forceRegister) {
      try {
        console.log("Verificando si el rostro ya existe en el sistema...");
        const existingFace = await checkFaceExists(imageData);
        
        if (existingFace) {
          console.log(`Se encontró un rostro similar con ID: ${existingFace.faceId}, similaridad: ${existingFace.similarity}%`);
          
          // Si la similitud es muy alta (>= 90%), bloquear el registro
          if (existingFace.similarity && existingFace.similarity >= 90) {
            console.log(`Similitud muy alta (${existingFace.similarity}%), verificando información del empleado...`);
            
            // Buscar información del empleado asociado al rostro
            const { data: employeeData } = await supabase
              .from("employees")
              .select("*")
              .eq("face_data", existingFace.faceId)
              .single();
            
            if (employeeData) {
              console.log(`El rostro ya está registrado para el empleado: ${employeeData.name} (ID: ${employeeData.employee_id})`);
              return NextResponse.json({
                ok: false,
                error: 'Rostro ya registrado',
                message: `Este rostro ya está registrado como ${employeeData.name} (ID: ${employeeData.employee_id})`,
                employeeData,
                similarity: existingFace.similarity,
                faceId: existingFace.faceId
              }, { status: 409 });
            } else {
              // Verificar si hay algún empleado en la base de datos
              const { count } = await supabase
                .from("employees")
                .select("*", { count: 'exact', head: true });
              
              // Si no hay empleados en la base de datos, es probable que sea un rostro huérfano
              if (count === 0) {
                console.log("No hay empleados en la base de datos, pero se encontró un rostro similar en AWS. Posible rostro huérfano.");
                return NextResponse.json({
                  ok: false,
                  error: 'Rostro huérfano detectado',
                  message: `Se detectó un rostro similar en AWS Rekognition, pero no hay empleados registrados en la base de datos. Posible desincronización. Se recomienda limpiar la colección.`,
                  similarity: existingFace.similarity,
                  faceId: existingFace.faceId,
                  isOrphan: true
                }, { status: 409 });
              }
              
              // Incluso si no encontramos el empleado, si la similitud es muy alta, bloqueamos el registro
              console.log(`No se encontró información del empleado, pero la similitud es muy alta (${existingFace.similarity}%)`);
              return NextResponse.json({
                ok: false,
                error: 'Rostro similar detectado',
                message: `Se detectó un rostro muy similar en el sistema (Similitud: ${Math.round(existingFace.similarity)}%)`,
                similarity: existingFace.similarity,
                faceId: existingFace.faceId
              }, { status: 409 });
            }
          }
          
          // Para similitudes menores, mostrar advertencia pero permitir continuar
          console.log(`Similitud moderada (${existingFace.similarity}%), mostrando advertencia pero permitiendo continuar`);
        } else {
          console.log("No se encontraron rostros similares en la colección");
        }
      } catch (error) {
        console.error("Error al verificar rostro existente:", error);
        // No retornamos error aquí para permitir continuar con el proceso
      }
    } else {
      console.log("Omitiendo verificación de rostro existente debido a registro forzado");
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
          });

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
        message: forceRegister 
          ? "Empleado registrado exitosamente (registro forzado)" 
          : "Empleado registrado exitosamente",
        forced: forceRegister
      });
    } catch (error: unknown) {
      console.error("Error al indexar rostro:", error);
      return NextResponse.json(
        { 
          message: "Error al indexar rostro", 
          details: error instanceof Error ? error.message : "Error desconocido" 
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Error general:", error);
    return NextResponse.json(
      { 
        message: "Error en el servidor", 
        details: error instanceof Error ? error.message : "Error desconocido" 
      },
      { status: 500 }
    );
  }
} 