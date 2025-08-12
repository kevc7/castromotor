"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function ComprarSelectorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sorteoId = params?.id;
  const [sorteo, setSorteo] = useState<any>(null);
  const [paquetes, setPaquetes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API_BASE}/api/sorteos/${sorteoId}`);
      const data = await res.json();
      setSorteo(data.sorteo);
      setPaquetes(data.paquetes || []);
      setLoading(false);
    })();
  }, [sorteoId]);

  if (loading) return <div className="p-8 text-slate-600">Cargando…</div>;

  return (
    <main className="min-h-screen bg-[#0f1725] text-white">
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-12">
        <Link href="/" className="text-slate-300 hover:text-white text-sm">← Volver</Link>
        <h1 className="text-3xl font-bold mt-2">{sorteo?.nombre}</h1>
        <p className="text-slate-300">{sorteo?.descripcion}</p>

        <section className="mt-8 p-6 rounded-xl border border-white/10 bg-white/5">
          <h2 className="text-xl font-semibold mb-4">Elige tu forma de compra</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {paquetes.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm text-slate-200 font-medium">{p.nombre || `${p.cantidad_numeros} tickets`}</div>
                <div className="text-xs font-semibold text-emerald-400">Incluye {p.cantidad_numeros} tickets</div>
                <div className="text-rose-400 text-2xl font-bold mt-1">${Number(p.precio_total).toFixed(2)}</div>
                <button onClick={() => router.push(`/sorteos/${sorteoId}?paqueteId=${p.id}`)} className="mt-3 px-3 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm">Comprar promoción</button>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="text-sm text-slate-300 mb-2">¿Prefieres comprar una cantidad específica?</div>
            <button onClick={() => router.push(`/sorteos/${sorteoId}`)} className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white">Comprar por cantidad</button>
          </div>
        </section>
      </div>
    </main>
  );
}


