import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { searchFacesByImage } from "@/lib/rekognition";

export async function POST(request: Request) {
  try {
    const { imageData, type } = await request.json();

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

    // Buscar rostro en la colección
    const searchResults = await searchFacesByImage(imageData);

    if (!searchResults || !searchResults.faceId) {
      return NextResponse.json(
        { 
          error: "No se pudo identificar al empleado con la imagen proporcionada",
          status: "FACE_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    // Buscar empleado asociado al rostro
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("face_data", searchResults.faceId)
      .single();

    if (empError || !employee) {
      console.error("Error al buscar empleado:", empError);
      return NextResponse.json(
        { error: "No se encontró el empleado asociado a este rostro" },
        { status: 404 }
      );
    }

    // Obtener último registro para verificar si el tipo es válido
    const { data: lastLog, error: lastLogError } = await supabase
      .from("access_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    let autoCloseGenerated = false;

    // Si hay un registro previo del mismo tipo (salvo el primer registro)
    if (lastLog && !lastLogError && lastLog.type === type) {
      const tipoAcceso = type === 'check_in' ? 'entrada' : 'salida';
      const tipoOpuesto = type === 'check_in' ? 'salida' : 'entrada';
      const lastTimestamp = new Date(lastLog.timestamp).toLocaleString('es-CO', {
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

    // Si hay una entrada sin salida de un día anterior, generar salida automática
    if (lastLog && lastLog.type === "check_in" && type === "check_in") {
      const lastLogDate = new Date(lastLog.timestamp);
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      if (lastLogDate < todayStart) {
        // Registrar salida automática para el día anterior
        const closingTime = new Date(
          lastLogDate.getFullYear(),
          lastLogDate.getMonth(),
          lastLogDate.getDate(),
          23, 59, 59
        );
        
        await supabase.from("access_logs").insert({
          employee_id: employee.id,
          timestamp: closingTime.toISOString(),
          type: "check_out",
          auto_generated: true
        });
        
        autoCloseGenerated = true;
      }
    }

    // Registrar nuevo acceso
    const now = new Date();
    const { error: logError } = await supabase
      .from("access_logs")
      .insert({
        employee_id: employee.id,
        timestamp: now.toISOString(),
        type: type,
        auto_generated: false
      });

    if (logError) {
      console.error("Error al registrar acceso:", logError);
      return NextResponse.json(
        { error: "Error al registrar el acceso en la base de datos" },
        { status: 500 }
      );
    }

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
    console.error("Error en API de registro de acceso:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 