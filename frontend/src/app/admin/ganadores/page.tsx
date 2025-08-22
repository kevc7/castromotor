"use client";

import React, { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type Ganador = {
  cliente_id: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  correo: string | null;
  sorteo_id: string;
  sorteo_nombre: string;
  numeros: string[];
  premios: string[];
  aciertos?: { numero: string; premio: string }[];
  premios_count: number;
};

export default function GanadoresPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ganadores, setGanadores] = useState<Ganador[]>([]);
  const [q, setQ] = useState("");

  async function cargar() {
    try {
      setLoading(true);
      setError(null);
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const url = new URL(`${API_BASE}/api/admin/ganadores`);
      if (q) url.searchParams.set('q', q);
      const res = await fetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const data = await res.json();
      setGanadores(data.ganadores || []);
    } catch (e: any) {
      setError(e?.message || 'Error cargando ganadores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("Felicidades por tu premio");
  const [emailBody, setEmailBody] = useState<string>("Hola,\n\n¡Felicidades! Te contactamos desde Castromotor porque ganaste un premio instantáneo.\nPor favor responde este correo o escríbenos para coordinar la entrega.\n\nSaludos,");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function enviarCorreo() {
    try {
      setSendingEmail(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`${API_BASE}/api/admin/ganadores/enviar_correo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ to: emailTo, subject: emailSubject, message: emailBody })
      });
      if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el correo');
      setMessage('Correo enviado ✔');
      setEmailOpen(false);
    } catch (e: any) {
      setMessage(e?.message || 'Error enviando correo');
    } finally {
      setSendingEmail(false);
    }
  }

  function abrirCorreo(to: string | null) {
    if (!to) { setMessage('Este ganador no tiene correo registrado'); return; }
    setEmailTo(to);
    setEmailOpen(true);
  }

  function whatsappUrl(raw: string | null) {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const full = digits.length === 9 ? `593${digits}` : digits.startsWith('593') ? digits : `593${digits}`;
    return `https://wa.me/${full}`;
  }

  return (
    <main className="min-h-screen bg-[#0f1725] text-white">
      <div className="px-6 pt-8 pb-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">Ganadores</h1>
        <p className="text-slate-300 mt-1">Ver ganadores de premios instantáneos, contactarlos, publicar ganadores en página principal.</p>

        <div className="mt-5 flex gap-2 items-center">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nombre, correo, sorteo, número..." className="w-full md:w-96 border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white text-sm" />
          <button onClick={cargar} className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm">Buscar</button>
        </div>

        {message && <div className="mt-3 text-sm p-3 rounded border border-white/10 bg-white/5">{message}</div>}

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Contacto</th>
                <th className="text-left p-3">Sorteo</th>
                <th className="text-left p-3">Número → Descripción premio</th>
                <th className="text-left p-3">Contactar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-300 animate-pulse">Cargando ganadores…</td></tr>
              ) : ganadores.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-400">No hay ganadores registrados todavía.</td></tr>
              ) : (
                ganadores.map((g, idx) => (
                  <tr key={idx} className="border-t border-white/10 hover:bg-white/5/50">
                    <td className="p-3">
                      <div className="font-medium text-white">{g.nombres} {g.apellidos}</div>
                    </td>
                    <td className="p-3 text-xs">
                      <div className="text-slate-300">{g.correo || '—'}</div>
                      <div className="text-slate-300">{g.telefono || '—'}</div>
                    </td>
                    <td className="p-3">{g.sorteo_nombre}</td>
                    <td className="p-3 align-top">
                      <div className="flex flex-col gap-1">
                        {g.aciertos && g.aciertos.length > 0 ? (
                          [...g.aciertos].sort((a,b)=>a.numero.localeCompare(b.numero, undefined, { numeric: true })).map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="inline-flex px-2 py-0.5 rounded bg-emerald-700/30 text-emerald-200 border border-emerald-500/30">{a.numero}</span>
                              <span className="text-slate-400">→</span>
                              <span className="inline-flex px-2 py-0.5 rounded bg-blue-700/30 text-blue-200 border border-blue-500/30">{a.premio}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {whatsappUrl(g.telefono) && (
                          <a href={whatsappUrl(g.telefono)!} target="_blank" className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs">WhatsApp</a>
                        )}
                        {g.correo && (
                          <button onClick={()=>abrirCorreo(g.correo!)} className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-xs">Correo</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && ganadores.length === 0 && (
          <div className="mt-3 text-xs text-slate-400">Si ya aprobaste órdenes con números premiados, verifica que estén marcadas como aprobadas y vuelve a intentar. <button onClick={cargar} className="underline hover:text-white">Reintentar</button></div>
        )}
      </div>

      {emailOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="relative w-full max-w-lg rounded-xl border border-white/15 bg-gradient-to-b from-[#0b1220] to-[#0f1725] p-5 shadow-xl">
            <button onClick={()=>setEmailOpen(false)} className="absolute right-3 top-3 h-8 w-8 rounded-md bg-white/10 hover:bg-white/20">✕</button>
            <h3 className="text-lg font-semibold">Enviar correo</h3>
            <p className="text-slate-300 text-sm mb-3">Redacta el mensaje para el ganador. Se enviará desde el correo configurado en el sistema.</p>

            <label className="grid gap-1 mb-3">
              <span className="text-xs text-slate-400">Para</span>
              <input value={emailTo} readOnly className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white text-sm" />
            </label>
            <label className="grid gap-1 mb-3">
              <span className="text-xs text-slate-400">Asunto</span>
              <input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white text-sm" />
            </label>
            <label className="grid gap-1 mb-4">
              <span className="text-xs text-slate-400">Mensaje</span>
              <textarea rows={8} value={emailBody} onChange={e=>setEmailBody(e.target.value)} className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white text-sm" />
            </label>

            <div className="flex justify-end gap-2">
              <button onClick={()=>setEmailOpen(false)} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Cancelar</button>
              <button onClick={enviarCorreo} disabled={sendingEmail} className={`px-5 py-2 rounded-md text-white text-sm ${sendingEmail ? 'bg-rose-700/60 animate-pulse' : 'bg-rose-600 hover:bg-rose-700'}`}>{sendingEmail ? 'Enviando…' : 'Enviar'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
