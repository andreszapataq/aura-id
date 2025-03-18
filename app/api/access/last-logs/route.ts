import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Obtener el parámetro limit de la URL
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "5", 10);
    
    // Validar que el límite sea un número razonable
    const validLimit = Math.min(Math.max(1, limit), 20); // Entre 1 y 20
    
    // Obtener los últimos registros de acceso
    const { data, error } = await supabase
      .from("access_logs")
      .select(`
        id,
        timestamp,
        type,
        auto_generated,
        employees (
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
      // TypeScript seguro usando tipado dinámico
      const employee = log.employees as any;
      
      return {
        id: log.id,
        timestamp: log.timestamp,
        type: log.type,
        name: employee ? employee.name : "Desconocido",
        employeeId: employee ? employee.employee_id : "N/A",
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