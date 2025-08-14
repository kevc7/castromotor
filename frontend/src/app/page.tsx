"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

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
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const destacados = paquetes.slice(0, 3);
  const paquetesExtra = paquetes.slice(3);

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
                        <span className="badge-save">Ahorra {Math.max(0, Math.round((1 - final / Math.max(0.01, original)) * 100))}%</span>
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
            return (
              <div key={String(s.id)} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm hover:shadow-rose-900/10 transition-transform duration-300 hover:-translate-y-0.5 reveal-up">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xl font-semibold">{s.nombre}</div>
                  <div className="text-xs text-slate-300">{Math.round(vendidosPct)}%</div>
                </div>
                <div className="h-2.5 w-full rounded bg-slate-700/40 overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-700" style={{ width: `${vendidosPct}%` }} />
                </div>
                <div className="text-xs text-slate-300 mb-4">Vendidos: {s?.conteos?.vendidos ?? 0} / {s?.conteos?.total ?? 0}</div>
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
    </main>
  );
}
