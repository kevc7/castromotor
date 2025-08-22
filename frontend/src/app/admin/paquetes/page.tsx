"use client";

import React, { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type SorteoLite = { id: string | number; nombre: string };
type Paquete = {
  id: string | number;
  nombre?: string | null;
  descripcion?: string | null;
  cantidad_numeros?: number | null;
  porcentaje_descuento?: number | null;
  precio_total?: number | null;
  estado?: string | null;
};

export default function AdminPaquetesPage() {
  const [sorteos, setSorteos] = useState<SorteoLite[]>([]);
  const [sorteoId, setSorteoId] = useState<string | number | "">("");
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", cantidad_numeros: 5, porcentaje_descuento: 0, precio_total: 0 });
  const [disponibles, setDisponibles] = useState<number | null>(null);
  const [errCantidad, setErrCantidad] = useState<string | null>(null);
  const [errDescuento, setErrDescuento] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function cargarSorteos() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const res = await fetch(`${API_BASE}/api/admin/sorteos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
    const data = await res.json();
    setSorteos(data.sorteos || []);
    if (data.sorteos?.length) {
      setSorteoId(String(data.sorteos[0].id));
    }
  }

  async function cargarPaquetes(id: string | number) {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`${API_BASE}/api/admin/sorteos/${id}/paquetes`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const data = await res.json();
      setPaquetes(data.paquetes || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarSorteos();
  }, []);

  useEffect(() => {
    if (sorteoId) {
      cargarPaquetes(sorteoId);
      // Cargar conteos para validar límite de cantidad disponible
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/sorteos/${sorteoId}`);
          const data = await res.json();
          const c = data?.conteos;
          const disp = typeof c?.disponibles === 'number' ? c.disponibles : ((c?.total || 0) - (c?.vendidos || 0));
          setDisponibles(Math.max(0, Number(disp || 0)));
        } catch {
          setDisponibles(null);
        }
      })();
    }
  }, [sorteoId]);

  function sanitizeCantidad(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") return ""; // permite borrar para reescribir
    return String(Math.max(1, Number(digits)));
  }
  function sanitizeDescuento(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") return "";
    const n = Math.max(0, Math.min(100, Number(digits)));
    return String(n);
  }

  function onCantidadChange(raw: string) {
    const valStr = sanitizeCantidad(raw);
    let n = Number(valStr || 0);
    let err: string | null = null;
    if (valStr === "") {
      setForm({ ...form, cantidad_numeros: 0 });
      setErrCantidad('Ingresa una cantidad válida');
      return;
    }
    if (disponibles !== null && n > disponibles) {
      n = disponibles;
      err = `No puede superar los disponibles (${disponibles})`;
    }
    if (n < 1) err = 'Debe ser al menos 1';
    setForm({ ...form, cantidad_numeros: n });
    setErrCantidad(err);
  }

  function onDescuentoChange(raw: string) {
    const valStr = sanitizeDescuento(raw);
    if (valStr === "") {
      setForm({ ...form, porcentaje_descuento: 0 });
      setErrDescuento('Ingresa un porcentaje válido (0–100)');
      return;
    }
    const n = Math.max(0, Math.min(100, Number(valStr)));
    setForm({ ...form, porcentaje_descuento: n });
    setErrDescuento(null);
  }

  const invalid = (
    !sorteoId ||
    form.cantidad_numeros < 1 ||
    (disponibles !== null && form.cantidad_numeros > disponibles) ||
    form.porcentaje_descuento < 0 || form.porcentaje_descuento > 100 ||
    Boolean(errCantidad) || Boolean(errDescuento)
  );

  async function crearPaquete(e: React.FormEvent) {
    e.preventDefault();
    if (!sorteoId) return;
    if (invalid) { setMsg('Corrige los campos marcados antes de crear el paquete'); return; }
    setMsg(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const res = await fetch(`${API_BASE}/api/admin/sorteos/${sorteoId}/paquetes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        nombre: form.nombre || undefined,
        descripcion: form.descripcion || undefined,
        cantidad_numeros: Number(form.cantidad_numeros),
        porcentaje_descuento: Number(form.porcentaje_descuento) || 0,
        // precio_total se calcula en backend
      }),
    });
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
    const data = await res.json();
    if (!res.ok) {
      setMsg(data?.error || "Error al crear paquete");
      return;
    }
    setMsg("Paquete creado");
    setForm({ ...form, nombre: "", descripcion: "" });
    await cargarPaquetes(sorteoId);
  }

  async function eliminarPaquete(id: string | number) {
    if (!confirm("Eliminar paquete?")) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const r = await fetch(`${API_BASE}/api/admin/paquetes/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.status === 401) { window.location.href = '/admin/login'; return; }
    await cargarPaquetes(sorteoId);
  }

  async function publicarPaquete(id: string | number) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const r = await fetch(`${API_BASE}/api/admin/paquetes/${id}/publicar`, { method: 'PATCH', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.status === 401) { window.location.href = '/admin/login'; return; }
    await cargarPaquetes(sorteoId);
  }

  async function despublicarPaquete(id: string | number) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const r = await fetch(`${API_BASE}/api/admin/paquetes/${id}/borrador`, { method: 'PATCH', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.status === 401) { window.location.href = '/admin/login'; return; }
    await cargarPaquetes(sorteoId);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white">
      <div className="px-6 pt-8 pb-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestionar paquetes</h1>
            <p className="text-slate-300 mt-1">Crea paquetes promocionales por sorteo para impulsar ventas rápidas.</p>
          </div>
          <a href="/admin" className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-sm">← Volver al panel</a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-6 pb-10">
        {/* Formulario */}
        <section className="p-6 rounded-xl border border-white/10 bg-white/5 space-y-4">
          <h2 className="text-xl font-semibold">Nuevo paquete</h2>
          <label className="grid gap-1">
            <span className="text-xs text-slate-400">Sorteo</span>
            <select className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={sorteoId} onChange={(e) => setSorteoId(e.target.value)}>
              {sorteos.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>{s.nombre}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-slate-400">Nombre (opcional)</span>
            <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-slate-400">Descripción (opcional)</span>
            <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-slate-400">Cantidad de números</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\\d*"
                className={`border rounded-md px-3 py-2 text-white bg-black/30 ${errCantidad ? 'border-rose-500/50 ring-1 ring-rose-500/40' : 'border-white/10'}`}
                value={form.cantidad_numeros || ''}
                onChange={(e) => onCantidadChange(e.target.value)}
                placeholder="Ej. 5"
              />
              <div className="text-[11px] text-slate-400">
                {disponibles !== null ? `Máximo disponible: ${disponibles}` : 'Cargando disponibles…'}
              </div>
              {errCantidad && <span className="text-[11px] text-rose-400">{errCantidad}</span>}
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-slate-400">% Descuento</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\\d*"
                className={`border rounded-md px-3 py-2 text-white bg-black/30 ${errDescuento ? 'border-rose-500/50 ring-1 ring-rose-500/40' : 'border-white/10'}`}
                value={form.porcentaje_descuento || ''}
                onChange={(e) => onDescuentoChange(e.target.value)}
                placeholder="0–100"
                maxLength={3}
              />
              {errDescuento && <span className="text-[11px] text-rose-400">{errDescuento}</span>}
            </label>
          </div>
          <AutoPrecio sorteoId={sorteoId} cantidad={form.cantidad_numeros} descuento={form.porcentaje_descuento} />
          <button onClick={crearPaquete} disabled={invalid} className={`px-4 py-2 rounded-md ${invalid ? 'bg-emerald-700/50 opacity-60 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}>Crear paquete</button>
          {msg && <div className="text-sm text-slate-300">{msg}</div>}
        </section>

        {/* Lista */}
        <section className="p-6 rounded-xl border border-white/10 bg-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Paquetes del sorteo</h2>
            <button onClick={() => sorteoId && cargarPaquetes(sorteoId)} className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10">Refrescar</button>
          </div>
          {loading && <div className="text-sm text-slate-300">Cargando…</div>}
          {!loading && paquetes.length === 0 && <div className="text-sm text-slate-300">No hay paquetes definidos.</div>}
          <div className="grid grid-cols-1 gap-3">
            {paquetes.map((p) => (
              <div key={String(p.id)} className="rounded-lg border border-white/10 bg-black/20 p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-semibold flex items-center gap-2 text-white">
                    {p.nombre || `${p.cantidad_numeros} números`}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.estado === 'publicado' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-600/20 text-slate-300 border border-white/10'}`}>{p.estado}</span>
                  </div>
                  <div className="text-sm text-slate-300">{p.descripcion || ""}</div>
                  <div className="text-sm text-slate-200">Precio: ${Number(p.precio_total || 0).toFixed(2)} {p.porcentaje_descuento ? `(desc. ${p.porcentaje_descuento}%)` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  {p.estado === 'publicado' ? (
                    <button onClick={() => despublicarPaquete(p.id)} className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10">Borrador</button>
                  ) : (
                    <button onClick={() => publicarPaquete(p.id)} className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Publicar</button>
                  )}
                  <button onClick={() => eliminarPaquete(p.id)} className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function AutoPrecio({ sorteoId, cantidad, descuento }: { sorteoId: string | number; cantidad: number; descuento: number }) {
  const [precioUnit, setPrecioUnit] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      if (!sorteoId) return;
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`${API_BASE}/api/admin/sorteos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      const s = (data.sorteos || []).find((x: any) => String(x.id) === String(sorteoId));
      setPrecioUnit(s ? Number(s.precio_por_numero) : null);
    })();
  }, [sorteoId]);
  const total = precioUnit !== null ? Math.round(precioUnit * cantidad * (1 - (Number(descuento || 0) / 100)) * 100) / 100 : 0;
  return (
    <div className="text-sm text-slate-700">
      Precio total calculado: <span className="font-semibold">${total.toFixed(2)}</span>
    </div>
  );
}


