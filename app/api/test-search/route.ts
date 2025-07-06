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

    console.log('🔍 INICIO DE PRUEBA DE BÚSQUEDA FACIAL');
    console.log('📏 Tamaño de imagen:', imageData.length);
    
    // 1. Probar searchFacesByImage directamente
    console.log('🔎 Ejecutando searchFacesByImage...');
    const searchResults = await searchFacesByImage(imageData);
    
    console.log('📊 Resultado completo de searchFacesByImage:', JSON.stringify(searchResults, null, 2));

    // 2. Verificar el resultado
    if (!searchResults) {
      return NextResponse.json({
        ok: false,
        step: 'searchFacesByImage_null',
        message: 'searchFacesByImage devolvió null',
        search_results: searchResults
      });
    }

    if (!searchResults.faceId) {
      return NextResponse.json({
        ok: false,
        step: 'searchFacesByImage_no_faceId',
        message: 'searchFacesByImage no devolvió faceId',
        search_results: searchResults
      });
    }

    // 3. Buscar empleado en la base de datos
    console.log('🔍 Buscando empleado con faceId:', searchResults.faceId);
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('face_data', searchResults.faceId)
      .single();

    console.log('👤 Empleado encontrado:', employee);
    console.log('❌ Error de búsqueda:', empError);

    // 4. Resultado completo
    return NextResponse.json({
      ok: true,
      debug: {
        step: 'completed',
        search_results: searchResults,
        employee_found: !!employee,
        employee_data: employee,
        employee_error: empError,
        face_id_from_search: searchResults.faceId,
        similarity: searchResults.similarity
      }
    });

  } catch (error) {
    console.error('💥 Error en test-search:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : 'Sin stack'
    }, { status: 500 });
  }
} 