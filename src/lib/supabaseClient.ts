import { createClient } from '@supabase/supabase-js'

// Variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
