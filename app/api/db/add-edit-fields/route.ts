import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * Endpoint temporal para agregar campos de edición a la tabla access_logs
 * Este endpoint solo necesita ejecutarse UNA VEZ para actualizar la estructura de la BD
 */
export async function POST() {
  try {
    console.log('🔧 Agregando campos de edición a access_logs...');

    // Ejecutar SQL para agregar las nuevas columnas
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE access_logs 
        ADD COLUMN IF NOT EXISTS edited_by_admin BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;
      `
    });

    if (error) {
      // Si falla el RPC, intentar con una query directa
      console.log('⚠️ RPC no disponible, intentando con query directa...');
      
      // Verificar si las columnas ya existen
      const { data: columns } = await supabaseAdmin
        .from('access_logs')
        .select('*')
        .limit(1);

      if (columns && columns.length > 0) {
        const firstRow = columns[0];
        const hasEditedByAdmin = 'edited_by_admin' in firstRow;
        const hasEditedAt = 'edited_at' in firstRow;

        if (hasEditedByAdmin && hasEditedAt) {
          return NextResponse.json({
            success: true,
            message: 'Las columnas ya existen en la tabla access_logs',
            alreadyExists: true
          });
        }
      }

      // Si no podemos verificar o agregar, devolver instrucciones
      return NextResponse.json({
        success: false,
        message: 'No se pudo agregar las columnas automáticamente',
        instructions: `
Por favor, ejecuta el siguiente SQL manualmente en el panel de Supabase:

ALTER TABLE access_logs 
ADD COLUMN IF NOT EXISTS edited_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a SQL Editor
4. Copia y pega el SQL de arriba
5. Haz clic en "Run"
        `.trim(),
        error: error.message
      }, { status: 500 });
    }

    console.log('✅ Campos agregados exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Campos de edición agregados correctamente a la tabla access_logs',
      data
    });

  } catch (error) {
    console.error('💥 Error al agregar campos:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Error al agregar campos de edición',
      instructions: `
Por favor, ejecuta el siguiente SQL manualmente en el panel de Supabase:

ALTER TABLE access_logs 
ADD COLUMN IF NOT EXISTS edited_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a SQL Editor
4. Copia y pega el SQL de arriba
5. Haz clic en "Run"
      `.trim(),
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

