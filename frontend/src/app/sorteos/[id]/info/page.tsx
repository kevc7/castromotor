"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

function Carousel({ images }: { images: any[] }) {
  const [index, setIndex] = useState(0);
  const current = images?.[index];
  
  console.log('Carousel render:', { images, current, index });
  
  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Si es una ruta relativa, construir la URL completa
    const baseUrl = API_BASE.replace(/\/$/, '');
    const fullUrl = `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
    console.log('Image URL construction:', { original: url, baseUrl, fullUrl });
    return fullUrl;
  };
  
  return (
    <div className="absolute inset-0">
      {current && (
        <img
          src={getImageUrl(current.url)}
          alt={current.alt || "Sorteo"}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          onError={(e) => console.error('Error loading image:', current.url, e)}
          onLoad={() => console.log('Image loaded successfully:', current.url)}
        />
      )}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
              aria-label={`Imagen ${i + 1}`}
            />)
          )}
        </div>
      )}
      {images.length > 1 && (
        <>
          <button onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9">‹</button>
          <button onClick={() => setIndex((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9">›</button>
        </>
      )}
    </div>
  );
}

export default function SorteoInfoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cantidadPref, setCantidadPref] = useState<number>(1);
  const [cantidadMsg, setCantidadMsg] = useState<string | null>(null);
  const [imagenes, setImagenes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sRes, gRes] = await Promise.all([
          fetch(`${API_BASE}/api/sorteos/${id}`),
          fetch(`${API_BASE}/api/sorteos_con_ganadores`)
        ]);
        const sData = await sRes.json();
        const gData = await gRes.json();
        const premios = (gData.sorteos || []).find((s: any) => String(s.id) === String(id))?.premios || [];
        setData({ ...(sData || {}), premios });
        setImagenes(sData?.imagenes || []);
        console.log('Sorteo info data received:', sData);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const conteos = data?.conteos;
  const vendidosPct = useMemo(() => (conteos?.total ? Math.round((conteos.vendidos / conteos.total) * 100) : 0), [conteos]);

  return (
    <main className="min-h-screen bg-[#0f1725] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">{data?.sorteo?.nombre}</h1>
            {/* Debug: mostrar info de imágenes */}
            {imagenes && (
              <div className="mt-2 text-xs text-slate-400">
                Debug: {imagenes.length} imágenes cargadas
              </div>
            )}
            {/* Carrusel de imágenes */}
            {imagenes && imagenes.length > 0 ? (
              <div className="mt-4 w-full rounded-xl overflow-hidden border border-white/10 bg-black/30">
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <Carousel images={imagenes} />
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">
                No hay imágenes para mostrar
              </div>
            )}
            <p className="text-slate-300 mt-1">{data?.sorteo?.descripcion}</p>
            <div className="mt-4 text-sm text-slate-200">Precio por número: ${Number(data?.sorteo?.precio_por_numero || 0).toFixed(2)}</div>
            {conteos && (
              <div className="mt-4">
                <div className="relative">
                  <div className="h-5 w-full rounded-full bg-slate-700/40 overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-500 via-rose-400 to-rose-300 transition-all duration-1000 ease-out shadow-lg" 
                      style={{ width: `${vendidosPct}%` }}
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-semibold text-white drop-shadow-lg">
                      {Math.round(vendidosPct)}% completado
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-sm text-slate-300">Cantidad</span>
                <input
                  type="number"
                  min={1}
                  value={cantidadPref}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value || 1));
                    setCantidadPref(val);
                    const disponibles = (conteos?.disponibles ?? (conteos?.total || 0) - (conteos?.vendidos || 0)) as number;
                    if (disponibles && val > disponibles) {
                      setCantidadMsg(`Solo quedan ${disponibles} números disponibles`);
                    } else {
                      setCantidadMsg(null);
                    }
                  }}
                  className="w-24 border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white"
                />
              </label>
              <button
                onClick={() => router.push(`/sorteos/${id}?cantidad=${cantidadPref}`)}
                disabled={Boolean(cantidadMsg)}
                className={`px-4 py-2 rounded-md text-white ${cantidadMsg ? 'bg-rose-700/60 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                Comprar por cantidad
              </button>
              {cantidadMsg && <span className="text-xs text-amber-300">{cantidadMsg}</span>}
            </div>

            {/* Paquetes */}
            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-3">Paquetes promocionales</h2>
              {Array.isArray(data?.paquetes) && data.paquetes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {data.paquetes.map((p: any) => {
                    const original = Number(data?.sorteo?.precio_por_numero || 0) * Number(p.cantidad_numeros || 0);
                    return (
                      <div key={String(p.id)} className="rounded-xl border border-white/10 bg-white/5 p-4 card-prom">
                        <div className="text-sm font-medium">{p.nombre || `${p.cantidad_numeros} tickets`}</div>
                        <div className="text-xs text-emerald-400">Incluye {p.cantidad_numeros} tickets</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="text-rose-400 text-xl font-bold">${Number(p.precio_total||0).toFixed(2)}</div>
                          <span className="badge-save">Ahorra {Math.max(0, Math.round((1 - Number(p.precio_total||0) / Math.max(0.01, original)) * 100))}%</span>
                        </div>
                        <div className="text-xs text-slate-400 line-through">${original.toFixed(2)}</div>
                        <button onClick={() => router.push(`/sorteos/${id}?paqueteId=${p.id}`)} className="mt-3 w-full px-3 py-2 btn-cta text-sm">Comprar</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-400">No hay paquetes disponibles para este sorteo.</div>
              )}
            </section>

            {/* Premios */}
            {Array.isArray(data?.premios) && data.premios.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-semibold mb-3">Premios</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {data.premios.map((p: any) => (
                    <div key={String(p.id)} className="rounded-lg bg-black/30 border border-white/10 p-3">
                      <div className="text-sm font-bold text-slate-400">PREMIO: {p.descripcion}</div>
                      <div className={`text-lg font-bold ${p.vendido ? 'line-through text-slate-400' : 'text-white'}`}>#{p.numero_texto}</div>
                      {p.vendido && p.cliente && (
                        <div className="text-xs text-emerald-400">Ganador: {p.cliente.nombres} {p.cliente.apellidos}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}


