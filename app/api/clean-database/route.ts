import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    console.log('🧹 Iniciando limpieza completa de la base de datos...');

    // 1. Limpiar logs de acceso
    const { error: logsError } = await supabaseAdmin
      .from('access_logs')
      .delete()
      .not('id', 'is', null); // Eliminar todos los registros donde id no es null (todos)

    if (logsError) {
      console.error('Error limpiando access_logs:', logsError);
      return NextResponse.json({
        ok: false,
        error: 'Error al limpiar logs de acceso',
        details: logsError
      }, { status: 500 });
    }

    console.log('✅ Logs de acceso limpiados');

    // 2. Limpiar empleados
    const { error: employeesError } = await supabaseAdmin
      .from('employees')
      .delete()
      .not('id', 'is', null); // Eliminar todos los registros donde id no es null (todos)

    if (employeesError) {
      console.error('Error limpiando employees:', employeesError);
      return NextResponse.json({
        ok: false,
        error: 'Error al limpiar empleados',
        details: employeesError
      }, { status: 500 });
    }

    console.log('✅ Empleados limpiados');

    // 3. Verificar que las tablas estén vacías
    const { data: remainingEmployees, error: checkEmpError } = await supabaseAdmin
      .from('employees')
      .select('id');

    const { data: remainingLogs, error: checkLogsError } = await supabaseAdmin
      .from('access_logs')
      .select('id');

    if (checkEmpError || checkLogsError) {
      console.error('Error verificando limpieza:', { checkEmpError, checkLogsError });
    }

    console.log('📊 Estado después de la limpieza:');
    console.log('- Empleados restantes:', remainingEmployees?.length || 0);
    console.log('- Logs restantes:', remainingLogs?.length || 0);

    return NextResponse.json({
      ok: true,
      message: 'Base de datos limpiada exitosamente',
      results: {
        employees_remaining: remainingEmployees?.length || 0,
        logs_remaining: remainingLogs?.length || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('💥 Error en limpieza de base de datos:', error);
    return NextResponse.json({
      ok: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 