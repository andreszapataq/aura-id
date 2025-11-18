import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * Actualiza la hora de un registro de acceso automático
 * Solo permite editar registros que fueron generados automáticamente
 */
export async function PATCH(request: Request) {
  try {
    const { logId, newTime } = await request.json();

    console.log('🔄 Solicitud de actualización de hora:', { logId, newTime });

    if (!logId || !newTime) {
      return NextResponse.json(
        { error: "Se requiere el ID del registro y la nueva hora" },
        { status: 400 }
      );
    }

    // Validar formato de hora (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newTime)) {
      return NextResponse.json(
        { error: "Formato de hora inválido. Use HH:MM (ej: 17:30)" },
        { status: 400 }
      );
    }

    // Obtener el registro actual
    const { data: log, error: logError } = await supabaseAdmin
      .from("access_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logError || !log) {
      console.error('❌ No se encontró el registro:', logError);
      return NextResponse.json(
        { error: "No se encontró el registro" },
        { status: 404 }
      );
    }

    console.log('📋 Registro encontrado:', {
      id: log.id,
      timestamp: log.timestamp,
      auto_generated: log.auto_generated,
      type: log.type
    });

    // VALIDACIÓN CRÍTICA: Solo permitir editar registros auto-generados
    if (!log.auto_generated) {
      console.warn('⚠️ Intento de editar registro manual:', logId);
      return NextResponse.json(
        { error: "Solo se pueden editar registros generados automáticamente" },
        { status: 403 }
      );
    }

    // Parsear la hora proporcionada
    const [hours, minutes] = newTime.split(":").map(Number);

    // Crear nueva fecha manteniendo el día original pero con la nueva hora
    const originalDate = new Date(log.timestamp);
    const newTimestamp = new Date(
      originalDate.getFullYear(),
      originalDate.getMonth(),
      originalDate.getDate(),
      hours,
      minutes,
      0
    );

    console.log('⏰ Nueva fecha calculada:', {
      original: originalDate.toISOString(),
      nueva: newTimestamp.toISOString(),
      horaNueva: `${hours}:${minutes}`
    });

    // Validación: La nueva hora debe estar dentro del mismo día
    if (newTimestamp.getDate() !== originalDate.getDate() ||
        newTimestamp.getMonth() !== originalDate.getMonth() ||
        newTimestamp.getFullYear() !== originalDate.getFullYear()) {
      return NextResponse.json(
        { error: "La hora debe permanecer dentro del mismo día" },
        { status: 400 }
      );
    }

    // Actualizar el registro
    const { error: updateError } = await supabaseAdmin
      .from("access_logs")
      .update({
        timestamp: newTimestamp.toISOString(),
        edited_by_admin: true,
        edited_at: new Date().toISOString()
      })
      .eq("id", logId);

    if (updateError) {
      console.error("❌ Error al actualizar registro:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar el registro en la base de datos" },
        { status: 500 }
      );
    }

    console.log(`✅ Registro ${logId} actualizado exitosamente a ${newTime}`);

    return NextResponse.json({
      success: true,
      message: "Hora actualizada correctamente",
      newTimestamp: newTimestamp.toISOString(),
      originalTimestamp: originalDate.toISOString()
    });
  } catch (error) {
    console.error("💥 Error en actualización de hora:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

