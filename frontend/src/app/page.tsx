"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

function SmallCarousel({ images }: { images: any[] }) {
  const [index, setIndex] = useState(0);
  const current = images?.[index];
  
  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = API_BASE.replace(/\/$/, '');
    return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
  };
  
  if (!images || images.length === 0) return null;
  
  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden mb-4">
      {current && (
        <img
          src={getImageUrl(current.url)}
          alt={current.alt || "Sorteo"}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1">
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
          <button onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full h-8 w-8 text-sm flex items-center justify-center">‹</button>
          <button onClick={() => setIndex((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full h-8 w-8 text-sm flex items-center justify-center">›</button>
        </>
      )}
    </div>
  );
}

type Sorteo = {
  id: number | string;
  nombre: string;
  descripcion?: string | null;
  precio_por_numero: number;
  cantidad_digitos: number;
  conteos?: { total: number; vendidos: number; disponibles: number };
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [sorteos, setSorteos] = useState<Sorteo[]>([]);
  const [paquetes, setPaquetes] = useState<any[]>([]);
  const [ganadores, setGanadores] = useState<any[]>([]);
  const [sorteosImagenes, setSorteosImagenes] = useState<{[key: string]: any[]}>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sRes, pRes, gRes] = await Promise.all([
          fetch(`${API_BASE}/api/sorteos`),
          fetch(`${API_BASE}/api/paquetes_publicados`),
          fetch(`${API_BASE}/api/sorteos_con_ganadores`)
        ]);
        const sData = await sRes.json();
        const pData = await pRes.json();
        const gData = await gRes.json();
        setSorteos(sData.sorteos || []);
        setPaquetes(pData.paquetes || []);
        setGanadores(gData.sorteos || []);
        
        // Cargar imágenes para cada sorteo
        const imagenesMap: {[key: string]: any[]} = {};
        for (const sorteo of gData.sorteos || []) {
          try {
            const imgRes = await fetch(`${API_BASE}/api/sorteos/${sorteo.id}`);
            const imgData = await imgRes.json();
            imagenesMap[sorteo.id] = imgData.imagenes || [];
          } catch (error) {
            console.error(`Error loading images for sorteo ${sorteo.id}:`, error);
            imagenesMap[sorteo.id] = [];
          }
        }
        setSorteosImagenes(imagenesMap);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const destacados = useMemo(() => {
    return paquetes
      .map((p) => {
        const original = Number(p.sorteo?.precio_por_numero || 0) * Number(p.cantidad_numeros || 0);
        const final = Number(p.precio_total || 0);
        const descuento = Math.max(0, Math.round((1 - final / Math.max(0.01, original)) * 100));
        return { ...p, descuento };
      })
      .sort((a, b) => b.descuento - a.descuento)
      .slice(0, 3);
  }, [paquetes]);

  const paquetesExtra = useMemo(() => {
    const destacadosIds = new Set(destacados.map(p => p.id));
    return paquetes.filter(p => !destacadosIds.has(p.id));
  }, [paquetes, destacados]);

  // Intersection Observer para revelar elementos al hacer scroll
  const attachRevealObserver = () => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal-up:not(.is-visible)'));
    if (els.length === 0) return; 
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('is-visible');
            obs.unobserve(e.target as Element);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    els.forEach((el) => obs.observe(el));
  };

  useEffect(() => {
    attachRevealObserver();
    // Fallback: si por alguna razón el observer no dispara, mostramos todo
    const t = setTimeout(() => {
      document.querySelectorAll('.reveal-up').forEach((el) => el.classList.add('is-visible'));
    }, 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    attachRevealObserver();
  }, [sorteos, paquetes, ganadores]);

  // Ganadores: aplanar premios vendidos con cliente
  const winners = useMemo(() => {
    try {
      return (ganadores || []).flatMap((s: any) => {
        const premios: any[] = s?.premios || [];
        return premios
          .filter((p: any) => p?.vendido && p?.cliente)
          .map((p: any) => ({
            sorteo: s?.nombre,
            premio: p?.descripcion,
            numero: p?.numero_texto,
            cliente: `${p?.cliente?.nombres ?? ''} ${p?.cliente?.apellidos ?? ''}`.trim(),
          }));
      });
    } catch {
      return [] as any[];
    }
  }, [ganadores]);

  return (
    <main className="min-h-screen bg-[#0f1725] text-white">
      {/* Navbar fijo siempre arriba */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#0f1725]/90 backdrop-blur supports-[backdrop-filter]:bg-[#0f1725]/60 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between pl-20 sm:pl-24 md:pl-32">
          <div className="text-sm text-white/80">Castromotor</div>
          <div className="flex items-center gap-4 text-sm">
            <a href="#ganadores" className="text-white/80 hover:text-white">Ganadores</a>
            <a href="#sorteos-premiados" className="text-white/80 hover:text-white">Sorteos</a>
          </div>
        </div>
      </nav>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 sm:pt-32">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1725] via-[#111827] to-[#0f1725]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-16 pb-10 sm:pb-12 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center">
          <div className="reveal-up">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              ¡Compra tus tickets ahora!<br />
              <span className="text-rose-500">Promos por tiempo limitado</span>
            </h1>
            <p className="mt-4 text-slate-300">Elige tu sorteo favorito, compra tickets o ahorra con paquetes especiales. ¡Las cantidades vuelan!</p>
            <div className="mt-6 flex gap-3">
              <Link href="#sorteos-premiados" className="px-5 py-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white">Comprar tickets</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 reveal-up">
            <h3 className="text-lg font-semibold mb-4">Paquetes destacados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" id="paquetes">
              {destacados.map((p) => {
                const original = Number(p.sorteo?.precio_por_numero || 0) * Number(p.cantidad_numeros || 0);
                const final = Number(p.precio_total || 0);
                return (
                  <div key={String(p.id)} className="rounded-xl bg-black/30 border border-white/10 p-4 h-full flex flex-col card-prom">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400 truncate">{p.sorteo?.nombre}</div>
                      <div className="text-sm text-slate-200 font-medium break-words">{p.nombre || `${p.cantidad_numeros} tickets`}</div>
                      <div className="text-xs font-semibold text-emerald-400">Incluye {Number(p.cantidad_numeros || 0)} tickets</div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <div className="text-rose-400 text-xl font-bold">${final.toFixed(2)}</div>
                        <span className="badge-save">Ahorra {p.descuento}%</span>
                      </div>
                      <div className="text-xs text-slate-400 line-through">${original.toFixed(2)}</div>
                    </div>
                    <Link href={`/sorteos/${p.sorteo_id}?paqueteId=${p.id}`} className="mt-3 inline-flex w-full justify-center px-3 py-2 btn-cta text-sm">Comprar</Link>
                  </div>
                );
              })}
              {destacados.length === 0 && <div className="text-sm text-slate-400">Pronto más paquetes…</div>}
            </div>
          </div>
        </div>
      </section>

      {/* Más paquetes (si hay más de 3) */}
      {paquetesExtra.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-8 reveal-up">
          <h3 className="text-xl font-semibold mb-4">Más paquetes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paquetesExtra.map((p) => {
              const original = Number(p.sorteo?.precio_por_numero || 0) * Number(p.cantidad_numeros || 0);
              const final = Number(p.precio_total || 0);
              return (
                <div key={String(p.id)} className="rounded-xl bg-white/5 border border-white/10 p-4 h-full flex flex-col">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 truncate">{p.sorteo?.nombre}</div>
                    <div className="text-sm text-slate-200 font-medium break-words">{p.nombre || `${p.cantidad_numeros} tickets`}</div>
                    <div className="text-xs font-semibold text-emerald-400">Incluye {Number(p.cantidad_numeros || 0)} tickets</div>
                  </div>
                  <div className="mt-3">
                    <div className="text-rose-400 text-xl font-bold">${final.toFixed(2)}</div>
                    <div className="text-xs text-slate-400 line-through">${original.toFixed(2)}</div>
                  </div>
                  <Link href={`/sorteos/${p.sorteo_id}?paqueteId=${p.id}`} className="mt-3 inline-flex w-full justify-center px-3 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm">Comprar</Link>
                </div>
              );
            })}
      </div>
        </section>
      )}

      {/* Navbar simple (removido - tenemos navbar fijo arriba) */}

      {/* Sección: sorteos y números premiados (uno debajo del otro y a ancho completo) */}
      <section id="sorteos-premiados" className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-4 reveal-up">Sorteos y números premiados</h2>
        <div className="space-y-6">
          {ganadores.map((s) => {
            const vendidosPct = s?.conteos?.total ? (s.conteos.vendidos / s.conteos.total) * 100 : 0;
            const imagenes = sorteosImagenes[s.id] || [];
            return (
              <div key={String(s.id)} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm hover:shadow-rose-900/10 transition-transform duration-300 hover:-translate-y-0.5 reveal-up">
                {/* Carrusel de imágenes */}
                <SmallCarousel images={imagenes} />
                
                <div className="mb-3">
                  <div className="text-xl font-semibold mb-2">{s.nombre}</div>
                  <div className="relative">
                    <div className="h-4 w-full rounded-full bg-slate-700/40 overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-rose-500 via-rose-400 to-rose-300 transition-all duration-1000 ease-out shadow-lg" 
                        style={{ width: `${vendidosPct}%` }}
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white drop-shadow-lg">
                        {Math.round(vendidosPct)}% completado
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {s.premios?.map((p: any) => (
                    <div key={String(p.id)} className="rounded-lg bg-black/30 border border-white/10 p-3 hover:bg-black/40 transition">
                      <div className="text-xs text-slate-400">{p.descripcion}</div>
                      <div className={`text-lg font-bold ${p.vendido ? 'line-through text-slate-400' : 'text-white'}`}>#{p.numero_texto}</div>
                      {p.vendido && p.cliente && (
                        <div className="text-xs text-emerald-400">Ganador: {p.cliente.nombres} {p.cliente.apellidos}</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Link href={`/sorteos/${s.id}/info`} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm transition-colors">Ver sorteo →</Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ganadores (lista aplanada) */}
      <section id="ganadores" className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold mb-4 reveal-up">Ganadores</h2>
        {winners.length === 0 ? (
          <div className="text-sm text-slate-400 reveal-up">Aún no hay ganadores registrados.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {winners.map((w, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4 reveal-up">
                <div className="text-sm text-slate-400">{w.sorteo}</div>
                <div className="text-lg font-semibold text-white">{w.cliente}</div>
                <div className="text-xs text-emerald-400">{w.premio}</div>
                <div className="text-xs text-slate-400">Número: #{w.numero}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-black/20 border-t border-white/10 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Información de la empresa */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">C</span>
                </div>
                <div>
                  <div className="font-bold text-white">Castromotor</div>
                  <div className="text-sm text-slate-400">Sorteos</div>
                </div>
              </div>
              <p className="text-sm text-slate-300">
                Tu destino para sorteos emocionantes y premios increíbles. 
                Compra tickets y participa en nuestros sorteos exclusivos.
              </p>
            </div>

            {/* Enlaces rápidos */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white">Enlaces rápidos</h3>
              <div className="space-y-2">
                <a href="#sorteos-premiados" className="block text-sm text-slate-300 hover:text-white transition-colors">
                  Sorteos disponibles
                </a>
                <a href="#ganadores" className="block text-sm text-slate-300 hover:text-white transition-colors">
                  Ganadores
                </a>
                <a href="/admin" className="block text-sm text-slate-300 hover:text-white transition-colors">
                  Panel administrativo
                </a>
              </div>
            </div>

            {/* Información de contacto */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white">Contacto</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href="tel:+593981309202" className="text-sm text-slate-300 hover:text-white transition-colors">
                    +593 98 130 9202
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href="mailto:info@castromotor.com.ec" className="text-sm text-slate-300 hover:text-white transition-colors">
                    info@castromotor.com.ec
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm text-slate-300">
                    Ecuador
                  </span>
                </div>
              </div>
            </div>

            {/* Redes sociales */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white">Síguenos</h3>
              <div className="flex gap-3">
                <a href="https://wa.me/593981309202" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-green-600 hover:bg-green-700 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
                </a>
                <a href="https://facebook.com/castromotor" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://instagram.com/castromotor" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.418-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.928.875 1.418 2.026 1.418 3.323s-.49 2.448-1.418 3.244c-.875.807-2.026 1.297-3.323 1.297zm7.83-9.781c-.49 0-.928-.175-1.297-.49-.368-.315-.49-.753-.49-1.243 0-.49.122-.928.49-1.243.369-.315.807-.49 1.297-.49s.928.175 1.297.49c.368.315.49.753.49 1.243 0 .49-.122.928-.49 1.243-.369.315-.807.49-1.297.49z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Línea divisoria */}
          <div className="border-t border-white/10 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-slate-400">
                © 2025 Castromotor Sorteos. Todos los derechos reservados.
              </div>
              <div className="flex gap-6 text-sm">
                <a href="#" className="text-slate-400 hover:text-white transition-colors">¡Buena suerte!</a>
              </div>
            </div>
          </div>
      </div>
      </footer>
    </main>
  );
}
