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
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "No tiene permisos para ver el historial" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const accessLogId = url.searchParams.get("accessLogId");

    if (!accessLogId) {
      return NextResponse.json(
        { error: "Se requiere el ID del registro de acceso" },
        { status: 400 }
      );
    }

    // Verificar que el registro pertenece a la organización del admin
    const { data: log } = await supabaseAdmin
      .from("access_logs")
      .select("employees!inner(organization_id)")
      .eq("id", accessLogId)
      .single();

    const employeeData = log ? (Array.isArray(log.employees) ? log.employees[0] : log.employees) : null;
    if (!log || employeeData?.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 }
      );
    }

    const { data: edits, error: editsError } = await supabaseAdmin
      .from("access_log_edits")
      .select("*, users!access_log_edits_admin_user_id_fkey(full_name, email)")
      .eq("access_log_id", accessLogId)
      .order("created_at", { ascending: false });

    if (editsError) {
      console.error("Error al obtener historial:", editsError);
      return NextResponse.json(
        { error: "Error al obtener el historial de ediciones" },
        { status: 500 }
      );
    }

    const history = (edits || []).map((edit) => {
      const adminData = Array.isArray(edit.users) ? edit.users[0] : edit.users;
      return {
        id: edit.id,
        previousTimestamp: edit.previous_timestamp,
        newTimestamp: edit.new_timestamp,
        reason: edit.reason,
        evidenceUrl: edit.evidence_url,
        createdAt: edit.created_at,
        adminName: adminData?.full_name || adminData?.email || "Admin",
      };
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error en historial de ediciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
