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
  const [stats, setStats] = useState<any>(null);

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
      setError(e?.message || "Error cargando órdenes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarPendientes();
  }, []);

  async function aprobar(ordenId: string | number) {
    setError(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const res = await fetch(`${API_BASE}/api/admin/orders/${ordenId}/approve`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Error al aprobar");
      return;
    }
    await cargarPendientes();
    alert("Orden aprobada");
  }

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | number | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  function abrirRechazo(ordenId: string | number) {
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
      const res = await fetch(`${API_BASE}/api/admin/orders/${rejectId}/reject`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: rejectMotivo }) });
      if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const data = await res.json();
      if (!res.ok) { alert(data?.error || 'Error al rechazar'); return; }
      await cargarPendientes();
      setRejectOpen(false);
    } finally {
      setRejectLoading(false);
    }
  }

  const [openId, setOpenId] = useState<string | number | null>(null);

  function toggle(oid: string | number) {
    setOpenId((prev) => (String(prev) === String(oid) ? null : oid));
  }

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
        <button onClick={cargarPendientes} className="px-3 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/20 text-white">Refrescar</button>
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

        {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

        <div className="grid grid-cols-1 gap-3">
          {loading && <div className="text-sm text-slate-600">Cargando...</div>}
          {!loading && ordenes.length === 0 && (
            <div className="text-sm text-slate-600">No hay órdenes pendientes.</div>
          )}
          {ordenes.map((o) => (
            <div key={String(o.id)} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-semibold">{o.codigo}</div>
                  <div className="text-sm text-slate-300">Estado: {o.estado_pago}</div>
                  <div className="text-sm text-slate-300">Sorteo: {o.sorteo?.nombre ?? String(o.sorteo_id ?? "-")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(o.id)} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20">{String(openId) === String(o.id) ? 'Ocultar' : 'Ver detalles'}</button>
                  <button onClick={() => aprobar(o.id)} className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Aprobar</button>
                  <button onClick={() => abrirRechazo(o.id)} className="px-3 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700">Rechazar</button>
                </div>
              </div>

              {String(openId) === String(o.id) && (
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
          ))}
        </div>
      </div>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !rejectLoading && setRejectOpen(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-white shadow-xl">
            <div className="text-lg font-semibold">Rechazar orden</div>
            <div className="mt-2 text-sm text-slate-300">Escribe el motivo para notificar al cliente (opcional).</div>
            <textarea className="mt-3 w-full h-28 resize-none rounded-md border border-white/10 bg-black/30 p-3 text-sm outline-none focus:ring-1 focus:ring-rose-500" placeholder="Motivo de rechazo" value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value)} disabled={rejectLoading} />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setRejectOpen(false)} disabled={rejectLoading} className="px-3 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/20 text-sm">Cancelar</button>
              <button onClick={confirmarRechazo} disabled={rejectLoading} className="px-3 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-sm font-medium inline-flex items-center gap-2">
                {rejectLoading && <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                Confirmar rechazo
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


