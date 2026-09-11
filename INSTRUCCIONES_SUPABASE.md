# SirinGo + Supabase — Guía de puesta en marcha

## 1. Crear el proyecto en Supabase

1. Entrá a https://supabase.com/ e iniciá sesión (o creá una cuenta).
2. Click en **New project**.
3. Elegí una organización, un nombre (por ej. `siringo`), una contraseña
   para la base de datos (guardala, es distinta de las contraseñas de los
   usuarios de tu web) y una región cercana.
4. Esperá 1-2 minutos a que Supabase termine de aprovisionar el proyecto.

## 2. Ejecutar el SQL

1. En el menú lateral izquierdo, andá a **SQL Editor**.
2. Click en **New query**.
3. Abrí el archivo `sql/supabase_schema.sql` de este proyecto, copiá **todo**
   el contenido y pegalo en el editor.
4. Click en **Run** (o Ctrl/Cmd + Enter).
5. Si todo salió bien vas a ver "Success. No rows returned" (o similar).
   Esto crea las tablas, las relaciones, los triggers, las funciones, las
   políticas RLS y carga los rubros/marcas/productos iniciales (más un par
   de ventas de ejemplo para que el dashboard no arranque vacío).

## 3. Obtener la Project URL y la anon key

1. En el menú lateral, andá a **Project Settings** (ícono de engranaje) →
   **API**.
2. Copiá el valor de **Project URL** (algo como `https://xxxxx.supabase.co`).
3. Copiá el valor de **anon public** dentro de "Project API keys".
   ⚠️ NO copies la **service_role key** — esa nunca debe ir en el frontend.

## 4. Colocarlas en el proyecto

Abrí `js/supabase.js` y reemplazá:

```javascript
const SUPABASE_URL = "TU_SUPABASE_URL";
const SUPABASE_ANON_KEY = "TU_SUPABASE_ANON_KEY";
```

por tus valores reales, por ejemplo:

```javascript
const SUPABASE_URL = "https://abcdefghijk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....";
```

No hay que tocar ningún otro archivo: el resto del proyecto usa
`supabaseClient`, que se crea automáticamente en `js/supabase.js`.

## 5. Crear el usuario administrador inicial

Por seguridad, la contraseña del administrador la maneja Supabase Auth,
nunca se guarda a mano en la tabla `perfiles`. Hay dos formas de crearlo,
elegí la que prefieras:

### Opción A — Desde el panel de Supabase (recomendada)

1. Andá a **Authentication → Users → Add user → Create new user**.
2. Cargá:
   - Email: `admin@siringo.com.ar`
   - Password: la que quieras (por ej. `Admin123!`)
   - Marcá **Auto Confirm User** para no tener que confirmar por email.
3. Click en **Create user**.
4. El trigger `handle_new_user()` va a crear automáticamente su fila en
   `perfiles` con `rol = 'usuario'`. Ahora hay que ascenderlo a admin:
   volvé a **SQL Editor** y ejecutá:

```sql
update public.perfiles
set rol = 'admin'
where email = 'admin@siringo.com.ar';
```

### Opción B — Registrándose normalmente desde el sitio

1. Entrá a `registro.html` y creá la cuenta con el email
   `admin@siringo.com.ar` como si fueras un usuario común.
2. Ejecutá el mismo `UPDATE` de arriba para ascenderlo a `admin`.

Después de esto, al iniciar sesión con ese email vas a poder entrar a
`admin.html`. Cualquier otro usuario que se registre desde el sitio queda
automáticamente como `usuario` — nunca se puede elegir `admin` desde el
frontend.

## 6. Ejecutar el proyecto localmente

Como el proyecto es HTML/CSS/JS estático (sin build ni Node), alcanza con
servirlo con cualquier servidor estático, por ejemplo:

```bash
# Opción con Python (ya viene instalado en la mayoría de los sistemas)
cd Proyecto
python3 -m http.server 8080
# Abrí http://localhost:8080/index.html
```

o con la extensión **Live Server** de VS Code, haciendo click derecho
sobre `index.html` → "Open with Live Server".

⚠️ No abras los archivos `.html` directamente con doble click
(`file://...`): algunos navegadores bloquean las llamadas de red desde
`file://`. Usá siempre un servidor local como el de arriba.

## 7. Qué revisar si algo no funciona

- **"⚠️ SirinGo: todavía no configuraste..." en la consola** → falta
  completar `SUPABASE_URL` / `SUPABASE_ANON_KEY` en `js/supabase.js`.
- **El catálogo aparece vacío** → revisá en Supabase, tabla `productos`,
  que el `INSERT` inicial se haya ejecutado correctamente.
- **No podés entrar a `admin.html`** → confirmá que el perfil de ese
  usuario tenga `rol = 'admin'` en la tabla `perfiles` (SQL Editor →
  `select * from perfiles;`).
- **Error 401/403 al leer o escribir datos** → revisá que las políticas
  RLS se hayan creado (Authentication → Policies, o `\d+` en SQL) y que
  estés usando la **anon key**, no la service_role.
- **El gráfico de ventas mensuales muestra $0** → es esperado si todavía
  no se registraron ventas ese mes; el bloque opcional de "ventas de
  ejemplo" del SQL inserta un par de ventas de prueba para que puedas
  verlo funcionando desde el primer momento.
