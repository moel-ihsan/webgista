import { createClient } from '@supabase/supabase-js'

import { supabaseConfig } from '../config/supabase'

export const supabaseClient = supabaseConfig.available
  ? createClient(supabaseConfig.url!, supabaseConfig.publishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null
