/* ============================================================
   pago.js
   ------------------------------------------------------------
   Página pago.html — "Continuar pago" de un pedido que quedó
   pendiente. Recibe el número de pedido por query string
   (?numero=SG-1234), lo busca (tiene que pertenecer al usuario
   logueado) y muestra los mismos datos de transferencia que se
   ven justo después de comprar en checkout.html.
   ============================================================ */

(() => {
  // Mismos datos que checkout.js — si los cambiás ahí, cambialos acá también.
  const DATOS_PAGO = {
    alias: 'siringo.barberr',
    cvu: '0000003100058821898256',
    titular: 'Julian Matín Siringo'
  };

  const NUMERO_WHATSAPP = '5492236946601';

  function formatearPrecio(valor) {
    return Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
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

  function mostrarPantallaPago(pedido) {
    document.getElementById('pagoPanelContenedor').hidden = false;

    document.getElementById('pagoNumeroPedido').textContent = pedido.numero;
    document.getElementById('pagoNumeroPedido2').textContent = pedido.numero;
    document.getElementById('pagoMonto').textContent = formatearPrecio(pedido.total);
    document.getElementById('pagoAlias').textContent = DATOS_PAGO.alias;
    document.getElementById('pagoCvu').textContent = DATOS_PAGO.cvu;
    document.getElementById('pagoTitular').textContent = DATOS_PAGO.titular;
    document.getElementById('btnEnviarComprobante').href = armarMensajeComprobante(pedido);

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

  function mostrarYaResuelto(pedido) {
    const titulo = document.getElementById('pagoResueltoTitulo');
    const texto = document.getElementById('pagoResueltoTexto');
    document.getElementById('pagoYaResuelto').hidden = false;

    if (pedido.estado_pago === 'pagado') {
      titulo.textContent = '¡Este pedido ya está pagado! 🎉';
      texto.textContent = `El pedido ${pedido.numero} ya fue confirmado. ¡Gracias por tu compra!`;
    } else {
      titulo.textContent = 'Este pedido fue cancelado';
      texto.textContent = `El pedido ${pedido.numero} figura como cancelado. Si te parece que es un error, escribinos por WhatsApp.`;
    }
  }

  async function inicializar() {
    const sesion = await protegerRutaUsuario();
    if (!sesion) return;

    const numero = new URLSearchParams(window.location.search).get('numero');
    const pedido = numero ? await SirinGoDB.getPedidoPropioPorNumero(numero) : null;

    if (!pedido) {
      document.getElementById('pagoNoEncontrado').hidden = false;
      return;
    }

    if (pedido.estado_pago === 'pendiente') {
      mostrarPantallaPago(pedido);
    } else {
      mostrarYaResuelto(pedido);
    }
  }

  document.addEventListener('DOMContentLoaded', inicializar);
})();
