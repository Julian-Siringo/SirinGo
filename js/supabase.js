/* ============================================================
   supabase.js
   ------------------------------------------------------------
   Inicialización del cliente de Supabase.
   Este archivo se carga ANTES que data.js, auth.js, productos.js
   y admin.js en todas las páginas HTML.

   Requiere que el SDK de Supabase esté cargado antes que este
   archivo. Ya está agregado en el <head>/<body> de cada página:

   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ============================================================ */

// ⚠️ COMPLETÁ ACÁ TUS DATOS DE SUPABASE ⚠️
// Los encontrás en: Supabase → tu proyecto → Project Settings → API
const SUPABASE_URL = "https://ytrdusyjyewickbwdksc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0cmR1c3lqeWV3aWNrYndka3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NjExNDYsImV4cCI6MjEwNDIzNzE0Nn0.IaVWrYR_vDdEkvzAWLKq9b0MPppIqkP4Khe9LBTWMXg";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ SirinGo: todavía no configuraste SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase.js. ' +
    'El sitio no va a poder conectarse a la base de datos hasta que los completes.'
  );
}

// Cliente único de Supabase, usado por data.js y auth.js.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
