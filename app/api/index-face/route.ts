import { NextResponse } from 'next/server';
import { indexFace, searchFace } from '@/lib/rekognition';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { imageData, employeeId } = await request.json();
    
    if (!imageData || !employeeId) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' }, 
        { status: 400 }
      );
    }

    // Primero buscar si el rostro ya existe
    const existingFaceId = await searchFace(imageData);
    
    if (existingFaceId) {
      // Buscar los datos del empleado existente
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('name, employee_id')
        .eq('face_data', existingFaceId)
        .single();

      if (existingEmployee) {
        return NextResponse.json({
          error: 'Rostro ya registrado',
          details: {
            message: `Esta persona ya está registrada como ${existingEmployee.name} (ID: ${existingEmployee.employee_id})`
          }
        }, { status: 409 }); // 409 Conflict
      }
    }

    // Si no existe, proceder con el registro
    const faceId = await indexFace(imageData, employeeId);
    
    if (!faceId) {
      return NextResponse.json(
        { error: 'No se pudo detectar un rostro en la imagen' }, 
        { status: 400 }
      );
    }

    return NextResponse.json({ faceId });
  } catch (error) {
    console.error('Error en el registro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error en el registro' }, 
      { status: 500 }
    );
  }
} 