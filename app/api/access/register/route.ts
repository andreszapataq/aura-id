import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { searchFacesByImage } from "@/lib/rekognition";

export async function POST(request: Request) {
  try {
    const { imageData, type, latitude, longitude, accuracy } = await request.json();

    console.log('🔍 INICIO REGISTRO DE ACCESO');
    console.log('📏 Tamaño de imagen recibida:', imageData ? imageData.length : 'no imageData');
    console.log('🎯 Tipo de registro:', type);
    console.log('📍 Ubicación:', latitude != null && longitude != null ? `${latitude}, ${longitude} (±${accuracy}m)` : 'no disponible');

    if (!imageData) {
      return NextResponse.json(
        { error: "Se requiere una imagen para el reconocimiento facial" },
        { status: 400 }
      );
    }

    if (!type || !["check_in", "check_out"].includes(type)) {
      return NextResponse.json(
        { error: "El tipo de registro no es válido" },
        { status: 400 }
      );
    }

    // La ubicación es obligatoria para registrar el acceso
    const lat = typeof latitude === "number" && Number.isFinite(latitude) ? latitude : null;
    const lng = typeof longitude === "number" && Number.isFinite(longitude) ? longitude : null;
    const acc = typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : null;

    if (lat === null || lng === null) {
      return NextResponse.json(
        { error: "Se requiere acceso a la ubicación para registrar el acceso. Habilite los permisos de ubicación en su navegador." },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "Las coordenadas de ubicación no son válidas" },
        { status: 400 }
      );
    }

    // Buscar rostro en la colección
    console.log('🔎 Ejecutando searchFacesByImage...');
    const searchResults = await searchFacesByImage(imageData);
    console.log('📊 Resultado de searchFacesByImage:', JSON.stringify(searchResults, null, 2));

    if (!searchResults || !searchResults.faceId) {
      console.log('❌ No se encontró faceId en searchResults');
      return NextResponse.json(
        { 
          error: "No se pudo identificar al empleado con la imagen proporcionada",
          status: "FACE_NOT_FOUND",
          debug: {
            searchResults: searchResults,
            timestamp: new Date().toISOString()
          }
        },
        { status: 404 }
      );
    }

    console.log('✅ FaceId encontrado:', searchResults.faceId);
    console.log('📈 Similitud:', searchResults.similarity);

    // Buscar empleado asociado al rostro
    console.log('🔍 Buscando empleado con face_data =', searchResults.faceId);
    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("face_data", searchResults.faceId)
      .single();

    console.log('👤 Resultado búsqueda empleado:', {
      employee: employee,
      error: empError,
      faceIdBuscado: searchResults.faceId
    });

    if (empError || !employee) {
      console.error("❌ Error al buscar empleado:", empError);
      console.log('🔍 Verificando todos los empleados en la base de datos...');
      
      // Debug: listar todos los empleados para ver qué face_data tienen
      const { data: allEmployees, error: allEmpError } = await supabaseAdmin
        .from("employees")
        .select("id, name, employee_id, face_data");
      
      console.log('📋 Todos los empleados:', allEmployees);
      console.log('❌ Error al listar empleados:', allEmpError);
      
      return NextResponse.json(
        { 
          error: "No se encontró el empleado asociado a este rostro",
          debug: {
            searchResults: searchResults,
            faceIdBuscado: searchResults.faceId,
            allEmployees: allEmployees,
            empError: empError,
            timestamp: new Date().toISOString()
          }
        },
        { status: 404 }
      );
    }

    console.log('✅ Empleado encontrado:', employee.name);

    // Obtener último registro para verificar si el tipo es válido
    const { data: lastLog, error: lastLogError } = await supabaseAdmin
      .from("access_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    let autoCloseGenerated = false;

    // Si hay una entrada sin salida de un día anterior, generar salida automática PRIMERO
    if (lastLog && lastLog.type === "check_in" && type === "check_in") {
      // Usar hora de Colombia para determinar si es un día diferente
      const timeZone = "America/Bogota";
      
      const getBogotaYMD = (dateStr: string | Date) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-CA", { timeZone }); // Devuelve YYYY-MM-DD
      };

      const lastLogDateStr = getBogotaYMD(lastLog.timestamp);
      const todayDateStr = getBogotaYMD(new Date());

      if (lastLogDateStr < todayDateStr) {
        // Registrar salida automática a las 11:59:59 PM del día del último registro
        // Construimos el timestamp con el offset de Colombia (-05:00)
        const closingTimeStr = `${lastLogDateStr}T23:59:59-05:00`;
        
        await supabaseAdmin.from("access_logs").insert({
          employee_id: employee.id,
          timestamp: new Date(closingTimeStr).toISOString(),
          type: "check_out",
          auto_generated: true
        });
        
        autoCloseGenerated = true;
        console.log('🔄 Salida automática generada a las 11:59:59 PM del día anterior (Colombia Time)');
      }
    }

    // Si hay un registro previo del mismo tipo el mismo día (después de verificar días anteriores)
    if (lastLog && !lastLogError && lastLog.type === type && !autoCloseGenerated) {
      const tipoAcceso = type === 'check_in' ? 'entrada' : 'salida';
      const tipoOpuesto = type === 'check_in' ? 'salida' : 'entrada';
      const lastTimestamp = new Date(lastLog.timestamp).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: "short",
        timeStyle: "short"
      });
      
      return NextResponse.json(
        { 
          error: `No puede registrar ${tipoAcceso} dos veces seguidas. Su último registro fue una ${tipoAcceso} el ${lastTimestamp}. Debe registrar una ${tipoOpuesto} primero.` 
        },
        { status: 400 }
      );
    }

    // Registrar nuevo acceso
    const now = new Date();
    const { error: logError } = await supabaseAdmin
      .from("access_logs")
      .insert({
        employee_id: employee.id,
        timestamp: now.toISOString(),
        type: type,
        auto_generated: false,
        latitude: lat,
        longitude: lng,
        accuracy: acc
      });

    if (logError) {
      console.error("Error al registrar acceso:", logError);
      return NextResponse.json(
        { error: "Error al registrar el acceso en la base de datos" },
        { status: 500 }
      );
    }

    console.log('✅ Acceso registrado exitosamente para:', employee.name);

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        employeeId: employee.employee_id
      },
      timestamp: now.toISOString(),
      type: type,
      autoCloseGenerated
    });
  } catch (error) {
    console.error("💥 Error en API de registro de acceso:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 