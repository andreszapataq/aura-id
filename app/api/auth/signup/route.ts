import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import { sendConfirmationEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  logger.log(`[${requestId}] === INICIO DE SOLICITUD DE REGISTRO ===`)
  
  try {
    const { email, password, fullName, organizationName } = await request.json()
    logger.log(`[${requestId}] Email: ${email}, Nombre: ${fullName}, Org: ${organizationName}`)

    // Validaciones básicas
    if (!email || !password || !fullName || !organizationName) {
      logger.error(`[${requestId}] Faltan campos requeridos`)
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      logger.error(`[${requestId}] Contraseña muy corta`)
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // 1. Verificar si el usuario ya existe
    logger.log(`[${requestId}] Paso 1: Verificando si el usuario ya existe...`)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)
    logger.log(`[${requestId}] Usuario existente: ${existingUser ? 'SÍ (' + existingUser.id + ')' : 'NO'}`)

    if (existingUser) {
      // Si el usuario existe, limpiarlo completamente antes de recrear
      logger.log(`[${requestId}] Usuario existente encontrado, limpiando...`, existingUser.id)
      
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

    // 2. Crear el usuario en Supabase Auth (SIN auto-confirmar)
    logger.log(`[${requestId}] Paso 2: Creando usuario en Supabase Auth...`)
    const { data: authData, error: signUpError} = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Requiere confirmación por email
      user_metadata: {
        full_name: fullName,
        organization_name: organizationName,
      }
    })

    if (signUpError) {
      logger.error(`[${requestId}] Error durante el registro:`, signUpError)
      return NextResponse.json(
        { error: signUpError.message || 'Error al crear el usuario' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      logger.error(`[${requestId}] No se devolvió el usuario`)
      return NextResponse.json(
        { error: 'No se pudo crear el usuario' },
        { status: 500 }
      )
    }

    logger.log(`[${requestId}] Usuario creado en Auth exitosamente: ${authData.user.id}`)

    // 3. Crear la organización en la base de datos
    logger.log(`[${requestId}] Paso 3: Creando organización...`)
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
      logger.error(`[${requestId}] Error al crear la organización:`, orgError)
      // Intentar eliminar el usuario creado
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Error al crear la organización: ' + orgError.message },
        { status: 500 }
      )
    }

    logger.log(`[${requestId}] Organización creada exitosamente: ${orgData.id}`)

    // 4. Crear/Actualizar el perfil de usuario en la tabla users
    // Usamos upsert porque puede haber un trigger que ya creó el usuario
    logger.log(`[${requestId}] Paso 4: Creando/actualizando perfil de usuario en la tabla users...`)
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authData.user.id,
        email: email,
        full_name: fullName,
        role: 'admin', // El primer usuario de una organización es admin
        organization_id: orgData.id,
        is_kiosk: false,
        lock_session: false,
      }, {
        onConflict: 'id' // Si el ID ya existe, actualizar
      })

    if (profileError) {
      logger.error(`[${requestId}] ERROR CRÍTICO al crear el perfil de usuario:`, profileError)
      logger.error(`[${requestId}] Detalles del error:`, JSON.stringify(profileError, null, 2))
      // Intentar limpiar los datos creados
      await supabaseAdmin.from('organizations').delete().eq('id', orgData.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Error al crear el perfil: ' + profileError.message },
        { status: 500 }
      )
    }

    // 5. Generar link de confirmación
    logger.log(`[${requestId}] Paso 5: Generando link de confirmación...`)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: `${siteUrl}/auth/callback`
      }
    })

    if (linkError || !linkData?.properties?.action_link) {
      logger.error(`[${requestId}] Error al generar link de confirmación:`, linkError)
      // No fallar todo el proceso, pero advertir
      logger.warn(`[${requestId}] Usuario creado pero no se pudo enviar email de confirmación`)
    } else {
      // 6. Enviar email de confirmación
      logger.log(`[${requestId}] Paso 6: Enviando email de confirmación...`)
      const confirmationLink = linkData.properties.action_link
      const emailResult = await sendConfirmationEmail(email, fullName, confirmationLink)
      
      if (!emailResult.success) {
        logger.error(`[${requestId}] Error al enviar email:`, emailResult.error)
        logger.warn(`[${requestId}] Usuario creado pero email no enviado`)
      } else {
        logger.log(`[${requestId}] ✅ Email de confirmación enviado exitosamente`)
      }
    }

    // Éxito completo
    logger.log(`[${requestId}] ✅ Usuario, organización y perfil creados exitosamente`)
    return NextResponse.json(
      { 
        success: true,
        message: 'Usuario creado exitosamente. Por favor, revisa tu correo electrónico para confirmar tu cuenta.',
        requiresEmailConfirmation: true,
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
