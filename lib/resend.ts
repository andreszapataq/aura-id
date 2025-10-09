import { Resend } from 'resend'

// Inicializar Resend con la API key
export const resend = new Resend(process.env.RESEND_API_KEY)

// Template de email de confirmación
export const getConfirmationEmailHtml = (confirmationLink: string, userName: string) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirma tu cuenta en Aura ID</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- Header con gradiente -->
          <tr>
            <td style="background: linear-gradient(135deg, #014F59 0%, #00BF71 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Aura ID</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Sistema de Control de Acceso</p>
            </td>
          </tr>
          
          <!-- Contenido principal -->
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="margin: 0 0 20px; color: #014F59; font-size: 24px; font-weight: 600;">
                ¡Bienvenido, ${userName}! 👋
              </h2>
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Gracias por registrarte en <strong>Aura ID</strong>. Estamos emocionados de tenerte con nosotros.
              </p>
              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                Para activar tu cuenta y comenzar a usar el sistema, por favor confirma tu dirección de correo electrónico haciendo clic en el botón de abajo:
              </p>
              
              <!-- Botón CTA -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationLink}" 
                   style="display: inline-block; 
                          background: linear-gradient(135deg, #00DD8B 0%, #00BF71 100%); 
                          color: #ffffff; 
                          text-decoration: none; 
                          padding: 16px 40px; 
                          border-radius: 6px; 
                          font-size: 16px; 
                          font-weight: 600;
                          box-shadow: 0 4px 12px rgba(0,191,113,0.3);">
                  Confirmar mi correo electrónico
                </a>
              </div>
              
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 10px 0 0; color: #00BF71; font-size: 14px; word-break: break-all;">
                ${confirmationLink}
              </p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #e5e5e5;"></div>
            </td>
          </tr>
          
          <!-- Información adicional -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 15px; color: #666666; font-size: 14px; line-height: 1.6;">
                <strong>¿No te registraste?</strong><br>
                Si no creaste una cuenta en Aura ID, puedes ignorar este correo de manera segura.
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.6;">
                <strong>Nota:</strong> Este enlace de confirmación expirará en 24 horas por seguridad.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 10px; color: #999999; font-size: 14px;">
                © ${new Date().getFullYear()} Aura ID. Todos los derechos reservados.
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px;">
                Sistema de Control de Acceso Biométrico
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

// Función helper para enviar email de confirmación
export async function sendConfirmationEmail(
  email: string,
  userName: string,
  confirmationLink: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Aura ID <hello@auraid.co>', // Cambiar esto cuando configures tu dominio
      to: [email],
      subject: 'Confirma tu cuenta en Aura ID',
      html: getConfirmationEmailHtml(confirmationLink, userName),
    })

    if (error) {
      throw error
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error al enviar email de confirmación:', error)
    return { success: false, error }
  }
}

