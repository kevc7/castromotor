"use client";

import React, { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

const AdminClient: React.FC = () => {
  const [createLoading, setCreateLoading] = useState(false);
  const [premiosLoading, setPremiosLoading] = useState(false);
  const [sorteo, setSorteo] = useState<any>(null);
  const [premios, setPremios] = useState<any[]>([]);
  const [premiosInputs, setPremiosInputs] = useState<string[]>([]);
  const [estado, setEstado] = useState<null | {
    numeros: { total: number; vendidos: number; disponibles: number };
    premios: { definidos: number; asignados: number; restantes: number };
  }>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sorteosList, setSorteosList] = useState<any[]>([]);

  async function cargarSorteos() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const r = await fetch(`${API_BASE}/api/admin/sorteos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.status === 401) { window.location.href = '/admin/login'; return; }
    const d = await r.json();
    setSorteosList(d.sorteos || []);
  }

  React.useEffect(() => {
    cargarSorteos();
  }, []);

  async function cargarEstado(sorteoId: bigint | number) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const res = await fetch(`${API_BASE}/api/admin/sorteos/${sorteoId}/estado`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return;
    const data = await res.json();
    setEstado({ numeros: data.numeros, premios: data.premios });
    const restantes = Number(data?.premios?.restantes || 0);
    if (restantes >= 0) {
      setPremiosInputs(Array.from({ length: restantes }, () => ""));
    }
  }

  async function crearSorteo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setCreateLoading(true);
    setErrorMsg(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const res = await fetch(`${API_BASE}/api/admin/sorteos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          nombre: form.get("nombre"),
          descripcion: form.get("descripcion") || null,
          cantidad_digitos: Number(form.get("cantidad_digitos")),
          precio_por_numero: Number(form.get("precio_por_numero")),
          cantidad_premios: Number(form.get("cantidad_premios")),
          generar_numeros: true,
        }),
      });
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al crear sorteo");
      setSorteo(data.sorteo);
      await cargarEstado(data.sorteo.id);
      await cargarSorteos();
      // limpiar formulario
      formEl.reset();
    } finally {
      setCreateLoading(false);
    }
  }

  async function crearPremios(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sorteo?.id) return;
    const descripciones = premiosInputs
      .map((s) => s.trim())
      .filter(Boolean)
      .map((d) => ({ descripcion: d }));
    if (descripciones.length === 0) return;
    // La cantidad de inputs está fijada por sorteo.cantidad_premios
    setPremiosLoading(true);
    setErrorMsg(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`${API_BASE}/api/admin/sorteos/${sorteo.id}/premios`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(descripciones),
      });
      if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al crear premios");
      setPremios(data.premios);
      await cargarEstado(sorteo.id);
    } finally {
      setPremiosLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white">
      <div className="px-6 pt-8 pb-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Panel Admin</h1>
            <p className="text-slate-300 mt-1">Gestiona sorteos y premios. Completa el sorteo primero para habilitar la creación de premios.</p>
          </div>
          <a href="/admin" className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-sm">← Volver al panel</a>
        </div>
      </div>

      {/* Sorteos existentes */}
      <section className="p-6 rounded-lg border border-white/10 bg-white/5 space-y-4 max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Sorteos existentes</h2>
          <button onClick={cargarSorteos} className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10">Refrescar</button>
        </div>
        {sorteosList.length === 0 ? (
          <div className="text-sm text-slate-300">No hay sorteos aún.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sorteosList.map((s) => (
              <div key={String(s.id)} className="rounded-lg border border-white/10 bg-black/20 p-3 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-semibold text-white">{s.nombre}</div>
                  <div className="text-sm text-slate-300">Precio por número: ${Number(s.precio_por_numero).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.estado === 'publicado' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-600/20 text-slate-300 border border-white/10'}`}>{s.estado}</span>
                  <button onClick={async () => {
                    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
                    const url = `${API_BASE}/api/admin/sorteos/${s.id}/${s.estado === 'publicado' ? 'borrador' : 'publicar'}`;
                    await fetch(url, { method: 'PATCH', headers: token ? { Authorization: `Bearer ${token}` } : {} });
                    await cargarSorteos();
                  }} className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10">{s.estado === 'publicado' ? 'Borrador' : 'Publicar'}</button>
                  {/* Botón de desactivación eliminado */}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="p-6 rounded-lg border border-white/10 bg-white/5 space-y-4 max-w-6xl mx-auto px-6">
        <h2 className="text-xl font-semibold">Crear sorteo</h2>
        {errorMsg && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-2 text-sm">{errorMsg}</div>
        )}
        <form onSubmit={crearSorteo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-xs text-slate-400">Nombre</span>
            <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" name="nombre" placeholder="Nombre" required />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-slate-400">Descripción</span>
            <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" name="descripcion" placeholder="Descripción" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-slate-400">Cantidad de dígitos</span>
            <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" name="cantidad_digitos" type="number" min={1} max={10} required />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-slate-400">Precio por número</span>
            <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" name="precio_por_numero" type="number" step="0.01" required />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-slate-400">Cantidad de premios (vacantes)</span>
            <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" name="cantidad_premios" type="number" min={1} required />
          </label>
          <div className="md:col-span-2 flex gap-3">
            <button disabled={createLoading} className="px-4 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
              {createLoading ? "Creando..." : "Crear sorteo (y generar números)"}
            </button>
          </div>
        </form>
        {sorteo && (
          <div className="text-sm text-gray-600 flex items-center justify-between">
            <div className="text-slate-300">Sorteo creado: ID {String(sorteo.id)} — {sorteo.nombre}</div>
          </div>
        )}
      </section>

      {/* Modal eliminar sorteo removido por solicitud */}

      <section className="p-6 rounded-lg border space-y-4 max-w-5xl mx-auto px-6">
        {estado && (
          <div className="text-sm text-gray-700 flex flex-wrap gap-4">
            <div>Total números: {estado.numeros.total}</div>
            <div>Vendidos: {estado.numeros.vendidos}</div>
            <div>Disponibles: {estado.numeros.disponibles}</div>
            <div>Premios definidos: {estado.premios.definidos}</div>
            <div>Premios asignados: {estado.premios.asignados}</div>
            <div>Premios restantes: {estado.premios.restantes}</div>
          </div>
        )}
        <h2 className="text-xl font-semibold">Crear premio/s para ({sorteo?.nombre ? `Sorteo: ${sorteo.nombre}` : 'Sorteo que se le asignará números ganadores'})</h2>
        <form onSubmit={crearPremios} className="space-y-3">
          {!sorteo?.id && (
            <div className="text-sm text-red-600">Debes crear un sorteo primero para definir premios.</div>
          )}
          {sorteo?.id && premiosInputs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {premiosInputs.map((value, idx) => (
                <label key={idx} className="grid gap-1">
                  <span className="text-xs text-slate-500">Descripción del premio #{idx + 1}</span>
                  <input
                    className="border rounded-md px-3 py-2"
                    placeholder={`Ej: Televisor 50"`}
                    value={value}
                    onChange={(e) => {
                      const copy = [...premiosInputs];
                      copy[idx] = e.target.value;
                      setPremiosInputs(copy);
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          <button disabled={!sorteo?.id || premiosLoading || premiosInputs.length === 0} className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            {premiosLoading ? "Asignando..." : "Crear premios y asignar números"}
          </button>
        </form>
          {premios.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {premios.map((p) => (
              <div key={p.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="font-semibold text-white">{p.descripcion}</div>
                <div className="text-sm text-slate-300">Número asignado: {p.numero_sorteo?.numero_texto || p.numero_sorteo_id}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default AdminClient;


