"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type Row = {
  id: string | number;
  numero_texto: string;
  sorteo_id: string | number;
  sorteo_nombre: string;
  cliente_nombres: string | null;
  cliente_apellidos: string | null;
  cliente_correo: string | null;
  cliente_telefono: string | null;
};

export default function NumerosVendidosPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [sorteos, setSorteos] = useState<{ id: string; nombre: string }[]>([]);
  const [sorteoId, setSorteoId] = useState<string>("");
  const [q, setQ] = useState("");

  useEffect(() => {
    // cargar sorteos para el filtro
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
        const r = await fetch(`${API_BASE}/api/admin/sorteos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (r.status === 401) { window.location.href = '/admin/login'; return; }
        const data = await r.json();
        setSorteos((data?.sorteos || []).map((s: any) => ({ id: String(s.id), nombre: s.nombre })));
      } catch {}
    })();
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const url = new URL(`${API_BASE}/api/admin/numeros_vendidos`);
      if (sorteoId) url.searchParams.set('sorteo_id', sorteoId);
      if (q.trim()) url.searchParams.set('q', q.trim());
      url.searchParams.set('limit', '1000');
      const r = await fetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (r.status === 401) { window.location.href = '/admin/login'; return; }
      const data = await r.json();
      setRows(data?.numeros || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  const filtered = useMemo(() => rows, [rows]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white">
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Números vendidos</h1>
          <p className="text-slate-300 text-sm">Filtra por sorteo y busca por número.</p>
        </div>
        <Link href="/admin" className="text-sm text-white/80 hover:text-white">← Volver al panel</Link>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-10 space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-1">
            <label className="text-xs text-slate-300">Sorteo</label>
            <select value={sorteoId} onChange={e => setSorteoId(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm">
              <option value="">Todos</option>
              {sorteos.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-300">Buscar por número</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ej: 007, 123" className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm" />
          </div>
          <div className="col-span-1 flex items-end">
            <button onClick={fetchRows} disabled={loading} className="w-full h-10 rounded bg-rose-600 hover:bg-rose-500 transition text-sm font-medium">{loading ? 'Cargando...' : 'Aplicar filtros'}</button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/40">
              <tr className="text-left text-slate-300">
                <th className="px-3 py-2 border-b border-white/10">Número</th>
                <th className="px-3 py-2 border-b border-white/10">Cliente</th>
                <th className="px-3 py-2 border-b border-white/10">Correo</th>
                <th className="px-3 py-2 border-b border-white/10">Teléfono</th>
                <th className="px-3 py-2 border-b border-white/10">Sorteo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">Sin resultados</td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={String(r.id)} className="odd:bg-white/[.03]">
                  <td className="px-3 py-2 font-mono">{r.numero_texto}</td>
                  <td className="px-3 py-2">{[r.cliente_nombres, r.cliente_apellidos].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-3 py-2">{r.cliente_correo || '—'}</td>
                  <td className="px-3 py-2">{r.cliente_telefono || '—'}</td>
                  <td className="px-3 py-2">{r.sorteo_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}


