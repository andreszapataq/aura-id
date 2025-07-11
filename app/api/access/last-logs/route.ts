import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Obtener el parámetro limit de la URL
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "5", 10);
    
    // Validar que el límite sea un número razonable
    const validLimit = Math.min(Math.max(1, limit), 20); // Entre 1 y 20
    
    // Obtener los últimos registros de acceso con join manual
    const { data, error } = await supabaseAdmin
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
      .order("timestamp", { ascending: false })
      .limit(validLimit);
    
    if (error) {
      console.error("Error al obtener los registros de acceso:", error);
      return NextResponse.json(
        { error: "Error al obtener los registros de acceso" },
        { status: 500 }
      );
    }
    
    // Transformar los datos para que sean más fáciles de usar en el cliente
    const logs = data.map(log => {
      // Manejar employees como array y tomar el primer elemento
      const employeeData = Array.isArray(log.employees) ? log.employees[0] : log.employees;
      
      return {
        id: log.id,
        timestamp: log.timestamp,
        type: log.type,
        name: employeeData ? employeeData.name : "Desconocido",
        employeeId: employeeData ? employeeData.employee_id : "N/A",
        auto_generated: log.auto_generated
      };
    });
    
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error en API de últimos registros:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 