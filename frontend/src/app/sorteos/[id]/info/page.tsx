"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function SorteoInfoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cantidadPref, setCantidadPref] = useState<number>(1);
  const [cantidadMsg, setCantidadMsg] = useState<string | null>(null);

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
            <p className="text-slate-300 mt-1">{data?.sorteo?.descripcion}</p>
            <div className="mt-4 text-sm text-slate-200">Precio por número: ${Number(data?.sorteo?.precio_por_numero || 0).toFixed(2)}</div>
            {conteos && (
              <div className="mt-3">
                <div className="text-xs text-slate-300 mb-1">Vendidos: {conteos.vendidos} / {conteos.total} ({vendidosPct}%)</div>
                <div className="h-2.5 w-full rounded bg-slate-700/40 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all" style={{ width: `${vendidosPct}%` }} />
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
                      <div className="text-xs text-slate-400">{p.descripcion}</div>
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


