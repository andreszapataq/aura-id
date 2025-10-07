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
        error: 'No autenticado',
        message: 'Debe iniciar sesión para realizar esta acción'
      }, { status: 401 });
    }

    // Obtener perfil del usuario actual
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, organization_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ 
        error: 'Error al obtener perfil',
        message: 'No se pudo verificar los permisos del usuario'
      }, { status: 403 });
    }

    // Verificar que sea administrador
    if (profile.role !== 'admin') {
      return NextResponse.json({ 
        error: 'No autorizado',
        message: 'Solo los administradores pueden crear usuarios kiosco'
      }, { status: 403 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ 
        error: 'Error de configuración',
        message: 'El usuario no tiene una organización asignada'
      }, { status: 400 });
    }

    // Verificar si ya existe un usuario kiosco para esta organización
    const { data: existingKiosk } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('organization_id', profile.organization_id)
      .eq('is_kiosk', true)
      .maybeSingle();

    if (existingKiosk) {
      return NextResponse.json({ 
        error: 'Ya existe un kiosco',
        message: 'Ya existe una terminal kiosco para su organización. Use la función de resetear credenciales si necesita cambiar la contraseña.',
        existingKiosk: {
          email: existingKiosk.email
        }
      }, { status: 409 });
    }

    // Crear email único para el kiosco
    const kioskEmail = `kiosk-${profile.organization_id}@aura-id.local`;
    const kioskPassword = generateSecurePassword(16);

    console.log(`🚀 Intentando crear usuario kiosco: ${kioskEmail}`);

    // Crear usuario en Supabase Auth usando Admin API
    // IMPORTANTE: Pasar TODOS los datos en user_metadata para que el trigger pueda usarlos
    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: kioskEmail,
      password: kioskPassword,
      email_confirm: true, // Auto-confirmar el email
      user_metadata: {
        full_name: 'Terminal Kiosco',
        role: 'kiosk',
        is_kiosk: true,
        lock_session: true,
        organization_id: profile.organization_id
      }
    });

    if (createAuthError || !authUser.user) {
      console.error('❌ Error al crear usuario en Auth:', createAuthError);
      return NextResponse.json({ 
        error: 'Error al crear usuario',
        message: createAuthError?.message || 'No se pudo crear el usuario en el sistema de autenticación',
        details: createAuthError
      }, { status: 500 });
    }

    console.log(`✅ Usuario auth creado con ID: ${authUser.user.id}`);

    // Esperar un momento para que el trigger (si existe) haga su trabajo
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verificar si el perfil ya fue creado por un trigger
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', authUser.user.id)
      .maybeSingle();

    if (existingProfile) {
      console.log(`✅ Perfil ya creado por trigger automático`);
      
      // Actualizar el perfil para asegurarnos de que tiene los datos correctos
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          role: 'kiosk',
          is_kiosk: true,
          lock_session: true,
          organization_id: profile.organization_id,
          full_name: 'Terminal Kiosco'
        })
        .eq('id', authUser.user.id);

      if (updateError) {
        console.warn(`⚠️ Advertencia al actualizar perfil:`, updateError);
      } else {
        console.log(`✅ Perfil actualizado correctamente`);
      }
    } else {
      console.log(`📝 Creando perfil manualmente...`);
      
      // Si no existe, crear el perfil manualmente
      const { error: profileInsertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.user.id,
          email: kioskEmail,
          role: 'kiosk',
          is_kiosk: true,
          lock_session: true,
          organization_id: profile.organization_id,
          full_name: 'Terminal Kiosco'
        });

      if (profileInsertError) {
        console.error('❌ Error al crear perfil de usuario:', profileInsertError);
        
        // Rollback: eliminar usuario de Auth
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        
        return NextResponse.json({ 
          error: 'Error al crear perfil',
          message: 'No se pudo crear el perfil del usuario kiosco',
          details: profileInsertError
        }, { status: 500 });
      }

      console.log(`✅ Perfil creado manualmente`);
    }

    console.log(`🎉 Usuario kiosco creado exitosamente para organización ${profile.organization_id}`);

    // Retornar las credenciales
    return NextResponse.json({
      success: true,
      message: 'Terminal kiosco creada exitosamente',
      credentials: {
        email: kioskEmail,
        password: kioskPassword,
        userId: authUser.user.id
      },
      warning: 'Guarde estas credenciales de forma segura. La contraseña no se podrá recuperar, solo resetear.'
    }, { status: 201 });

  } catch (error) {
    console.error('💥 Error inesperado al crear usuario kiosco:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Ocurrió un error inesperado'
    }, { status: 500 });
  }
}