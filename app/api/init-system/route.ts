import { NextResponse } from 'next/server';
import { createCollection } from '@/lib/rekognition';
import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase Admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function initializeSystem() {
  try {
    const results = {
      collection: { success: false, message: '' },
      database: { success: false, message: '' }
    };

    // 1. Crear colección de Rekognition
    try {
      await createCollection();
      results.collection.success = true;
      results.collection.message = 'Colección de AWS Rekognition creada exitosamente';
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.collection.success = true;
        results.collection.message = 'Colección de AWS Rekognition ya existe';
      } else {
        results.collection.message = `Error al crear colección: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      }
    }

    // 2. Verificar configuración de base de datos
    try {
      // Verificar conexión a la base de datos
      const { error: employeesError } = await supabaseAdmin
        .from('employees')
        .select('COUNT(*)')
        .limit(1);

      if (employeesError) {
        throw employeesError;
      }

      const { error: logsError } = await supabaseAdmin
        .from('access_logs')
        .select('COUNT(*)')
        .limit(1);

      if (logsError) {
        throw logsError;
      }

      results.database.success = true;
      results.database.message = 'Base de datos configurada correctamente';
    } catch (error) {
      results.database.message = `Error en base de datos: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    }

    return results;
  } catch (error) {
    console.error('Error al inicializar el sistema:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await request.json();

    console.log('Iniciando inicialización del sistema...');
    const results = await initializeSystem();

    const allSuccess = results.collection.success && results.database.success;

    return NextResponse.json({
      ok: allSuccess,
      message: allSuccess ? 'Sistema inicializado exitosamente' : 'Sistema inicializado con algunos errores',
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error general en inicialización:', error);
    return NextResponse.json({
      ok: false,
      error: 'Error en el servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Verificar estado actual del sistema
    const status = {
      database: { connected: false, tables: [] as string[] },
      aws: { collection: false, configured: false }
    };

    // Verificar conexión a base de datos
    try {
      const { error } = await supabaseAdmin
        .from('employees')
        .select('COUNT(*)')
        .limit(1);

      if (!error) {
        status.database.connected = true;
        status.database.tables = ['employees', 'access_logs', 'organizations', 'users'];
      }
    } catch (error) {
      console.error('Error verificando base de datos:', error);
    }

    // Verificar configuración de AWS
    status.aws.configured = !!(
      process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REKOGNITION_COLLECTION_ID
    );

    // Verificar si la colección existe
    if (status.aws.configured) {
      try {
        const { createCollection } = await import('@/lib/rekognition');
        // Intentar crear la colección (si ya existe, no hará nada)
        await createCollection();
        status.aws.collection = true;
      } catch (error) {
        console.error('Error verificando colección de AWS:', error);
      }
    }

    return NextResponse.json({
      ok: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error verificando estado del sistema:', error);
    return NextResponse.json({
      ok: false,
      error: 'Error verificando el estado del sistema',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 