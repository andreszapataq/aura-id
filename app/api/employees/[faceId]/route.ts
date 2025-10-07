import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { faceId: string } }
) {
  try {
    const faceId = params.faceId;

    if (!faceId) {
      return NextResponse.json(
        { error: "Se requiere el ID del rostro" },
        { status: 400 }
      );
    }

    // Buscar empleado asociado al rostro
    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, name, employee_id, face_data")
      .eq("face_data", faceId)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { 
          error: "No se encontró el empleado asociado a este rostro",
          status: "EMPLOYEE_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: employee.id,
      name: employee.name,
      employeeId: employee.employee_id,
      faceData: employee.face_data
    });
  } catch (error) {
    console.error("Error al buscar empleado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

