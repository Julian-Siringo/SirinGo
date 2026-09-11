/* ============================================================
   pedidos-usuario.js
   ------------------------------------------------------------
   Página pedidos.html ("Mis pedidos"). Requiere estar logueado.
   Muestra los pedidos que el usuario hizo desde checkout.html
   (los que se hicieron como invitado no quedan guardados acá,
   así que no aparecen).
   ============================================================ */

(() => {
  const ETIQUETAS_ESTADO = {
    pendiente: { texto: 'Pendiente', clase: 'badge-pendiente' },
    pagado: { texto: 'Pagado', clase: 'badge-visto' },
    cancelado: { texto: 'Cancelado', clase: 'badge-cancelado' }
  };

  function formatearPrecio(valor) {
    return Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  }

  function formatearFecha(iso) {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function contarArticulos(items) {
    return (items || []).reduce((acum, item) => acum + (item.cantidad || 1), 0);
  }

  function tarjetaPedidoHTML(pedido) {
    const estado = ETIQUETAS_ESTADO[pedido.estado_pago] || ETIQUETAS_ESTADO.pendiente;
    const cantidadArticulos = contarArticulos(pedido.items);
    const envio = pedido.envio_monto != null ? formatearPrecio(pedido.envio_monto) : 'A coordinar';

    const puedeRetomarPago = pedido.estado_pago === 'pendiente' && pedido.metodo_pago === 'transferencia';

    return `
      <article class="pedido-card">
        <div class="pedido-card-fila">
          <div class="pedido-card-principal">
            <div class="pedido-card-numero">
              <strong>${pedido.numero}</strong>
              <span class="badge badge-usuario">${cantidadArticulos} artículo${cantidadArticulos === 1 ? '' : 's'}</span>
            </div>
            <div class="pedido-card-fecha">${formatearFecha(pedido.creado_en)}</div>
          </div>
          <div class="pedido-card-monto-bloque">
            <div class="pedido-card-monto">${formatearPrecio(pedido.total)} <span class="badge ${estado.clase}">${estado.texto}</span></div>
            <div class="pedido-card-detalle">Envío: ${envio}</div>
          </div>
        </div>
        ${puedeRetomarPago ? `
          <div class="pedido-card-acciones">
            <a href="pago.html?numero=${encodeURIComponent(pedido.numero)}" class="btn btn-primary btn-sm">Continuar pago</a>
          </div>
        ` : ''}
      </article>`;
  }

  async function inicializar() {
    const sesion = await protegerRutaUsuario();
    if (!sesion) return;

    const pedidos = await SirinGoDB.getPedidosPropios();
    const lista = document.getElementById('pedidosLista');
    const vacio = document.getElementById('pedidosVacio');

    if (pedidos.length === 0) {
      lista.innerHTML = '';
      vacio.hidden = false;
      return;
    }

    vacio.hidden = true;
    lista.innerHTML = pedidos.map(tarjetaPedidoHTML).join('');
  }

  document.addEventListener('DOMContentLoaded', inicializar);
})();
