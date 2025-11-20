import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  props: { params: Promise<{ faceId: string }> }
) {
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

    const params = await props.params;
    const faceId = params.faceId;

    if (!faceId) {
      return NextResponse.json(
        { error: "Se requiere el ID del rostro" },
        { status: 400 }
      );
    }

    // Buscar empleado asociado al rostro y organización
    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, name, employee_id, face_data")
      .eq("face_data", faceId)
      .eq("organization_id", profile.organization_id)
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

