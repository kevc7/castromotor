"use client";

import React, { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function AdminMetodosPagoPage() {
  const [metodos, setMetodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: "", tipo: "transferencia", activo: true, numero_cuenta: "", tipo_cuenta: "Ahorros", titular: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const r = await fetch(`${API_BASE}/api/admin/metodos_pago`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.status === 401) { window.location.href = '/admin/login'; return; }
    const d = await r.json();
    setMetodos(d.metodos || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const res = await fetch(`${API_BASE}/api/admin/metodos_pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ nombre: form.nombre, tipo: form.tipo, activo: form.activo, detalles: { numero_cuenta: form.numero_cuenta, tipo_cuenta: form.tipo_cuenta, titular: form.titular } })
    });
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
    const data = await res.json();
    if (!res.ok) { setMsg(data?.error || 'Error creando método'); return; }
    setForm({ nombre: "", tipo: "transferencia", activo: true, numero_cuenta: "", tipo_cuenta: "Ahorros", titular: "" });
    await load();
    setMsg('Método creado');
  }

  async function toggleActivo(id: any, activo: boolean) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    await fetch(`${API_BASE}/api/admin/metodos_pago`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id, activo: !activo, actualizar: true }) });
    await load();
  }

  async function guardarEdicion() {
    if (!edit) return;
    setSaving(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const body = { id: edit.id, nombre: edit.nombre, tipo: edit.tipo, activo: edit.activo, detalles: { numero_cuenta: edit.detalles?.numero_cuenta || '', tipo_cuenta: edit.detalles?.tipo_cuenta || '', titular: edit.detalles?.titular || '' }, actualizar: true };
    const res = await fetch(`${API_BASE}/api/admin/metodos_pago`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
    setEdit(null);
    await load();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white">
      <div className="px-6 pt-10 pb-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Métodos de pago</h1>
            <p className="text-slate-300 mt-1">Gestiona cuentas bancarias visibles al cliente.</p>
          </div>
          <a href="/admin" className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-sm">← Volver al panel</a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6 pb-12">
        <section className="md:col-span-1 p-5 rounded-xl border border-white/10 bg-white/5">
          <h2 className="text-lg font-semibold">Nuevo método</h2>
          <form onSubmit={crear} className="mt-3 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-slate-400">Nombre</span>
              <input required className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-slate-400">Tipo</span>
              <select className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
              </select>
            </label>
            <div className="grid grid-cols-1 gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-slate-400">Número de cuenta</span>
                <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={form.numero_cuenta} onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-400">Tipo de cuenta</span>
                <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={form.tipo_cuenta} onChange={(e) => setForm({ ...form, tipo_cuenta: e.target.value })} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-400">Titular</span>
                <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} />
              </label>
            </div>
            <button className="mt-2 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700">Guardar</button>
            {msg && <div className="text-xs text-emerald-400">{msg}</div>}
          </form>
        </section>

        <section className="md:col-span-2 p-5 rounded-xl border border-white/10 bg-white/5">
          <h2 className="text-lg font-semibold">Listado</h2>
          {loading ? (
            <div className="text-sm text-slate-400">Cargando…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              {metodos.map((m) => (
                <div key={m.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  {edit?.id === m.id ? (
                    <div className="space-y-2">
                      <input className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
                      <select className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm" value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>
                        <option value="transferencia">transferencia</option>
                        <option value="deposito">deposito</option>
                        <option value="gateway">gateway</option>
                      </select>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <input className="rounded-md border border-white/10 bg-black/30 px-2 py-1" placeholder="Número de cuenta" value={edit.detalles?.numero_cuenta || ''} onChange={(e) => setEdit({ ...edit, detalles: { ...(edit.detalles || {}), numero_cuenta: e.target.value } })} />
                        <input className="rounded-md border border-white/10 bg-black/30 px-2 py-1" placeholder="Tipo de cuenta" value={edit.detalles?.tipo_cuenta || ''} onChange={(e) => setEdit({ ...edit, detalles: { ...(edit.detalles || {}), tipo_cuenta: e.target.value } })} />
                        <input className="rounded-md border border-white/10 bg-black/30 px-2 py-1" placeholder="Titular" value={edit.detalles?.titular || ''} onChange={(e) => setEdit({ ...edit, detalles: { ...(edit.detalles || {}), titular: e.target.value } })} />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button className="px-3 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs" onClick={() => setEdit(null)} disabled={saving}>Cancelar</button>
                        <button className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={guardarEdicion} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium flex items-center justify-between">
                        <span>{m.nombre}</span>
                        <button className={`px-2 py-0.5 rounded-full text-xs ${m.activo ? 'bg-emerald-600/20 text-emerald-300' : 'bg-slate-600/20 text-slate-300'}`} onClick={() => toggleActivo(m.id, m.activo)}>
                          {m.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                      <div className="text-xs text-slate-300">{m.tipo} — {m.activo ? 'activo' : 'inactivo'}</div>
                      {m.detalles && (
                        <div className="mt-2 text-xs text-slate-300 space-y-1">
                          {m.detalles.numero_cuenta && <div><span className="text-slate-400">Cuenta:</span> {m.detalles.numero_cuenta}</div>}
                          {m.detalles.tipo_cuenta && <div><span className="text-slate-400">Tipo:</span> {m.detalles.tipo_cuenta}</div>}
                          {m.detalles.titular && <div><span className="text-slate-400">Titular:</span> {m.detalles.titular}</div>}
                        </div>
                      )}
                      <div className="mt-2 text-right">
                        <button className="px-3 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs" onClick={() => setEdit(m)}>Editar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


