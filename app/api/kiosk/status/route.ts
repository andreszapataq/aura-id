import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
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
      .select('id, email, created_at')
      .eq('organization_id', profile.organization_id)
      .eq('is_kiosk', true)
      .maybeSingle();

    if (kioskError) {
      return NextResponse.json({ 
        error: 'Error al consultar kiosco',
        message: kioskError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      exists: !!kioskUser,
      kiosk: kioskUser ? {
        id: kioskUser.id,
        email: kioskUser.email,
        createdAt: kioskUser.created_at
      } : null
    });

  } catch (error) {
    console.error('Error al verificar estado del kiosco:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

