import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("🔍 API: Obteniendo empleados...");
    
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, employee_id")
      .order("name");

    console.log("📊 API: Resultado empleados:", { data, error });

    if (error) {
      console.error("❌ API: Error al obtener empleados:", error);
      return NextResponse.json(
        { error: "Error al obtener empleados" },
        { status: 500 }
      );
    }

    console.log("✅ API: Empleados obtenidos:", data?.length || 0);
    return NextResponse.json({ employees: data || [] });
  } catch (error) {
    console.error("💥 API: Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 