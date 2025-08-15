"use client";

import React, { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type Orden = {
  id: string | number;
  codigo: string;
  estado_pago: string;
  monto_total: number | null;
  sorteo_id: string | number | null;
  ruta_comprobante?: string | null;
  metodo_pago?: string | null;
  cantidad_numeros?: number | null;
  cliente?: { nombres?: string; apellidos?: string; cedula?: string; correo_electronico?: string; telefono?: string; direccion?: string } | null;
  sorteo?: { nombre?: string } | null;
};

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(false);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  
  // Estados de carga para cada orden
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  // Función para mostrar mensajes temporales
  const showMessage = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccess(message);
      setError(null);
    } else {
      setError(message);
      setSuccess(null);
    }
    
    // Auto-ocultar después de 4 segundos
    setTimeout(() => {
      if (type === 'success') {
        setSuccess(null);
      } else {
        setError(null);
      }
    }, 4000);
  };

  async function cargarPendientes() {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`${API_BASE}/api/admin/orders?estado=pendiente`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const data = await res.json();
      setOrdenes(data.ordenes || []);
      const sres = await fetch(`${API_BASE}/api/admin/stats`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (sres.status === 401) { window.location.href = '/admin/login'; return; }
      const sdata = await sres.json();
      setStats(sdata);
    } catch (e: any) {
      showMessage('error', e?.message || "Error cargando órdenes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarPendientes();
  }, []);

  async function aprobar(ordenId: string | number) {
    const orderKey = String(ordenId);
    
    // Prevenir múltiples clicks
    if (loadingStates[orderKey] || processingOrder) return;
    
    setLoadingStates(prev => ({ ...prev, [orderKey]: true }));
    setProcessingOrder(orderKey);
    setError(null);
    
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`${API_BASE}/api/admin/orders/${ordenId}/approve`, { 
        method: "POST", 
        headers: token ? { Authorization: `Bearer ${token}` } : {} 
      });
      
      if (res.status === 401) { 
        window.location.href = '/admin/login'; 
        return; 
      }
      
      const data = await res.json();
      if (!res.ok) {
        showMessage('error', data?.error || "Error al aprobar la orden");
        return;
      }
      
      await cargarPendientes();
      showMessage('success', "✅ Orden aprobada exitosamente. Se han asignado los números y enviado el correo de confirmación.");
    } catch (e: any) {
      showMessage('error', e?.message || "Error al aprobar la orden");
    } finally {
      setLoadingStates(prev => ({ ...prev, [orderKey]: false }));
      setProcessingOrder(null);
    }
  }

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | number | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  function abrirRechazo(ordenId: string | number) {
    const orderKey = String(ordenId);
    
    // Prevenir múltiples clicks
    if (loadingStates[orderKey] || processingOrder) return;
    
    setRejectId(ordenId);
    setRejectMotivo("");
    setRejectOpen(true);
  }

  async function confirmarRechazo() {
    if (!rejectId) return;
    
    setError(null);
    setRejectLoading(true);
    
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`${API_BASE}/api/admin/orders/${rejectId}/reject`, { 
        method: "POST", 
        headers: { 
          ...(token ? { Authorization: `Bearer ${token}` } : {}), 
          'Content-Type': 'application/json' 
        }, 
        body: JSON.stringify({ motivo: rejectMotivo }) 
      });
      
      if (res.status === 401) { 
        window.location.href = '/admin/login'; 
        return; 
      }
      
      const data = await res.json();
      if (!res.ok) { 
        showMessage('error', data?.error || 'Error al rechazar la orden');
        return; 
      }
      
      await cargarPendientes();
      setRejectOpen(false);
      showMessage('success', "❌ Orden rechazada exitosamente. Se han liberado los números y notificado al cliente.");
    } catch (e: any) {
      showMessage('error', e?.message || 'Error al rechazar la orden');
    } finally {
      setRejectLoading(false);
    }
  }

  const [openId, setOpenId] = useState<string | number | null>(null);

  function toggle(oid: string | number) {
    setOpenId((prev) => (String(prev) === String(oid) ? null : oid));
  }

  // Componente de spinner de carga
  const LoadingSpinner = ({ size = "sm" }: { size?: "sm" | "md" }) => (
    <div className={`inline-block rounded-full border-2 border-white/40 border-t-white animate-spin ${
      size === "sm" ? "h-4 w-4" : "h-5 w-5"
    }`} />
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white">
      <div className="px-6 pt-8 pb-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Órdenes pendientes</h1>
            <p className="text-slate-300 mt-1">Aprueba órdenes y asigna números en forma transaccional.</p>
          </div>
          <a href="/admin" className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-sm">← Volver al panel</a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 space-y-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={cargarPendientes} 
            disabled={loading}
            className="px-3 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {loading && <LoadingSpinner size="sm" />}
            {loading ? 'Actualizando...' : 'Refrescar'}
          </button>
        </div>

        {/* Stats header */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat title="Ganancias" value={`$${Number(stats.total_ganancias).toFixed(2)}`} />
            <Stat title="Tickets vendidos" value={`${Number(stats.tickets_vendidos)}`} />
            <Stat title="Órdenes aprobadas" value={`${stats.ordenes_aprobadas}`} />
            <Stat title="Órdenes pendientes" value={`${stats.ordenes_pendientes}`} />
            <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm text-slate-300">Paquete más comprado</div>
              {stats.paquete_mas_comprado ? (
                <div className="text-xs text-slate-200 mt-1">
                  {stats.paquete_mas_comprado.nombre || `${stats.paquete_mas_comprado.cantidad_numeros} tickets`} — Compras: {stats.paquete_mas_comprado.compras}
                </div>
              ) : (
                <div className="text-xs text-slate-400 mt-1">Sin datos</div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm text-slate-300">Método top</div>
              <div className="text-xs text-slate-200 mt-1">{stats.metodo_pago_top || '—'}</div>
            </div>
          </div>
        )}

        {/* Mensajes de estado */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 px-4 py-3 text-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <span className="text-red-400">⚠️</span>
              {error}
            </div>
          </div>
        )}
        
        {success && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 px-4 py-3 text-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✅</span>
              {success}
            </div>
          </div>
        )}

        {/* Indicador de procesamiento global */}
        {processingOrder && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 px-4 py-3 text-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Procesando orden... Por favor espera.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-slate-400">
                <LoadingSpinner size="md" />
                <span>Cargando órdenes...</span>
              </div>
            </div>
          )}
          
          {!loading && ordenes.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <div className="text-4xl mb-2">📋</div>
              <div className="text-sm">No hay órdenes pendientes.</div>
            </div>
          )}
          
          {ordenes.map((o) => {
            const orderKey = String(o.id);
            const isProcessing = loadingStates[orderKey] || processingOrder === orderKey;
            const isDisabled = isProcessing || processingOrder !== null;
            
            return (
              <div key={orderKey} className={`rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-300 ${
                isProcessing ? 'ring-2 ring-amber-500/50 bg-amber-500/5' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold">{o.codigo}</div>
                    <div className="text-sm text-slate-300">Estado: {o.estado_pago}</div>
                    <div className="text-sm text-slate-300">Sorteo: {o.sorteo?.nombre ?? String(o.sorteo_id ?? "-")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggle(o.id)} 
                      disabled={isDisabled}
                      className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {String(openId) === orderKey ? 'Ocultar' : 'Ver detalles'}
                    </button>
                    <button 
                      onClick={() => aprobar(o.id)} 
                      disabled={isDisabled}
                      className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 min-w-[100px] justify-center"
                    >
                      {isProcessing && loadingStates[orderKey] && <LoadingSpinner size="sm" />}
                      {isProcessing && loadingStates[orderKey] ? 'Aprobando...' : 'Aprobar'}
                    </button>
                    <button 
                      onClick={() => abrirRechazo(o.id)} 
                      disabled={isDisabled}
                      className="px-3 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>

                {String(openId) === orderKey && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="text-sm font-medium text-white">Datos del cliente</div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="text-slate-400">Nombres</div>
                        <div className="text-slate-200">{o.cliente?.nombres ?? '-'}</div>
                        <div className="text-slate-400">Apellidos</div>
                        <div className="text-slate-200">{o.cliente?.apellidos ?? '-'}</div>
                        <div className="text-slate-400">Cédula</div>
                        <div className="text-slate-200">{o.cliente?.cedula ?? '-'}</div>
                        <div className="text-slate-400">Correo</div>
                        <div className="text-slate-200">{o.cliente?.correo_electronico ?? '-'}</div>
                        <div className="text-slate-400">Teléfono</div>
                        <div className="text-slate-200">{o.cliente?.telefono ?? '-'}</div>
                        <div className="text-slate-400">Dirección</div>
                        <div className="text-slate-200 sm:col-span-1">{o.cliente?.direccion ?? '-'}</div>
                      </div>
                      <div className="mt-3 text-sm text-slate-300">Compra</div>
                      <div className="text-xs text-slate-400">Cantidad: {o.cantidad_numeros ?? '-'}</div>
                      <div className="text-xs text-slate-400">Tipo: {o.cantidad_numeros ? (o.cantidad_numeros > 1 ? 'Paquete/Personalizada' : 'Personalizada') : '-'}</div>
                      <div className="text-xs text-slate-400">Método: {o.metodo_pago ?? '-'}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-300">Comprobante</div>
                        {o.ruta_comprobante && (
                          <a className="text-xs text-rose-300 hover:text-rose-200 underline" href={`${API_BASE}/${o.ruta_comprobante}`} download>Descargar</a>
                        )}
                      </div>
                      {o.ruta_comprobante ? (
                        <img src={`${API_BASE}/${o.ruta_comprobante}`} alt="Comprobante" className="mt-2 max-h-72 rounded border border-white/10" />
                      ) : (
                        <div className="text-xs text-slate-400 mt-2">Sin comprobante</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !rejectLoading && setRejectOpen(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-white shadow-xl">
            <div className="text-lg font-semibold">Rechazar orden</div>
            <div className="mt-2 text-sm text-slate-300">Escribe el motivo para notificar al cliente (opcional).</div>
            <textarea 
              className="mt-3 w-full h-28 resize-none rounded-md border border-white/10 bg-black/30 p-3 text-sm outline-none focus:ring-1 focus:ring-rose-500" 
              placeholder="Motivo de rechazo" 
              value={rejectMotivo} 
              onChange={(e) => setRejectMotivo(e.target.value)} 
              disabled={rejectLoading} 
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button 
                onClick={() => setRejectOpen(false)} 
                disabled={rejectLoading} 
                className="px-3 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/20 text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarRechazo} 
                disabled={rejectLoading} 
                className="px-3 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
              >
                {rejectLoading && <LoadingSpinner size="sm" />}
                {rejectLoading ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-sm text-slate-300">{title}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}


