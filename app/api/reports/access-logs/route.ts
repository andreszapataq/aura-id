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

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const employeeId = url.searchParams.get("employeeId");

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

    let query = supabaseAdmin
      .from("access_logs")
      .select(`
        id,
        timestamp,
        type,
        auto_generated,
        edited_by_admin,
        employee_id,
        employees!inner (
          name,
          employee_id
        )
      `)
      .gte("timestamp", startISO)
      .lte("timestamp", endISO)
      .order("timestamp", { ascending: false });

    // Filtrar por organización
    query = query.eq("employees.organization_id", profile.organization_id);

    // Aplicar filtro de empleado si está seleccionado
    if (employeeId && employeeId !== "all") {
      query = query.eq("employee_id", employeeId);
    }

    const { data: logs, error: logsError } = await query;

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
        auto_generated: log.auto_generated,
        edited_by_admin: log.edited_by_admin,
      };
    });

    return NextResponse.json({ reports: reportData });
  } catch (error) {
    console.error("💥 API: Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 