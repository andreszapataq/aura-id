import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
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
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Usuario sin organización" }, { status: 403 });
    }

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
      .eq("employees.organization_id", profile.organization_id)
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