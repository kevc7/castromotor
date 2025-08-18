"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { FacebookPost } from '../../../components/social/FacebookPost';
import { InstagramPost } from '../../../components/social/InstagramPost';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

type SocialPost = { id: string | number; platform: string; url: string; orden: number; activo: boolean };

export default function SocialPostsAdmin() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [form, setForm] = useState<{ platform: 'facebook' | 'instagram'; url: string; activo: boolean }>({ platform: 'facebook', url: '', activo: true });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | number | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const headers: Record<string,string> = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/social-posts`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      setPosts(data.posts || []);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/admin/social-posts`, { method: 'POST', headers, body: JSON.stringify(form) });
      setForm({ platform: 'facebook', url: '', activo: true });
      await load();
    } finally { setSaving(false); }
  };

  const toggleActivo = async (p: SocialPost) => {
    await fetch(`${API_BASE}/api/admin/social-posts/${p.id}`, { method: 'PATCH', headers, body: JSON.stringify({ activo: !p.activo }) });
    await load();
  };

  const updateOrden = async (p: SocialPost, delta: number) => {
    const newOrden = p.orden + delta;
    await fetch(`${API_BASE}/api/admin/social-posts/${p.id}`, { method: 'PATCH', headers, body: JSON.stringify({ orden: newOrden }) });
    await load();
  };

  const remove = async (p: SocialPost) => {
    if (!confirm('¿Eliminar publicación?')) return;
    await fetch(`${API_BASE}/api/admin/social-posts/${p.id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    await load();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Social posts</h1>
        <p className="text-slate-300 mb-6 text-sm">Gestiona publicaciones de Facebook o Instagram que se mostrarán en la página principal. Solo los activos se muestran públicamente.</p>
        <form onSubmit={create} className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Plataforma</label>
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value as any }))}
                className="w-full bg-slate-800/70 text-slate-50 border border-white/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/40 rounded px-2 py-2 text-sm appearance-none"
                style={{colorScheme:'dark'}}
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400 block mb-1">URL de la publicación</label>
              <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://www.facebook.com/..." className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="accent-rose-500" /> Activo
            </label>
            <button disabled={saving} className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-700 text-sm font-medium disabled:opacity-50">{saving ? 'Guardando...' : 'Agregar'}</button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="font-semibold mb-3">Listado</h2>
          {loading ? <div className="text-sm text-slate-400">Cargando...</div> : posts.length === 0 ? <div className="text-sm text-slate-400">Sin publicaciones</div> : (
            <ul className="space-y-3">
              {posts.map(p => (
                <li key={String(p.id)} className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs uppercase tracking-wide text-slate-400">{p.platform}</div>
                      <div className="text-sm truncate text-slate-200" title={p.url}>{p.url}</div>
                      <div className="text-[11px] text-slate-400">Orden: {p.orden}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 text-[10px] rounded-full font-semibold tracking-wide ${p.activo ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-600/20 text-slate-300 border border-slate-500/30'}`}>{p.activo ? 'ACTIVO' : 'INACTIVO'}</span>
                      <button onClick={() => updateOrden(p, -1)} title="Subir" className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">↑</button>
                      <button onClick={() => updateOrden(p, 1)} title="Bajar" className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">↓</button>
                      <button onClick={() => toggleActivo(p)} className={`px-2 py-1 text-xs rounded ${p.activo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                      <button onClick={() => setPreviewId(prev => prev === p.id ? null : p.id)} className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700">
                        {previewId === p.id ? 'Ocultar' : 'Ver'}
                      </button>
                      <button onClick={() => remove(p)} className="px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-700">Eliminar</button>
                    </div>
                  </div>
                  {previewId === p.id && (
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 animate-fade-in">
                      {p.platform === 'facebook' && <FacebookPost url={p.url} />}
                      {p.platform === 'instagram' && <InstagramPost url={p.url} />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
