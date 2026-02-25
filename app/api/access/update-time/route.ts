import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function PATCH(request: Request) {
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
      .select("role, organization_id, full_name")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "No tiene permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const { logId, newTime, reason } = await request.json();

    if (!logId || !newTime) {
      return NextResponse.json(
        { error: "Se requiere el ID del registro y la nueva hora" },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "Se requiere un motivo de al menos 10 caracteres" },
        { status: 400 }
      );
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newTime)) {
      return NextResponse.json(
        { error: "Formato de hora inválido. Use HH:MM (ej: 17:30)" },
        { status: 400 }
      );
    }

    const { data: log, error: logError } = await supabaseAdmin
      .from("access_logs")
      .select("*, employees!inner(organization_id)")
      .eq("id", logId)
      .single();

    if (logError || !log) {
      return NextResponse.json(
        { error: "No se encontró el registro" },
        { status: 404 }
      );
    }

    const employeeData = Array.isArray(log.employees) ? log.employees[0] : log.employees;
    if (employeeData?.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: "No tiene permisos para editar este registro" },
        { status: 403 }
      );
    }

    const [hours, minutes] = newTime.split(":").map(Number);
    const pad = (n: number) => n.toString().padStart(2, '0');

    const timeZone = "America/Bogota";
    const originalDate = new Date(log.timestamp);

    const bogotaFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    const bogotaDateStr = bogotaFormatter.format(originalDate);
    const newTimestampStr = `${bogotaDateStr}T${pad(hours)}:${pad(minutes)}:00-05:00`;
    const newTimestamp = new Date(newTimestampStr);

    if (isNaN(newTimestamp.getTime())) {
      return NextResponse.json(
        { error: "Error al calcular la nueva fecha" },
        { status: 500 }
      );
    }

    // Insertar en tabla de auditoría ANTES de modificar el registro
    const { error: auditError } = await supabaseAdmin
      .from("access_log_edits")
      .insert({
        access_log_id: logId,
        admin_user_id: user.id,
        previous_timestamp: originalDate.toISOString(),
        new_timestamp: newTimestamp.toISOString(),
        reason: reason.trim(),
      });

    if (auditError) {
      console.error("Error al crear registro de auditoría:", auditError);
      return NextResponse.json(
        { error: "Error al registrar la auditoría del cambio" },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("access_logs")
      .update({
        timestamp: newTimestamp.toISOString(),
        edited_by_admin: true,
        edited_at: new Date().toISOString(),
        edited_by: user.id,
      })
      .eq("id", logId);

    if (updateError) {
      console.error("Error al actualizar registro:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar el registro en la base de datos" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Hora actualizada correctamente",
      newTimestamp: newTimestamp.toISOString(),
      originalTimestamp: originalDate.toISOString(),
      editedBy: profile.full_name || user.email,
    });
  } catch (error) {
    console.error("Error en actualización de hora:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
