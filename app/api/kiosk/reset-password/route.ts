import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Función para generar una contraseña segura
function generateSecurePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request) {
  try {
    // Crear cliente de Supabase con las cookies del servidor
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verificar que el usuario actual sea un administrador
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'No autenticado'
      }, { status: 401 });
    }

    // Obtener perfil del usuario actual
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ 
        error: 'No autorizado'
      }, { status: 403 });
    }

    // Buscar usuario kiosco de la organización
    const { data: kioskUser, error: kioskError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('organization_id', profile.organization_id)
      .eq('is_kiosk', true)
      .single();

    if (kioskError || !kioskUser) {
      return NextResponse.json({ 
        error: 'No se encontró terminal kiosco',
        message: 'No existe una terminal kiosco para su organización'
      }, { status: 404 });
    }

    // Generar nueva contraseña
    const newPassword = generateSecurePassword(16);

    // Actualizar contraseña usando Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      kioskUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error al actualizar contraseña:', updateError);
      return NextResponse.json({ 
        error: 'Error al resetear contraseña',
        message: updateError.message
      }, { status: 500 });
    }

    console.log(`✅ Contraseña reseteada para kiosco de organización ${profile.organization_id}`);

    return NextResponse.json({
      success: true,
      message: 'Contraseña reseteada exitosamente',
      credentials: {
        email: kioskUser.email,
        password: newPassword
      },
      warning: 'Guarde la nueva contraseña de forma segura.'
    });

  } catch (error) {
    console.error('Error al resetear contraseña del kiosco:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Ocurrió un error inesperado'
    }, { status: 500 });
  }
}

