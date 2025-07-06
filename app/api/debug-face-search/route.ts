import { NextResponse } from 'next/server';
import { searchFacesByImage } from '@/lib/rekognition';
import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase Admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { imageData } = await request.json();

    if (!imageData) {
      return NextResponse.json({
        ok: false,
        error: 'Se requiere imageData'
      }, { status: 400 });
    }

    console.log('🔍 Iniciando debug de búsqueda facial...');
    
    // 1. Verificar empleados en la BD
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('*');
    
    console.log('👥 Empleados en BD:', employees?.length || 0);
    if (employees && employees.length > 0) {
      console.log('📋 Primer empleado:', {
        id: employees[0].id,
        name: employees[0].name,
        employee_id: employees[0].employee_id,
        face_data: employees[0].face_data
      });
    }

    // 2. Buscar rostro en AWS Rekognition
    console.log('🔎 Buscando rostro en AWS Rekognition...');
    const searchResults = await searchFacesByImage(imageData);
    
    console.log('📊 Resultado de búsqueda:', searchResults);

    if (!searchResults || !searchResults.faceId) {
      return NextResponse.json({
        ok: false,
        message: 'No se encontró rostro en AWS Rekognition',
        debug: {
          employees_count: employees?.length || 0,
          employees: employees,
          search_results: searchResults
        }
      });
    }

    // 3. Buscar empleado por face_data
    console.log('🔍 Buscando empleado con face_data:', searchResults.faceId);
    const { data: employee, error: empFindError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('face_data', searchResults.faceId)
      .single();

    console.log('👤 Empleado encontrado:', employee);
    console.log('❌ Error al buscar empleado:', empFindError);

    return NextResponse.json({
      ok: true,
      debug: {
        employees_in_db: employees?.length || 0,
        employees_list: employees,
        aws_search_results: searchResults,
        employee_found: employee,
        employee_search_error: empFindError
      }
    });

  } catch (error) {
    console.error('💥 Error en debug:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      details: error instanceof Error ? error.stack : 'Sin detalles'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Obtener todos los empleados
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('*');

    return NextResponse.json({
      ok: true,
      employees_count: employees?.length || 0,
      employees: employees,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 