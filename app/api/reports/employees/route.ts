import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
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

    console.log("🔍 API: Obteniendo empleados para organización:", profile.organization_id);
    
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, employee_id")
      .eq("organization_id", profile.organization_id)
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