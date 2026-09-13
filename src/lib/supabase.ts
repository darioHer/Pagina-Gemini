import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wdixodwaagkjzcvbtxhg.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaXhvZHdhYWdranpjdmJ0eGhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyODE2ODEsImV4cCI6MjEwNDg1NzY4MX0.B9g1IhY_P0n4zqX9X19pfBZBK6pRMql0I3tTiAb75pw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
