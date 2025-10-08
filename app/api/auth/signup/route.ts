import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, organizationName } = await request.json()

    // Validaciones básicas
    if (!email || !password || !fullName || !organizationName) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // 1. Verificar si el usuario ya existe
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // Si el usuario existe, limpiarlo completamente antes de recrear
      logger.log('Usuario existente encontrado, limpiando...', existingUser.id)
      
      try {
        // Eliminar perfil de usuario
        const { error: deleteProfileError } = await supabaseAdmin.from('users').delete().eq('id', existingUser.id)
        if (deleteProfileError) {
          logger.error('Error al eliminar perfil:', deleteProfileError)
        }
        
        // Eliminar organizaciones asociadas
        const { error: deleteOrgError } = await supabaseAdmin.from('organizations').delete().eq('owner_id', existingUser.id)
        if (deleteOrgError) {
          logger.error('Error al eliminar organizaciones:', deleteOrgError)
        }
        
        // Eliminar usuario de Auth
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
        if (deleteAuthError) {
          logger.error('Error al eliminar usuario de Auth:', deleteAuthError)
          // Si no se puede eliminar, retornar error específico
          return NextResponse.json(
            { error: 'El usuario ya existe y no se pudo eliminar. Por favor, contacta al administrador o usa otro email.' },
            { status: 409 }
          )
        }
        
        logger.log('Usuario anterior eliminado correctamente')
        
        // Esperar un poco para asegurar que la eliminación se haya completado
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (cleanupError) {
        logger.error('Error durante la limpieza:', cleanupError)
        return NextResponse.json(
          { error: 'Error al limpiar usuario existente. Por favor, intenta con otro email.' },
          { status: 500 }
        )
      }
    }

    // 2. Crear el usuario en Supabase Auth usando el cliente admin
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar el email
      user_metadata: {
        full_name: fullName,
        organization_name: organizationName,
      }
    })

    if (signUpError) {
      logger.error('Error durante el registro:', signUpError)
      return NextResponse.json(
        { error: signUpError.message || 'Error al crear el usuario' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'No se pudo crear el usuario' },
        { status: 500 }
      )
    }

    // 3. Crear la organización en la base de datos
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: organizationName,
        owner_id: authData.user.id,
        is_active: true,
      })
      .select()
      .single()

    if (orgError) {
      logger.error('Error al crear la organización:', orgError)
      // Intentar eliminar el usuario creado
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Error al crear la organización: ' + orgError.message },
        { status: 500 }
      )
    }

    // 4. Crear el perfil de usuario en la tabla users
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: fullName,
        role: 'admin', // El primer usuario de una organización es admin
        organization_id: orgData.id,
        is_kiosk: false,
        lock_session: false,
      })

    if (profileError) {
      logger.error('Error al crear el perfil de usuario:', profileError)
      // Intentar limpiar los datos creados
      await supabaseAdmin.from('organizations').delete().eq('id', orgData.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Error al crear el perfil: ' + profileError.message },
        { status: 500 }
      )
    }

    // Éxito completo
    logger.log('Usuario, organización y perfil creados exitosamente')
    return NextResponse.json(
      { 
        success: true,
        message: 'Usuario creado exitosamente',
        user: {
          id: authData.user.id,
          email: authData.user.email
        }
      },
      { status: 201 }
    )

  } catch (error) {
    logger.error('Error inesperado durante el proceso de signUp:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido en el servidor' },
      { status: 500 }
    )
  }
}
