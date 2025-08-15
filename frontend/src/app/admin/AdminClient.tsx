"use client";

import React, { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function AdminClient() {
  const [sorteosList, setSorteosList] = useState<any[]>([]);
  const [sorteo, setSorteo] = useState<any>(null);
  const [imagenes, setImagenes] = useState<any[]>([]);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [premiosInputs, setPremiosInputs] = useState<string[]>([]);
  const [premios, setPremios] = useState<any[]>([]);
  const [premiosLoading, setPremiosLoading] = useState(false);
  const [estado, setEstado] = useState<any>(null);
  const [galeriaMsg, setGaleriaMsg] = useState<string | null>(null);
  const [galeriaType, setGaleriaType] = useState<'ok' | 'err' | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'images'>('list');
  const [createLoading, setCreateLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function cargarSorteos() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const r = await fetch(`${API_BASE}/api/admin/sorteos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.status === 401) { window.location.href = '/admin/login'; return; }
    const d = await r.json();
    setSorteosList(d.sorteos || []);
  }

  const cargarImagenes = async (sorteoId: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`${API_BASE}/api/admin/sorteos/${sorteoId}/imagenes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok) {
        setImagenes(data.imagenes || []);
      }
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!sorteo || !e.target.files || e.target.files.length === 0) return;
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const form = new FormData();
    Array.from(e.target.files).forEach((f) => form.append('files', f));
    
    setUploadMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/sorteos/${sorteo.id}/imagenes`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
      });
      const data = await res.json();
      if (res.ok) {
        setImagenes([...imagenes, ...(data.imagenes || [])]);
        setUploadMsg('Imágenes subidas correctamente');
        e.target.value = '';
      } else {
        setUploadMsg(data?.error || 'No se pudo subir las imágenes');
      }
    } catch (error) {
      setUploadMsg('Error al subir las imágenes');
    }
  };

  const setPortada = async (imgId: string) => {
    if (!sorteo) return;
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    try {
      await fetch(`${API_BASE}/api/admin/sorteos/${sorteo.id}/imagenes/${imgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ es_portada: true })
      });
      cargarImagenes(sorteo.id);
    } catch (error) {
      console.error('Error setting cover:', error);
    }
  };

  const eliminarImagen = async (imgId: string) => {
    if (!sorteo) return;
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    try {
      await fetch(`${API_BASE}/api/admin/sorteos/${sorteo.id}/imagenes/${imgId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      cargarImagenes(sorteo.id);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

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
      <section className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Sorteos existentes</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('create')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm"
            >
              Crear sorteo y números premiados
            </button>
            <button onClick={cargarSorteos} className="px-4 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10">
              Refrescar
            </button>
          </div>
        </div>
        {viewMode === 'list' && (
          <>
            {sorteosList.length === 0 ? (
              <div className="text-sm text-slate-300">No hay sorteos aún.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sorteosList.map((s) => (
                  <div key={s.id} className="p-4 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-lg font-semibold">{s.nombre}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${s.estado === 'publicado' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-600/20 text-slate-300 border border-white/10'}`}>
                          {s.estado}
                        </span>
                        <button
                          onClick={() => {
                            setSorteo(s);
                            cargarEstado(s.id);
                            cargarImagenes(s.id);
                            setViewMode('images');
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                        >
                          Imágenes
                        </button>
                        <button
                          onClick={async () => {
                            const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
                            const url = `${API_BASE}/api/admin/sorteos/${s.id}/${s.estado === 'publicado' ? 'borrador' : 'publicar'}`;
                            await fetch(url, { method: 'PATCH', headers: token ? { Authorization: `Bearer ${token}` } : {} });
                            await cargarSorteos();
                          }}
                          className="px-3 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                        >
                          {s.estado === 'publicado' ? 'Borrador' : 'Publicar'}
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-slate-300">Precio por número: ${Number(s.precio_por_numero).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {viewMode === 'create' && (
          <section className="p-6 rounded-lg border border-white/10 bg-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Crear sorteo</h2>
              <button
                onClick={() => setViewMode('list')}
                className="px-3 py-1 text-sm text-slate-300 hover:text-white"
              >
                ← Volver a la lista
              </button>
            </div>
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

            {/* Sección de crear premios */}
            <div className="mt-8 p-6 rounded-lg border border-white/10 bg-white/5">
              <h2 className="text-xl font-semibold">Crear premio/s para ({sorteo?.nombre ? `Sorteo: ${sorteo.nombre}` : 'Sorteo que se le asignará números ganadores'})</h2>
              <form onSubmit={crearPremios} className="space-y-3">
                {!sorteo?.id && (
                  <div className="text-sm text-red-600">Debes crear un sorteo primero para definir premios.</div>
                )}
                {sorteo?.id && (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-300">Agregar premio:</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={premiosInputs[premiosInputs.length - 1] || ""}
                        onChange={(e) => {
                          const newInputs = [...premiosInputs];
                          newInputs[newInputs.length - 1] = e.target.value;
                          setPremiosInputs(newInputs);
                        }}
                        placeholder="Descripción del premio"
                        className="flex-1 border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setPremiosInputs([...premiosInputs, ""])}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                      >
                        +
                      </button>
                    </div>
                    {premiosInputs.slice(0, -1).map((input, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={input}
                          onChange={(e) => {
                            const newInputs = [...premiosInputs];
                            newInputs[index] = e.target.value;
                            setPremiosInputs(newInputs);
                          }}
                          placeholder="Descripción del premio"
                          className="flex-1 border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newInputs = premiosInputs.filter((_, i) => i !== index);
                            setPremiosInputs(newInputs);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md"
                        >
                          -
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button disabled={!sorteo?.id || premiosLoading || premiosInputs.length === 0} className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                  {premiosLoading ? "Asignando..." : "Crear premios y asignar números"}
                </button>
              </form>
              
              {premios.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {premios.map((p) => (
                    <div key={p.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="font-semibold text-white">{p.descripcion}</div>
                      <div className="text-sm text-slate-300">Número asignado: {p.numero_sorteo?.numero_texto || p.numero_sorteo_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {viewMode === 'images' && sorteo && (
          <section className="mt-8 p-6 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Galería de imágenes - {sorteo.nombre}</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('list')}
                  className="px-3 py-1 text-sm text-slate-300 hover:text-white"
                >
                  ← Volver a la lista
                </button>
                <button
                  onClick={() => cargarImagenes(sorteo.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm"
                >
                  Refrescar
                </button>
              </div>
            </div>

            {/* Área de subida mejorada */}
            <div className="mb-6">
              <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center bg-black/20 hover:bg-black/30 transition-colors">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-white/40" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-lg font-medium text-white mb-2">Subir imágenes del sorteo</div>
                <div className="text-sm text-white/60 mb-4">
                  Arrastra y suelta las imágenes aquí, o haz clic para seleccionar
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="inline-flex items-center px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Seleccionar imágenes
                </label>
              </div>
              
              {uploadMsg && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${uploadMsg.includes('correctamente') ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-600/20 text-rose-300 border border-rose-500/30'}`}>
                  {uploadMsg}
                </div>
              )}
            </div>

            {/* Grid de imágenes */}
            {imagenes.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {imagenes.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={`${API_BASE}${img.url}`}
                      alt={img.alt || "Sorteo"}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <button
                        onClick={() => setPortada(img.id)}
                        className={`px-2 py-1 rounded text-xs ${img.es_portada ? 'bg-emerald-600 text-white' : 'bg-white/20 text-white hover:bg-emerald-600'}`}
                      >
                        {img.es_portada ? 'Portada' : 'Hacer portada'}
                      </button>
                      <button
                        onClick={() => eliminarImagen(img.id)}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs"
                      >
                        Borrar
                      </button>
                    </div>
                    {img.es_portada && (
                      <div className="absolute top-2 left-2 bg-emerald-600 text-white text-xs px-2 py-1 rounded">
                        Portada
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
      
    </main>
  );
};


