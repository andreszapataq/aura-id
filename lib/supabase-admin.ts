import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase con privilegios de administrador - SOLO para uso en servidor (APIs)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
) 