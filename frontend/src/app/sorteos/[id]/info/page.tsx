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
  
  // Calcular ranking de paquetes: métrica = descuento% * cantidad_numeros
  const paquetesRank = useMemo(() => {
    try {
      const precioUnit = Number(data?.sorteo?.precio_por_numero || 0);
      const arr = (data?.paquetes || []).map((p: any) => {
        const cant = Number(p.cantidad_numeros || 0);
        const original = precioUnit * cant;
        const total = Number(p.precio_total || 0);
        const descuentoPct = original > 0 ? (1 - total / Math.max(0.01, original)) : 0;
        const score = descuentoPct * cant; // ponderar ahorro * volumen
        return { ...p, cant, original, total, descuentoPct, score };
      });
      const sorted = arr.sort((a: any, b: any) => b.score - a.score);
      return { top1: sorted[0]?.id, top2: sorted[1]?.id, map: arr.reduce((m: any, p: any) => { m[p.id] = p; return m; }, {}) };
    } catch { return { top1: null, top2: null, map: {} }; }
  }, [data?.paquetes, data?.sorteo?.precio_por_numero]);
  // Estado para animar la barra desde 0 -> porcentaje real
  const [progressAnimated, setProgressAnimated] = useState(0);
  useEffect(() => {
    if (vendidosPct >= 0) {
      setProgressAnimated(0);
      const id = requestAnimationFrame(() => setProgressAnimated(vendidosPct));
      return () => cancelAnimationFrame(id);
    }
  }, [vendidosPct]);

  return (
    <main className="min-h-screen bg-[#0f1725] text-white">
      {/* Navbar simple con logo y link para volver al inicio */}
      <nav className="sticky top-0 z-20 bg-[#0f1725]/95 backdrop-blur border-b border-white/10">
        <div className="relative max-w-6xl mx-auto flex items-center justify-center px-4 h-20">
          {/* Enlace separado a la izquierda */}
          <a href="/" className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-300 hover:text-white transition-colors tracking-wide" aria-label="Volver al inicio">
            Volver al inicio
          </a>
          {/* Logo centrado */}
          <a href="/" className="flex items-center group" aria-label="Inicio">
            <img src="/logo.png" alt="Logo" className="h-16 w-auto sm:h-20 drop-shadow-xl transition-transform group-hover:scale-105" />
          </a>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-center drop-shadow-sm">
              {data?.sorteo?.nombre}
            </h1>
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
                <div className="relative progress-container-animated">
                  <div className="progress-bar-track" style={{height:'1.15rem'}}>
                    {(() => {
                      const pct = progressAnimated;
                      let gradient = 'linear-gradient(90deg,#dc2626,#f87171,#fb923c)';
                      if (pct >= 25) gradient = 'linear-gradient(90deg,#f59e0b,#fbbf24,#fb923c)';
                      if (pct >= 55) gradient = 'linear-gradient(90deg,#10b981,#34d399,#10b981)';
                      if (pct >= 90) gradient = 'linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)';
                      return (
                        <div
                          className="progress-bar-fill progress-illusion transition-[width] duration-[1400ms] ease-out"
                          style={{ width: `${pct}%`, background: gradient }}
                        />
                      );
                    })()}
                    <span className="progress-badge" style={{fontSize:'0.72rem'}}>{Math.round(progressAnimated)}% completado</span>
                  </div>
                </div>
              </div>
            )}

            {/* Premios (números premiados) */}
            {Array.isArray(data?.premios) && data.premios.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-semibold mb-3">Premios</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {data.premios.map((p: any) => (
                    <div key={String(p.id)} className="rounded-lg bg-black/30 border border-white/10 p-3">
                      <div className={`text-sm font-bold tracking-wide ${p.vendido ? 'text-slate-400' : 'animate-gradient-text bg-gradient-to-r from-rose-400 via-amber-400 to-rose-400 bg-clip-text text-transparent'}`}>PREMIO: {p.descripcion}</div>
                      <div className={`text-lg font-bold ${p.vendido ? 'line-through text-slate-400' : 'text-white'}`}>#{p.numero_texto}</div>
                      {p.vendido && (
                        <div className="text-xs text-emerald-400">Reclamado</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
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
                  className="w-24 border border-white/10 bg-black/40 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60 transition shadow-sm"
                />
              </label>
              <button
                onClick={() => router.push(`/sorteos/${id}?cantidad=${cantidadPref}`)}
                disabled={Boolean(cantidadMsg)}
                className={`px-5 py-2 rounded-md text-white font-medium tracking-wide shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f1725] focus:ring-rose-500 ${cantidadMsg ? 'bg-rose-900/50 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 active:scale-[.97]'}`}
              >
                Comprar por cantidad
              </button>
              {cantidadMsg && <span className="text-xs text-amber-300 animate-pulse">{cantidadMsg}</span>}
            </div>

            {/* Paquetes promocionales */}
            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-3">Paquetes promocionales</h2>
              {Array.isArray(data?.paquetes) && data.paquetes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {data.paquetes.map((p: any) => {
                    const original = Number(data?.sorteo?.precio_por_numero || 0) * Number(p.cantidad_numeros || 0);
                    const ahorroPct = Math.max(0, Math.round((1 - Number(p.precio_total||0) / Math.max(0.01, original)) * 100));
                    const isTop1 = paquetesRank.top1 === p.id;
                    const isTop2 = paquetesRank.top2 === p.id;
                    return (
                      <div key={String(p.id)} className={`rounded-xl border border-white/10 p-4 card-prom relative ${isTop1 ? 'pkg-top1' : isTop2 ? 'pkg-top2' : 'bg-white/5'}`}>
                        {isTop1 && (
                          <span className="badge-rank absolute -top-3 left-3 shadow-md">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 15 9l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>
                            MEJOR PRECIO
                          </span>
                        )}
                        {isTop2 && !isTop1 && (
                          <span className="badge-rank secondary absolute -top-3 left-3 shadow-md">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 14.5 8.5 21 9l-5 4.9 1.2 6.9L12 17.8 6.8 20.8 8 14 3 9l6.5-.5z"/></svg>
                            Top 2
                          </span>
                        )}
                        <div className="text-sm font-medium flex items-center gap-2">
                          {p.nombre || `${p.cantidad_numeros} tickets`}
                        </div>
                        <div className="text-xs text-emerald-400 mt-0.5">Incluye {p.cantidad_numeros} tickets</div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="text-rose-400 text-xl font-bold">${Number(p.precio_total||0).toFixed(2)}</div>
                          <span className="badge-save">Ahorra {ahorroPct}%</span>
                        </div>
                        <div className="text-xs text-slate-400 line-through mt-0.5">${original.toFixed(2)}</div>
                        <button onClick={() => router.push(`/sorteos/${id}?paqueteId=${p.id}`)} className="mt-4 w-full px-3 py-2 btn-cta text-sm">Comprar</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-400">No hay paquetes disponibles para este sorteo.</div>
              )}
            </section>

            {/* Cómo participar */}
            <section className="mt-10 p-5 rounded-xl border border-white/10 bg-black/30">
              <h2 className="text-xl font-semibold mb-3">¿Cómo participar?</h2>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                <li>Elige cuántos números deseas (¡O selecciona un paquete promocional que ya trae varios números con descuento!).</li>
                <li>Haz clic en el botón de compra para ir al formulario del sorteo.</li>
                <li>Completa tus datos personales y escribe tu correo correctamente y número de teléfono CORRECTAMENTE (Te contactaremos por esos medios).</li>
                <li>Pide tu código de verificación; revisa tu correo e ingresa los 3 dígitos para validarlo.</li>
                <li>Selecciona un método de pago. Si es transferencia/deposito sube la imagen de tu comprobante de transferencia o deposito. Si es Payphone puedes pagar en línea.</li>
                <li>Confirma la compra. Recibirás un correo cuando un administrador apruebe tu pago, o en caso de pagar con payphone se te otorga tus numeros automaticamente hayas hecho la compra.</li>
                <li>Tus números quedarán registrados y te llegarán a tu correo electrónico ingresado; si el sorteo alcanza su meta se realizará con los numeros de la loteria nacional y se publicarán los ganadores.</li>
              </ol>
              <p className="mt-4 text-xs text-slate-400">Consejo: Asegurate de poner un correo y numero de telefono propio para podernos contactar contigo en caso de que seas el ganador!.</p>
            </section>

        
          </>
        )}
      </div>
    </main>
  );
}


