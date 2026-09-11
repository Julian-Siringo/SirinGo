# SirinGo — Tienda online

**"Todo lo que buscás, en un solo lugar."**

Este proyecto nace como una transformación completa de **LIMPIARTE** (un
sitio de artículos de limpieza) hacia **SirinGo**, una tienda online de
productos variados, moderna y preparada para crecer en categorías.
Se mantuvo toda la lógica funcional del proyecto original (catálogo,
búsqueda y filtros, autenticación por roles, panel de administración con
CRUD de productos/categorías/marcas, formulario de consultas) y se sumó lo
que faltaba para que funcione como una tienda real: **carrito de compras**
y **checkout por WhatsApp**.

---

## 1. Qué hace el proyecto

- **Vista de tienda**: home con hero, categorías, productos destacados,
  catálogo completo con buscador y filtros (categoría, marca, orden),
  ficha de producto en modal, preguntas frecuentes y contacto.
- **Carrito de compras**: agregar/quitar productos, modificar cantidades,
  ver subtotal y total, vaciar carrito, y finalizar el pedido abriendo
  WhatsApp con el detalle completo ya redactado. El carrito vive en el
  navegador de cada visitante (`localStorage`), ya que el proyecto no
  tiene backend de pedidos ni pasarela de pago propia.
- **Cuentas de usuario**: registro e inicio de sesión reales contra
  Supabase Auth; el header refleja el estado de sesión.
- **Panel de administración** (`admin.html`, protegido por rol admin):
  dashboard con estadísticas, y gestión completa (alta, edición y baja) de
  **productos**, **categorías** (tabla `rubros`) y **marcas**, además de un
  listado de usuarios registrados y las consultas de contacto recibidas.
- **Sistema de categorías dinámico**: la sección "Categorías" del home y
  el filtro del catálogo se arman automáticamente a partir de lo que haya
  cargado en la tabla `rubros`. No hace falta tocar código para agregar,
  renombrar o quitar una categoría: se hace desde el panel de admin.
- **Ofertas**: un producto puede tener un `precio_anterior` opcional; si lo
  tiene, la card muestra el precio tachado, el % de descuento y la
  etiqueta "Oferta" automáticamente.

Todos los botones son funcionales: registrarse registra de verdad, el
login autentica contra Supabase, los filtros filtran en tiempo real, y las
altas/ediciones/bajas del panel se reflejan de inmediato en el catálogo
público.

---

## 2. Tecnologías utilizadas

- **HTML5** semántico (4 páginas: `index.html`, `login.html`,
  `registro.html`, `admin.html`).
- **CSS3** propio (sin frameworks), con variables CSS, Flexbox, Grid y
  diseño totalmente responsive (menú hamburguesa, carrito adaptado,
  grillas de 1/2 columnas en mobile).
- **JavaScript (ES6+)**, sin frameworks ni librerías externas, organizado
  en módulos por responsabilidad.
- **Supabase** (PostgreSQL + Auth + Storage) como backend real: las
  pantallas nunca acceden a la base directamente, siempre llaman a
  funciones de `js/data.js` (objeto `SirinGoDB`), lo que deja la puerta
  abierta a cambiar de proveedor de backend sin tocar el resto del sitio.
- **`localStorage`** solo para el carrito de compras (dato efímero del
  lado del visitante, no de la tienda).

---

## 3. Cómo ejecutar el proyecto

No requiere instalación. Alcanza con abrir el sitio con un servidor
estático local (recomendado, para que las rutas relativas funcionen sin
restricciones del navegador):

```bash
cd proyecto
python3 -m http.server 8080
# luego abrir http://localhost:8080/index.html
```

También puede abrirse `index.html` directamente con doble clic en la
mayoría de los navegadores modernos.

El proyecto ya viene conectado a un proyecto de Supabase existente
(ver `js/supabase.js`). Si querés usar tu propia base, seguí la guía en
`INSTRUCCIONES_SUPABASE.md`.

### Migración opcional: ofertas

Para poder cargar un precio anterior y mostrar descuentos en las cards,
corré una vez en el SQL Editor de Supabase el archivo
`sql/agregar_precio_anterior.sql`. Si no lo corrés, el sitio funciona
igual: simplemente no vas a poder cargar ofertas desde el panel.

---

## 4. Estructura de carpetas

```text
/proyecto
│
├── index.html            → Home: hero, categorías, destacados, catálogo,
│                            FAQ, contacto, carrito y modal de producto
├── login.html             → Inicio de sesión
├── registro.html           → Registro de nuevos usuarios
├── admin.html               → Panel de administración (protegido, solo admin)
│
├── css/
│   └── styles.css            → Estilos de todo el sitio (tema oscuro SirinGo)
│
├── js/
│   ├── supabase.js             → Inicialización del cliente de Supabase
│   ├── data.js                  → Capa de datos (SirinGoDB): productos,
│   │                              categorías, marcas, usuarios, sesión
│   ├── auth.js                    → Registro, login, logout, header dinámico,
│   │                                protección de rutas, menú móvil
│   ├── carrito.js                   → Carrito de compras (localStorage) +
│   │                                  checkout por WhatsApp
│   ├── productos.js                   → Home y catálogo: categorías,
│   │                                    destacados, búsqueda, filtros, modal
│   └── admin.js                        → Panel de administración: dashboard
│                                          y CRUD de productos/categorías/marcas
│
├── images/
│   └── logo.png              → Logo de SirinGo
│
├── sql/                    → Esquema de base de datos y migraciones
│
└── README.md              → Este archivo
```

---

## 5. Roles y permisos

| Acción                                      | Usuario | Administrador |
|----------------------------------------------|:-------:|:--------------:|
| Ver catálogo, buscar y filtrar                | ✅      | ✅             |
| Armar carrito y finalizar pedido por WhatsApp | ✅      | ✅             |
| Registrarse / iniciar / cerrar sesión         | ✅      | ✅             |
| Acceder al panel de administración            | ❌      | ✅             |
| Gestionar productos, categorías y marcas      | ❌      | ✅             |
| Ver listado de usuarios registrados           | ❌      | ✅             |

`admin.html` verifica al cargar que exista una sesión activa con
`rol === 'admin'` (función `protegerRutaAdmin()` en `js/auth.js`); si no es
así, redirige automáticamente a `login.html`.

---

## 6. Qué cambió respecto de LIMPIARTE

- Identidad visual completa: paleta oscura con degradados violeta → azul →
  fucsia, tipografía Space Grotesk + Inter, glow, bordes redondeados,
  animaciones sutiles.
- Nueva marca: SirinGo, con el logo provisto por el cliente.
- El catálogo dejó de estar limitado a productos de limpieza: la sección
  de categorías y el filtro del catálogo son genéricos y se arman con lo
  que haya cargado en la base (la temática de los productos depende
  exclusivamente de lo que se cargue desde el panel de administración).
- Se agregó el carrito de compras completo, que no existía en el proyecto
  original.
- Se agregó el campo opcional `precio_anterior` para mostrar ofertas y
  porcentaje de descuento en las cards.
- Se mantuvo intacta toda la lógica de datos, autenticación, roles y panel
  de administración del proyecto original.
