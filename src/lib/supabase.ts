import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zkrnxnsaarruictwozfq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprcm54bnNhYXJydWljdHdvemZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY1MzgyNDIsImV4cCI6MjA0MjExNDI0Mn0.2Atrt9DifvYDPfQY5YJYQAI6Pib9Ir8TaQIfTy102FE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase };
