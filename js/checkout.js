/* ============================================================
   checkout.js
   ------------------------------------------------------------
   Página checkout.html. Toma el carrito (Carrito, de carrito.js)
   y guía al comprador por 2 pasos: datos personales y método de
   entrega. El único método de pago de la tienda es transferencia
   bancaria, así que no hay paso de selección: al presionar
   "Seguir con la compra" se genera el pedido y se muestra
   directamente la pantalla con los datos para transferir.

   Si el comprador está logueado, el pedido además queda guardado
   en la tabla "pedidos" de Supabase a su nombre (ver js/data.js),
   para que después lo pueda ver en pedidos.html ("Mis pedidos") y
   retomar el pago en pago.html si no llegó a pagarlo. Si compra
   como invitado, sigue funcionando solo con localStorage +
   WhatsApp, sin quedar guardado en ningún listado.
   ============================================================ */

(() => {
  // Datos reales de cobro de la tienda (los mismos deben estar en js/pago.js).
  const DATOS_PAGO = {
    alias: 'siringo.barberr',
    cvu: '0000003100058821898256',
    titular: 'Julian Matín Siringo'
  };

  const NUMERO_WHATSAPP = '5492236946601'; // mismo número de contacto de la tienda
  const CLAVE_PEDIDO = 'siringo_ultimo_pedido';

  function formatearPrecio(valor) {
    return Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  }

  function generarNumeroPedido() {
    // 6 dígitos en vez de 4: con la tabla "pedidos" ahora el número
    // tiene que ser único en la base, así que le damos más margen
    // para que sea prácticamente imposible que se repita.
    const numero = Math.floor(100000 + Math.random() * 900000);
    return `SG-${numero}`;
  }

  function mostrarMensaje(texto) {
    const caja = document.getElementById('mensajeCheckout');
    if (!caja) return;
    caja.textContent = texto;
    caja.hidden = false;
    caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function ocultarMensaje() {
    const caja = document.getElementById('mensajeCheckout');
    if (caja) caja.hidden = true;
  }

  /* ------------------------- resumen del pedido ------------------------- */

  function renderizarResumen() {
    const items = Carrito.obtenerItems();
    const contenedor = document.getElementById('resumenItems');

    contenedor.innerHTML = items.map(item => {
      const imagen = item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}">` : '🛍️';
      return `
        <div class="resumen-item">
          <div class="resumen-item-imagen">${imagen}</div>
          <div class="resumen-item-info">
            <strong>${item.nombre}</strong>
            <span>Cantidad: ${item.cantidad}</span>
          </div>
          <div class="resumen-item-precio">${formatearPrecio(item.precio * item.cantidad)}</div>
        </div>`;
    }).join('');

    const total = Carrito.obtenerTotal();
    document.getElementById('resumenSubtotal').textContent = formatearPrecio(total);
    document.getElementById('resumenTotal').textContent = formatearPrecio(total);
  }

  /* ------------------------- selección de tarjetas (radio) ------------------------- */

  function inicializarSelectorTarjetas(atributo) {
    const opciones = document.querySelectorAll(`[${atributo}]`);
    opciones.forEach(opcion => {
      const input = opcion.querySelector('input[type="radio"]');
      if (!input || input.disabled) return;
      input.addEventListener('change', () => {
        opciones.forEach(o => o.classList.remove('seleccionada'));
        opcion.classList.add('seleccionada');
        if (atributo === 'data-opcion-entrega') alternarBloqueEntrega(input.value);
      });
    });
  }

  function alternarBloqueEntrega(valor) {
    document.getElementById('bloqueDireccion').hidden = valor !== 'domicilio';
    document.getElementById('bloqueRetiro').hidden = valor !== 'retiro';
  }

  /* ------------------------- prellenado con sesión activa ------------------------- */

  let sesionActual = null;

  async function prellenarConSesion() {
    sesionActual = await SirinGoDB.getSesion();
    const info = document.getElementById('checkoutSesionInfo');
    if (sesionActual) {
      info.textContent = `Comprando como ${sesionActual.email}`;
      document.getElementById('ckNombre').value = `${sesionActual.nombre} ${sesionActual.apellido}`.trim();
      document.getElementById('ckEmail').value = sesionActual.email;
    } else {
      info.textContent = 'Comprando como invitado.';
    }
  }

  /* ------------------------- validación y envío del paso 1 ------------------------- */

  function leerDatosFormulario() {
    const entrega = document.querySelector('input[name="entrega"]:checked').value;

    return {
      nombre: document.getElementById('ckNombre').value.trim(),
      telefono: document.getElementById('ckTelefono').value.trim(),
      email: document.getElementById('ckEmail').value.trim(),
      entrega,
      // Único método de pago de la tienda: transferencia bancaria.
      pago: 'transferencia',
      provincia: document.getElementById('ckProvincia').value.trim(),
      ciudad: document.getElementById('ckCiudad').value.trim(),
      codigoPostal: document.getElementById('ckCodigoPostal').value.trim(),
      calle: document.getElementById('ckCalle').value.trim(),
      numero: document.getElementById('ckNumero').value.trim(),
      piso: document.getElementById('ckPiso').value.trim(),
      referencias: document.getElementById('ckReferencias').value.trim()
    };
  }

  function validarDatos(datos) {
    if (!datos.nombre || !datos.telefono || !datos.email) {
      return 'Completá tu nombre, teléfono y correo electrónico.';
    }
    if (datos.entrega === 'domicilio') {
      if (!datos.provincia || !datos.ciudad || !datos.codigoPostal || !datos.calle || !datos.numero) {
        return 'Completá la dirección de envío (provincia, ciudad, código postal, calle y número).';
      }
    }
    return null;
  }

  function armarDireccion(datos) {
    if (datos.entrega === 'retiro') return 'Retiro en el local';
    const partes = [
      `${datos.calle} ${datos.numero}`,
      datos.piso,
      `${datos.ciudad}, ${datos.provincia}`,
      `CP ${datos.codigoPostal}`
    ].filter(Boolean);
    return partes.join(', ');
  }

  function armarMensajeComprobante(pedido) {
    const lineas = [
      `Hola SirinGo! Te envío el comprobante de transferencia del pedido ${pedido.numero}.`,
      '',
      `Total transferido: ${formatearPrecio(pedido.total)}`,
      `Nombre: ${pedido.nombre}`
    ];
    return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(lineas.join('\n'))}`;
  }

  /* ------------------------- paso B: pantalla de pago ------------------------- */

  function mostrarPantallaPago(pedido) {
    document.getElementById('checkoutFormulario').hidden = true;
    const panel = document.getElementById('checkoutPago');
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('pagoNumeroPedido').textContent = pedido.numero;
    document.getElementById('pagoNumeroPedido2').textContent = pedido.numero;
    document.getElementById('pagoMonto').textContent = formatearPrecio(pedido.total);
    document.getElementById('pagoAlias').textContent = DATOS_PAGO.alias;
    document.getElementById('pagoCvu').textContent = DATOS_PAGO.cvu;
    document.getElementById('pagoTitular').textContent = DATOS_PAGO.titular;

    document.getElementById('btnEnviarComprobante').href = armarMensajeComprobante(pedido);

    const enlaceVolver = document.getElementById('enlaceVolverMasTarde');
    if (sesionActual && enlaceVolver) {
      enlaceVolver.href = 'pedidos.html';
      enlaceVolver.textContent = 'Volver más tarde — puedo verlo en "Mis pedidos"';
    }

    document.querySelectorAll('[data-copiar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const texto = document.getElementById(btn.dataset.copiar).textContent;
        navigator.clipboard?.writeText(texto);
        const original = btn.textContent;
        btn.textContent = 'COPIADO';
        setTimeout(() => { btn.textContent = original; }, 1500);
      });
    });

    document.getElementById('btnYaPague').addEventListener('click', () => {
      const boton = document.getElementById('btnYaPague');
      boton.textContent = '¡Gracias! No olvides enviar tu comprobante por WhatsApp';
      boton.disabled = true;
    });
  }

  /* ------------------------- inicialización ------------------------- */

  function inicializar() {
    if (Carrito.obtenerItems().length === 0) {
      window.location.href = 'index.html#catalogo';
      return;
    }

    renderizarResumen();
    prellenarConSesion();
    inicializarSelectorTarjetas('data-opcion-entrega');
    alternarBloqueEntrega('domicilio');

    document.getElementById('btnSeguirCompra').addEventListener('click', async () => {
      ocultarMensaje();
      const datos = leerDatosFormulario();
      const error = validarDatos(datos);
      if (error) { mostrarMensaje(error); return; }

      const boton = document.getElementById('btnSeguirCompra');
      boton.disabled = true;

      const subtotal = Carrito.obtenerTotal();
      const pedido = {
        numero: generarNumeroPedido(),
        fecha: new Date().toISOString(),
        total: subtotal,
        items: Carrito.obtenerItems(),
        direccion: armarDireccion(datos),
        ...datos
      };

      // Si hay una cuenta logueada, además de la pantalla de pago de
      // siempre (que funciona igual para todos, con o sin cuenta),
      // guardamos el pedido en la base para que lo pueda ver después
      // en "Mis pedidos" y retomar el pago si todavía no lo hizo.
      if (sesionActual) {
        const datosPedidoDB = {
          numero: pedido.numero,
          usuario_id: sesionActual.id,
          nombre: datos.nombre,
          telefono: datos.telefono,
          email: datos.email,
          entrega: datos.entrega,
          direccion: pedido.direccion,
          metodo_pago: datos.pago,
          items: pedido.items,
          subtotal,
          envio_monto: null, // el envío se coordina y confirma por WhatsApp
          total: subtotal
        };

        let resultadoDB = await SirinGoDB.crearPedido(datosPedidoDB);
        if (!resultadoDB.ok) {
          // Único caso esperable de error acá: que el número generado
          // ya exista (muy poco probable). Se prueba una vez más con
          // otro número antes de seguir igual sin bloquear la compra.
          pedido.numero = generarNumeroPedido();
          resultadoDB = await SirinGoDB.crearPedido({ ...datosPedidoDB, numero: pedido.numero });
        }
      }

      boton.disabled = false;
      localStorage.setItem(CLAVE_PEDIDO, JSON.stringify(pedido));

      // Único método de pago: transferencia bancaria. Se muestra
      // directamente la pantalla con los datos para transferir.
      mostrarPantallaPago(pedido);
      Carrito.vaciar();
    });
  }

  document.addEventListener('DOMContentLoaded', inicializar);
})();
