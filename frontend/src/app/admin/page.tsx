"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [series, setSeries] = useState<{ label: string; value: number }[]>([]);

  useEffect(() => {
    (async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const sres = await fetch(`${API_BASE}/api/admin/stats`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const sdata = await sres.json();
      setStats(sdata);
      // Serie: ganancia teórica total y tickets totales
      const tg = Number(sdata?.grafica?.total_ganancia_teorica || 0);
      const tn = Number(sdata?.grafica?.total_numeros_publicados || 0);
      setSeries([
        { label: 'Ganancias', value: tg },
        { label: 'Tickets', value: tn },
      ]);
    })();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white">
      <div className="px-6 pt-10 pb-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">Castromotor — Panel admin</h1>
        <p className="text-slate-300 mt-1">Administra sorteos, paquetes y órdenes.</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-6 pb-6">
          <Stat title="Ganancias" value={`$${Number(stats.total_ganancias).toFixed(2)}`} />
          <Stat title="Tickets vendidos" value={`${Number(stats.tickets_vendidos)}`} />
          <Stat title="Órdenes aprobadas" value={`${stats.ordenes_aprobadas}`} />
          <Stat title="Órdenes pendientes" value={`${stats.ordenes_pendientes}`} />
          <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm text-slate-300">Paquete más comprado</div>
            {stats.paquete_mas_comprado ? (
              <div className="text-xs text-slate-200 mt-1">
                {stats.paquete_mas_comprado.nombre || `${stats.paquete_mas_comprado.cantidad_numeros} tickets`} — Compras: {stats.paquete_mas_comprado.compras}
              </div>
            ) : (
              <div className="text-xs text-slate-400 mt-1">Sin datos</div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm text-slate-300">Método top</div>
            <div className="text-xs text-slate-200 mt-1">{stats.metodo_pago_top || '—'}</div>
          </div>
        </div>
      )}

      {/* Gráfico simple (barra horizontal) */}
      {series.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-slate-300 mb-3">Resumen</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {series.map((s) => (
                <Bar
                  key={s.label}
                  label={s.label}
                  value={s.label === 'Tickets' ? Number(stats?.grafica?.vendidos_publicados || 0) : Number(stats?.total_ganancias || 0)}
                  max={s.value || 1}
                  extra={s.label === 'Tickets' ? `Vendidos: ${Number(stats?.grafica?.vendidos_publicados || 0)} / Disponibles: ${Number(stats?.grafica?.disponibles_publicados || 0)}` : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-6 pb-12">
        <Card title="Gestionar sorteos" desc="Crea y configura sorteos" href="/admin/sorteos" color="from-blue-600 to-indigo-600" />
        <Card title="Gestionar paquetes" desc="Paquetes promocionales" href="/admin/paquetes" color="from-purple-600 to-violet-600" />
        <Card title="Órdenes" desc="Revisa y aprueba órdenes" href="/admin/orders" color="from-emerald-600 to-teal-600" />
        <Card title="Métodos de pago" desc="Cuentas bancarias y estados" href="/admin/metodos-pago" color="from-rose-600 to-pink-600" />
        <Card title="Números vendidos" desc="Listado y búsqueda" href="/admin/numeros-vendidos" color="from-amber-600 to-orange-600" />
      </div>
    </main>
  );
}

function Card({ title, desc, href, color }: { title: string; desc: string; href: string; color: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm hover:bg-white/10 transition">
      <div className={`inline-flex items-center justify-center rounded-lg bg-gradient-to-r ${color} px-3 py-1 text-sm font-medium`}>{title}</div>
      <p className="mt-3 text-slate-300">{desc}</p>
      <div className="mt-4 text-sm text-slate-400 group-hover:text-white">Ir →</div>
    </Link>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-sm text-slate-300">{title}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function Bar({ label, value, max, extra }: { label: string; value: number; max: number; extra?: string }) {
  const width = Math.max(4, Math.round((value / (max || 1)) * 100));
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-300">{label}: {Number(value).toLocaleString()} {extra ? `— ${extra}` : ''}</div>
      <div className="h-3 w-full rounded bg-slate-700/40 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}


