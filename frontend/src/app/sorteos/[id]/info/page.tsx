"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import FireParticles from "@/components/FireParticles";
import ThemeToggle from "@/components/ThemeToggle";

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
          className="absolute inset-0 w-full h-full object-contain sm:object-cover bg-black/50"
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
  const soldOut = useMemo(() => {
    if (!conteos || conteos.total == null || conteos.vendidos == null) return false;
    return Number(conteos.vendidos) >= Number(conteos.total);
  }, [conteos]);
  
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

  // Calcular mínimo permitido: (menor paquete + 1) o 1 si no hay paquetes
  const minAllowed = useMemo(() => {
    try {
      const cantidades = (data?.paquetes || []).map((p: any) => Number(p.cantidad_numeros || 0)).filter((n: number) => Number.isFinite(n) && n > 0);
      if (!cantidades.length) return 1;
      const menor = Math.min(...cantidades);
      return Math.max(1, menor + 1);
    } catch {
      return 1;
    }
  }, [data?.paquetes]);

  // Ajustar valor inicial respetando stock disponible
  useEffect(() => {
    const disp = (conteos?.disponibles ?? ((conteos?.total || 0) - (conteos?.vendidos || 0))) as number;
    if (disp && disp > 0) {
      const start = Math.min(Math.max(minAllowed, 1), disp);
      setCantidadPref(start);
      setCantidadMsg(null);
    }
  }, [minAllowed, conteos?.disponibles, conteos?.total, conteos?.vendidos]);

  return (
    <main className="min-h-screen bg-[#0f1725] text-white relative">
      {/* Partículas de fuego de fondo */}
      <FireParticles intensity="low" particleCount={25} />
      
      {/* Navbar simple con logo y link para volver al inicio */}
      <nav className="sticky top-0 z-20 bg-[#0f1725]/95 backdrop-blur border-b border-white/10">
        <div className="relative max-w-6xl mx-auto flex items-center justify-between px-4 h-20">
          <a href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors tracking-wide" aria-label="Volver al inicio">
            Volver al inicio
          </a>
          <a href="/" className="flex items-center group absolute left-1/2 -translate-x-1/2" aria-label="Inicio">
            <img src="/logo.png" alt="Logo" className="h-16 w-auto sm:h-20 drop-shadow-xl transition-transform group-hover:scale-105" />
          </a>
          <div className="flex items-center gap-4">
            <ThemeToggle variant="inline" />
          </div>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
        {loading ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-center drop-shadow-sm fade-in-up">
              {data?.sorteo?.nombre}
            </h1>
            {/* Carrusel de imágenes */}
            {imagenes && imagenes.length > 0 ? (
              <div className="mt-4 w-full rounded-xl overflow-hidden border border-white/10 bg-black/30 zoom-in">
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <Carousel images={imagenes} />
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">
                No hay imágenes para mostrar
              </div>
            )}

            {/* Footer moved to bottom */}
            <p className="text-lg sm:text-xl text-slate-100/90 mt-3 tracking-wide leading-relaxed drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)] fade-in-up">{data?.sorteo?.descripcion}</p>
            <div className="mt-4 text-sm text-slate-200 price-per-number">Precio por número: ${Number(data?.sorteo?.precio_por_numero || 0).toFixed(2)}</div>
            {conteos && (
              <div className="mt-4 fade-in-up">
                <div className="relative progress-container-animated">
                  <div className="progress-bar-track" style={{height:'2.3rem'}}>
                    {(() => {
                      const pct = progressAnimated;
                      // Brand-friendly gradient steps
                      let gradient = 'linear-gradient(90deg,#6b1d06,#AA2F0B,#fb923c)';
                      if (pct >= 25) gradient = 'linear-gradient(90deg,#AA2F0B,#f59e0b,#fb923c)';
                      if (pct >= 55) gradient = 'linear-gradient(90deg,#f59e0b,#fde047,#AA2F0B)';
                      if (pct >= 90) gradient = 'linear-gradient(90deg,#0a84ff,#1d4ed8,#AA2F0B)';
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
              <section className="mt-8 fade-stagger">
                <h2 className="text-xl font-semibold mb-3">Premios</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {data.premios.map((p: any) => (
                    <div key={String(p.id)} className="rounded-lg bg-black/30 border border-white/10 p-3 premio-card">
                      <div className={`text-sm font-bold tracking-wide ${p.vendido ? 'text-slate-600' : 'animate-gradient-text bg-gradient-to-r from-[#AA2F0B] via-amber-400 to-[#AA2F0B] bg-clip-text text-transparent'}`}>PREMIO: {p.descripcion}</div>
                      <div className={`text-lg font-bold ${p.vendido ? 'line-through text-slate-400' : 'text-white'}`}>#{p.numero_texto}</div>
                      {p.vendido && (
                        <div className="text-xs text-emerald-400">Reclamado</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Área de compra: paquetes primero, luego compra por cantidad. Si está agotado, mostrar mensaje y ocultar ambas opciones. */}
            {soldOut ? (
              <section className="mt-8 p-6 rounded-2xl border border-white/10 relative overflow-hidden bg-gradient-to-br from-black/40 via-black/30 to-black/40">
                <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.15),transparent_55%)]" />
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-[#AA2F0B] via-amber-300 to-[#AA2F0B] bg-clip-text text-transparent drop-shadow glow-pulse">¡TODOS LOS NÚMEROS SE HAN VENDIDO, MUCHA SUERTE!</span>
                </h2>
                <p className="mt-3 text-slate-200/90 text-sm sm:text-base max-w-3xl leading-relaxed">
                  El gran sorteo ya comenzó. Si participaste, mantente atento a nuestras redes sociales o a esta página de la empresa; pronto publicaremos a los ganadores.
                </p>
                <div className="mt-6 flex justify-center">
                  {(() => {
                    const tutorialLink = process.env.NEXT_PUBLIC_VIDEO_TUTORIAL_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
                    return (
                      <a
                        href={tutorialLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ring-pulse group relative inline-flex items-center gap-3 px-6 py-3 rounded-md font-extrabold tracking-wide text-white text-sm md:text-base overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f1725] focus:ring-blue-500 btn-intro"
                        style={{ background: 'linear-gradient(90deg,#0047ff,#0a84ff)', boxShadow: '0 0 0 0 rgba(0,119,255,0.6)' }}
                      >
                        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[linear-gradient(90deg,rgba(255,255,255,0.15),rgba(255,255,255,0))]" />
                        <span className="relative flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                          </span>
                          <span className="text-base">VIDEO TUTORIAL DE COMPRA</span>
                        </span>
                        <span className="absolute -inset-8 animate-pulse rounded-full bg-blue-500/20 blur-xl" />
                      </a>
                    );
                  })()}
                </div>
              </section>
            ) : null}

            {/* Cómo participar */}
            <section className="mt-10 p-5 sm:p-7 rounded-2xl glassy-como border border-brand-gradient shadow-xl relative overflow-hidden fade-in-up">
              <h2 className="text-2xl font-extrabold mb-3 section-title-brand">¿Cómo participar?</h2>
              <ol className="space-y-2 text-base como-list" style={{listStyle: 'none'}}>
                <li>Elige cuántos números deseas (¡O selecciona un paquete promocional que ya trae varios números con descuento!).</li>
                <li>Haz clic en el botón de compra para ir al formulario del sorteo.</li>
                <li>Completa tus datos personales y escribe tu correo correctamente y número de teléfono <b>CORRECTAMENTE</b> (Te contactaremos por esos medios).</li>
                <li>Pide tu código de verificación; revisa tu correo e ingresa los 3 dígitos para validarlo.</li>
                <li>Selecciona un método de pago. Si es transferencia/deposito sube la imagen de tu comprobante de transferencia o deposito. Si es Payphone puedes pagar en línea.</li>
                <li>Confirma la compra. Recibirás un correo cuando un administrador apruebe tu pago, o en caso de pagar con payphone se te otorga tus numeros automaticamente hayas hecho la compra.</li>
                <li>Tus números quedarán registrados y te llegarán a tu correo electrónico ingresado; si el sorteo alcanza su meta se realizará con los numeros de la loteria nacional y se publicarán los ganadores.</li>
              </ol>
              <p className="mt-4 text-xs text-slate-500 font-medium">Consejo: Asegúrate de poner un correo y número de teléfono propio para podernos contactar contigo en caso de que seas el ganador.</p>
            </section>
            {/* Botón de video tutorial (después de ¿Cómo participar?) */}
            <div className="mt-6 flex justify-center">
              {(() => {
                const tutorialLink = process.env.NEXT_PUBLIC_VIDEO_TUTORIAL_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
                return (
                  <a
                    href={tutorialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ring-pulse group relative inline-flex items-center gap-3 px-6 py-3 rounded-md font-extrabold tracking-wide text-white text-sm md:text-base overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f1725] focus:ring-blue-500 btn-intro"
                    style={{ background: 'linear-gradient(90deg,#0047ff,#0a84ff)', boxShadow: '0 0 0 0 rgba(0,119,255,0.6)' }}
                  >
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[linear-gradient(90deg,rgba(255,255,255,0.15),rgba(255,255,255,0))]" />
                    <span className="relative flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                      </span>
                      <span className="text-base">VIDEO TUTORIAL DE COMPRA</span>
                    </span>
                    <span className="absolute -inset-8 animate-pulse rounded-full bg-blue-500/20 blur-xl" />
                  </a>
                );
              })()}
            </div>

            {/* Paquetes y compra por cantidad ahora debajo del tutorial (si hay stock) */}
            {!soldOut && (
              <>
                <section className="mt-8 fade-stagger">
                  <h2 className="text-xl font-semibold mb-3">Paquetes promocionales</h2>
                  {(() => {
                    const disponibles = (conteos?.disponibles ?? (conteos?.total || 0) - (conteos?.vendidos || 0)) as number;
                    const visibles = (Array.isArray(data?.paquetes) ? data.paquetes : []).filter((p: any) => Number(p.cantidad_numeros || 0) <= Number(disponibles || 0));
                    return visibles.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {visibles.map((p: any) => {
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
                              <div className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                                {p.nombre || `${p.cantidad_numeros} tickets`}
                              </div>
                              <div className="text-sm sm:text-base text-emerald-400 mt-1 font-medium">Incluye {p.cantidad_numeros} tickets</div>
                              {(() => {
                                const showDescuento = ahorroPct > 0 && Number(p.precio_total||0) < original;
                                return (
                                  <>
                                    <div className="flex items-center gap-2 mt-3">
                                      <div className="text-rose-400 text-2xl font-extrabold">${Number(p.precio_total||0).toFixed(2)}</div>
                                      {showDescuento && (
                                        <span className="badge-save">Ahorra {ahorroPct}%</span>
                                      )}
                                    </div>
                                    {showDescuento && (
                                      <div className="text-xs sm:text-sm text-slate-400 line-through mt-0.5">${original.toFixed(2)}</div>
                                    )}
                                  </>
                                );
                              })()}
                              <button onClick={() => router.push(`/checkout/${id}?paqueteId=${p.id}`)} className="mt-4 w-full px-3 py-2 btn-cta text-sm">Comprar</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400">No hay paquetes disponibles para este sorteo.</div>
                    );
                  })()}
                </section>

                <div className="mt-8 flex flex-col items-center gap-4 fade-in-up">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <label className="flex items-center gap-2">
                      <span className="text-sm text-slate-300">¿Más números?</span>
                      <input
                        type="number"
                        min={minAllowed}
                        value={cantidadPref}
                        onChange={(e) => {
                          const val = Math.max(minAllowed, Number(e.target.value || minAllowed));
                          setCantidadPref(val);
                          const disponibles = (conteos?.disponibles ?? (conteos?.total || 0) - (conteos?.vendidos || 0)) as number;
                          if (disponibles && val > disponibles) {
                            setCantidadMsg('¡No tenemos esa cantidad! :(');
                          } else {
                            setCantidadMsg(null);
                          }
                        }}
                        className="w-24 border border-white/10 bg-black/40 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/60 transition shadow-sm"
                      />
                    </label>
                    <button
                      onClick={() => router.push(`/checkout/${id}?cantidad=${cantidadPref}`)}
                      disabled={Boolean(cantidadMsg)}
                      className={`px-5 py-2 rounded-md text-white font-medium tracking-wide shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f1725] focus:ring-rose-500 ${cantidadMsg ? 'bg-rose-900/50 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 active:scale-[.97]'}`}
                    >
                      Comprar por cantidad
                    </button>
                  </div>
                  {cantidadMsg && <span className="text-xs text-amber-300 animate-pulse text-center">{cantidadMsg}</span>}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {/* Cloned footer from home at the very bottom */}
      <footer className="bg-black/20 border-t border-white/10 mt-20 home-footer">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">C</span>
                </div>
                <div>
                  <div className="font-bold text-white title">Castromotor</div>
                  <div className="text-sm text-slate-400 muted">Sorteos</div>
                </div>
              </div>
              <p className="text-sm text-slate-300 muted">Tu destino para sorteos emocionantes y premios increíbles. Compra tickets y participa en nuestros sorteos exclusivos.</p>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-white title">Enlaces rápidos</h3>
              <div className="space-y-2">
                <a href="/" className="block text-sm text-slate-300 hover:text-white transition-colors muted">Inicio</a>
                <a href="/terminos-condiciones" className="block text-sm text-slate-300 hover:text-white transition-colors muted">Términos y Condiciones</a>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-white title">Contacto</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  <a href="tel:+593981309202" className="text-sm text-slate-300 hover:text-white transition-colors muted">+593 98 130 9202</a>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <a href="mailto:info@castromotor.com.ec" className="text-sm text-slate-300 hover:text-white transition-colors muted">info@castromotor.com.ec</a>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <span className="text-sm text-slate-300 muted">Ecuador</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-white title">Síguenos</h3>
              <div className="flex gap-3">
                <a href="https://wa.me/593981309202" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-green-600 hover:bg-green-700 rounded-lg flex items-center justify-center transition-colors"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173 0-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.892 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg></a>
                <a href="https://facebook.com/castromotor" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                <a href="https://instagram.com/castromotor" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg flex items-center justify-center transition-colors"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.418-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.928.875 1.418 2.026 1.418 3.323s-.49 2.448-1.418 3.244c-.875.807-2.026 1.297-3.323 1.297z"/></svg></a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-slate-400 muted">© 2025 Castromotor Sorteos. Todos los derechos reservados.</div>
              <div className="flex gap-6 text-sm">
                <a href="#" className="text-slate-400 hover:text-white transition-colors muted">¡Buena suerte!</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}


