import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const employeeId = url.searchParams.get("employeeId");

    console.log("🔍 API: Obteniendo reportes...");
    console.log("📅 API: Rango de fechas:", { startDate, endDate });
    console.log("👤 API: Empleado seleccionado:", employeeId);

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Se requieren fechas de inicio y fin" },
        { status: 400 }
      );
    }

    // Crear fechas con zona horaria de Colombia (UTC-5)
    const startDateTime = new Date(`${startDate}T00:00:00.000-05:00`);
    const endDateTime = new Date(`${endDate}T23:59:59.999-05:00`);
    
    // Convertir a ISO strings para la consulta
    const startISO = startDateTime.toISOString();
    const endISO = endDateTime.toISOString();

    console.log("🕐 API: Fechas convertidas:", { 
      startISO, 
      endISO, 
      startLocal: startDateTime.toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      endLocal: endDateTime.toLocaleString("es-CO", { timeZone: "America/Bogota" })
    });

    let query = supabaseAdmin
      .from("access_logs")
      .select(`
        id,
        timestamp,
        type,
        auto_generated,
        employee_id,
        employees!inner (
          name,
          employee_id
        )
      `)
      .gte("timestamp", startISO)
      .lte("timestamp", endISO)
      .order("timestamp", { ascending: false });

    // Aplicar filtro de empleado si está seleccionado
    if (employeeId && employeeId !== "all") {
      query = query.eq("employee_id", employeeId);
    }

    console.log("🔎 API: Ejecutando consulta...");
    const { data: logs, error: logsError } = await query;

    console.log("📊 API: Resultado consulta:", { logs, logsError });
    console.log("📈 API: Cantidad de registros:", logs?.length || 0);

    if (logsError) {
      console.error("❌ API: Error en consulta:", logsError);
      return NextResponse.json(
        { error: "Error al obtener registros de acceso" },
        { status: 500 }
      );
    }

    // Transformar los datos
    const reportData = logs.map(log => {
      // Manejar employees como array y tomar el primer elemento
      const employeeData = Array.isArray(log.employees) ? log.employees[0] : log.employees;
      
      return {
        id: log.id,
        name: employeeData ? employeeData.name : "Desconocido",
        employeeId: employeeData ? employeeData.employee_id : "N/A",
        timestamp: log.timestamp,
        type: log.type === "check_in" ? "Entrada" : "Salida",
        auto_generated: log.auto_generated
      };
    });

    console.log("✅ API: Datos procesados:", reportData.length);
    return NextResponse.json({ reports: reportData });
  } catch (error) {
    console.error("💥 API: Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 