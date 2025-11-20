import { NextResponse } from 'next/server';
import { indexFace, checkFaceExists, deleteFace } from '@/lib/rekognition';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de S3 para almacenar snapshots iniciales
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Función para guardar imagen en S3
async function saveImageToS3(imageData: string, employeeId: string): Promise<string> {
  try {
    // Extraer los datos base64 sin el prefijo
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generar una clave única para el objeto en S3
    const key = `employee-snapshots/${employeeId}/${Date.now()}.jpg`;
    
    // Configurar el comando para subir el objeto a S3
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
      ContentEncoding: 'base64',
    });
    
    // Subir el objeto a S3
    await s3Client.send(command);
    console.log(`Snapshot inicial guardado en S3: ${key}`);
    
    // Devolver la URL del objeto
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("Error al guardar imagen en S3:", error);
    throw error;
  }
}

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

    // Obtener organización del usuario actual
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    let organizationId = null;

    if (user) {
      const { data: profile } = await supabaseAdmin
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      organizationId = profile?.organization_id;
    }

    if (!organizationId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No autorizado', 
        message: 'No se pudo determinar la organización del usuario.' 
      }, { status: 403 });
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

          // Solo actuar si la similitud es muy alta (umbral ajustable, ej. 90%)
          if (existingFace.similarity && existingFace.similarity >= 90) {
            console.log(`Similitud muy alta (${existingFace.similarity}%), verificando si está asociado a empleado...`);

            // Buscar si el FaceID está asociado a un empleado en la BD
            const { data: employeeData, error: employeeError } = await supabaseAdmin
              .from("employees")
              .select("employee_id, name") // Seleccionar solo lo necesario
              .eq("face_data", existingFace.faceId)
              .maybeSingle(); // Usar maybeSingle para manejar null sin error

            if (employeeError) {
              // Loggear error pero considerar si continuar
              console.error("Error al buscar empleado por face_data:", employeeError);
              // Podrías decidir devolver un 500 aquí si es crítico
            }

            if (employeeData) {
              // --- CASO: ROSTRO ENCONTRADO Y ASOCIADO ---
              console.log(`El rostro ya está registrado para el empleado: ${employeeData.name} (ID: ${employeeData.employee_id})`);
              return NextResponse.json({
                ok: false,
                error: 'Rostro ya registrado',
                message: `Este rostro ya está registrado como ${employeeData.name} (ID: ${employeeData.employee_id})`,
                employeeData,
                similarity: existingFace.similarity,
                faceId: existingFace.faceId
              }, { status: 409 }); // 409 Conflict

            } else {
              // --- CASO: ROSTRO ENCONTRADO PERO NO ASOCIADO (HUÉRFANO) ---
              console.warn(`ROSTRO HUÉRFANO DETECTADO: FaceId ${existingFace.faceId} existe en Rekognition pero no en la BD. Intentando eliminarlo...`);
              
              // Asegurarse de que faceId existe antes de intentar eliminar
              if (!existingFace.faceId) {
                  console.error("Error crítico: Se detectó rostro huérfano pero falta FaceId.");
                  return NextResponse.json({
                    ok: false,
                    error: 'Error interno procesando rostro huérfano',
                    message: 'No se pudo obtener el ID del rostro huérfano detectado.'
                  }, { status: 500 });
              }

              try {
                // --- INTENTAR ELIMINAR EL HUÉRFANO ---
                // Ahora TypeScript sabe que existingFace.faceId es un string aquí
                const deletedIds = await deleteFace(existingFace.faceId); 

                if (deletedIds && deletedIds.length > 0 && deletedIds[0] === existingFace.faceId) {
                  console.log(`Rostro huérfano ${deletedIds[0]} eliminado exitosamente de Rekognition.`);
                  // NO retornar nada aquí. El flujo continuará fuera de este bloque `if (existingFace)`
                  // hacia la indexación del nuevo rostro.
                } else {
                  // La eliminación falló o no devolvió lo esperado
                  console.error(`No se pudo eliminar el rostro huérfano ${existingFace.faceId} de Rekognition o la respuesta fue inesperada.`);
                  // Devolver error 500 para indicar fallo en la limpieza
                  return NextResponse.json({
                    ok: false,
                    error: 'Error al limpiar rostro huérfano',
                    message: `No se pudo eliminar automáticamente el rostro huérfano ${existingFace.faceId} de AWS Rekognition. Intente de nuevo o contacte soporte.`,
                    faceId: existingFace.faceId
                  }, { status: 500 });
                }
              } catch (deleteError: unknown) {
                // Error durante la llamada a deleteFace
                const errorMessage = deleteError instanceof Error ? deleteError.message : 'Ocurrió un error interno al intentar eliminar el rostro huérfano de AWS Rekognition.';
                console.error(`Error crítico al intentar eliminar rostro huérfano ${existingFace.faceId}:`, deleteError);
                 return NextResponse.json({
                  ok: false,
                  error: 'Error al limpiar rostro huérfano',
                  message: errorMessage,
                  faceId: existingFace.faceId
                }, { status: 500 });
              }
              // Si la eliminación fue exitosa, salimos de este 'else' y continuamos el flujo normal.
            }
          } else {
             // --- CASO: SIMILITUD BAJA ---
             // Similitud no es suficientemente alta, tratar como si no existiera para el bloqueo.
             // Permitir que el flujo continúe hacia la indexación normal.
             console.log(`Similitud (${existingFace.similarity}%) por debajo del umbral de bloqueo (90%). Se tratará como rostro nuevo.`);
          }
        } else {
          // --- CASO: NO SE ENCONTRARON ROSTROS SIMILARES ---
          console.log("No se encontraron rostros similares en la colección.");
          // El flujo continuará normalmente hacia la indexación.
        }
      // Mantener el bloque catch existente para la verificación
      } catch (error: unknown) {
        console.error("Error durante la verificación de rostro existente:", error);
        const message = error instanceof Error ? error.message : 'Ocurrió un error interno al verificar si el rostro ya existe.';
         return NextResponse.json({
            ok: false,
            error: 'Error verificando rostro',
            message: message
          }, { status: 500 });
      }
    } else {
      console.log("Omitiendo verificación de rostro existente debido a registro forzado.");
    }

    // ----- Flujo de Indexación Normal ----- 
    // (Este código se ejecutará si no se encontró rostro, si la similitud era baja,
    // o si se encontró un huérfano y se eliminó exitosamente)
    console.log(`Procediendo a indexar rostro para empleado ${employeeId}...`);
    
    try {
      // Guardar el snapshot inicial en S3
      let snapshotUrl = "";
      try {
        snapshotUrl = await saveImageToS3(imageData, employeeId);
        console.log(`Snapshot inicial guardado exitosamente: ${snapshotUrl}`);
      } catch (s3Error) {
        console.error("Error al guardar snapshot inicial en S3:", s3Error);
        // Continuamos con el proceso aunque falle el guardado del snapshot
      }
      
      // Indexar el rostro en AWS Rekognition
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
        const hasSnapshot = !!snapshotUrl;
        console.log("Intentando guardar en Supabase (Admin):", { name, employeeId, faceId });

        // Usar supabaseAdmin para la inserción Y seleccionar created_at
        // Supabase insert() puede no devolver la fila completa directamente en todos los casos.
        // Primero insertamos, luego si es exitoso, podríamos hacer un select si fuera necesario,
        // pero para la fecha, a menudo la columna 'created_at' es suficiente si se define en la DB.
        const { data: insertedData, error: insertError } = await supabaseAdmin
          .from("employees")
          .insert({
            name,
            employee_id: employeeId,
            face_data: faceId,
            snapshot_url: snapshotUrl || null,
            has_snapshot: hasSnapshot,
            organization_id: organizationId
          })
          .select('created_at') // Intentar seleccionar created_at
          .single();

        if (insertError) {
          console.error("Error al guardar en Supabase (Admin):", insertError);
          // Intentar Rollback en Rekognition
          try { 
            console.warn(`Error al guardar en DB. Rollback: Eliminando rostro ${faceId} de Rekognition...`);
            await deleteFace(faceId); 
            console.log(`Rollback exitoso: Rostro ${faceId} eliminado de Rekognition.`);
          } catch (rollbackError) { 
              console.error(`Error crítico: Falló el guardado en DB y también falló el rollback de Rekognition para ${faceId}:`, rollbackError);
          }
          return NextResponse.json({ ok: false, error: 'Error al guardar empleado', message: insertError.message, details: insertError }, { status: 500 });
        }
        console.log("Datos guardados exitosamente en Supabase (Admin)", insertedData);

        // Obtener la fecha de registro ÚNICAMENTE de la base de datos
        let registeredAt: string | undefined;
        if (insertedData?.created_at && !isNaN(new Date(insertedData.created_at).getTime())) {
            // Convertir a ISO string si es una fecha válida
            registeredAt = new Date(insertedData.created_at).toISOString();
        } else {
            console.warn("No se pudo obtener o validar created_at desde Supabase. registered_at será undefined.");
            // registeredAt permanecerá undefined
        }
        console.log("Fecha de registro (desde DB o undefined):", registeredAt); 

        // ***** Respuesta exitosa final CON datos del empleado *****
        console.log(`Empleado ${employeeId} registrado exitosamente con FaceId ${faceId}.`);
        return NextResponse.json({ 
          ok: true, 
          faceId: faceId, 
          employee: { 
            employee_id: employeeId, 
            name: name,             
            // Enviar registeredAt (puede ser undefined si no se obtuvo)
            registered_at: registeredAt 
          } 
        }, { status: 200 });

      } catch (dbError: unknown) {
         console.error("Error inesperado durante el guardado en Supabase:", dbError);
         const message = dbError instanceof Error ? dbError.message : 'Error desconocido guardando en DB';
         if (faceId) { try { await deleteFace(faceId); } catch (rbErr) { console.error(`Fallo rollback de Rekognition para ${faceId} tras error de DB:`, rbErr); } }
         return NextResponse.json({ ok: false, error: 'Error interno guardando empleado', message }, { status: 500 });
      }
      
    // Catch para el bloque de indexación/guardado
    } catch (indexError: unknown) {
      console.error("Error durante la indexación del rostro o guardado en DB:", indexError);
      const message = indexError instanceof Error ? indexError.message : 'Ocurrió un error interno al procesar el registro del rostro.';
      return NextResponse.json({
        ok: false,
        error: 'Error en la indexación o registro',
        message: message
      }, { status: 500 });
    }

  // Catch general para toda la función POST
  } catch (error: unknown) {
    console.error("Error inesperado en el manejador POST /api/index-face:", error);
    const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    return NextResponse.json({
      ok: false,
      error: 'Error interno del servidor',
      message: message
    }, { status: 500 });
  }
} 