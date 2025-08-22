"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { FacebookPost } from '../../../components/social/FacebookPost';
import { InstagramPost } from '../../../components/social/InstagramPost';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type SocialPost = { 
  id: string | number; 
  platform: string; 
  url: string; 
  tipo: 'social' | 'ganador';
  orden: number; 
  activo: boolean 
};

type TabType = 'social' | 'ganador';

export default function SocialPostsAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('social');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [form, setForm] = useState<{ platform: 'facebook' | 'instagram'; url: string; activo: boolean }>({ 
    platform: 'facebook', 
    url: '', 
    activo: true 
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | number | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const headers: Record<string,string> = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  const load = useCallback(async (tipo: TabType) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/social-posts?tipo=${tipo}`, { 
        headers: token ? { Authorization: `Bearer ${token}` } : {} 
      });
      const data = await res.json();
      setPosts(data.posts || []);
    } finally { 
      setLoading(false); 
    }
  }, [token]);

  useEffect(() => { 
    load(activeTab); 
  }, [load, activeTab]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/admin/social-posts`, { 
        method: 'POST', 
        headers, 
        body: JSON.stringify({
          ...form,
          tipo: activeTab
        }) 
      });
      setForm({ platform: 'facebook', url: '', activo: true });
      await load(activeTab);
    } finally { 
      setSaving(false); 
    }
  };

  const toggleActivo = async (p: SocialPost) => {
    await fetch(`${API_BASE}/api/admin/social-posts/${p.id}`, { 
      method: 'PATCH', 
      headers, 
      body: JSON.stringify({ activo: !p.activo }) 
    });
    await load(activeTab);
  };

  const updateOrden = async (p: SocialPost, delta: number) => {
    const newOrden = p.orden + delta;
    await fetch(`${API_BASE}/api/admin/social-posts/${p.id}`, { 
      method: 'PATCH', 
      headers, 
      body: JSON.stringify({ orden: newOrden }) 
    });
    await load(activeTab);
  };

  const remove = async (p: SocialPost) => {
    if (!confirm('¿Eliminar publicación?')) return;
    await fetch(`${API_BASE}/api/admin/social-posts/${p.id}`, { 
      method: 'DELETE', 
      headers: token ? { Authorization: `Bearer ${token}` } : {} 
    });
    await load(activeTab);
  };

  const getTabTitle = (tipo: TabType) => {
    return tipo === 'social' ? 'Social Posts' : 'Publicaciones de Ganadores';
  };

  const getTabDescription = (tipo: TabType) => {
    return tipo === 'social' 
      ? 'Gestiona publicaciones de Facebook o Instagram que se mostrarán en la sección "Social posts" de la página principal.'
      : 'Gestiona publicaciones que se mostrarán en la sección "Ganadores" de la página principal, reemplazando las tarjetas de ganadores automáticas.';
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Gestión de Publicaciones</h1>
          <p className="text-slate-300 text-sm">
            Gestiona las publicaciones que aparecen en la página principal.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('social')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === 'social'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              📱 Social Posts
            </button>
            <button
              onClick={() => setActiveTab('ganador')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === 'ganador'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              🏆 Ganadores
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{getTabTitle(activeTab)}</h2>
          <p className="text-slate-300 text-sm">{getTabDescription(activeTab)}</p>
        </div>

        {/* Form */}
        <form onSubmit={create} className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
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
              <input 
                value={form.url} 
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))} 
                placeholder={
                  form.platform === 'facebook' 
                    ? "https://www.facebook.com/share/p/..." 
                    : "https://www.instagram.com/p/..."
                }
                className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-sm" 
              />
              <div className="mt-1 text-xs text-slate-500">
                {form.platform === 'facebook' ? (
                  <div>
                    <div className="font-medium text-slate-400 mb-1">Formatos válidos de Facebook:</div>
                    <div>• https://www.facebook.com/share/p/1BJ7Q8d7E5/</div>
                    <div>• https://www.facebook.com/pagina/posts/123456789/</div>
                    <div>• https://www.facebook.com/photo/?fbid=123456789</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-slate-400 mb-1">Formatos válidos de Instagram:</div>
                    <div>• https://www.instagram.com/p/DNpGaJQN4i0/</div>
                    <div>• https://www.instagram.com/p/DNpGaJQN4i0/?igsh=...</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={form.activo} 
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} 
                className="rounded"
              />
              <span className="text-xs text-slate-400">Activo</span>
            </label>
            <button 
              type="submit" 
              disabled={saving || !form.url.trim()} 
              className="px-4 py-1 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-600 rounded text-sm"
            >
              {saving ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </form>

        {/* Lista */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">
            Publicaciones {activeTab === 'social' ? 'Sociales' : 'de Ganadores'} 
            {posts.length > 0 && ` (${posts.length})`}
          </h3>
          
          {loading ? (
            <div className="text-center py-8 text-slate-400">Cargando...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No hay publicaciones {activeTab === 'social' ? 'sociales' : 'de ganadores'} aún.
            </div>
          ) : (
            posts.map((p) => (
              <div key={p.id} className={`border rounded-xl p-4 ${p.activo ? 'border-white/20 bg-white/5' : 'border-red-500/50 bg-red-500/10'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs uppercase tracking-wide ${
                      p.platform === 'facebook' 
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                        : 'bg-pink-600/20 text-pink-300 border border-pink-500/30'
                    }`}>
                      {p.platform}
                    </span>
                    {p.activo ? (
                      <span className="px-2 py-1 rounded text-xs bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
                        ACTIVO
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-red-600/20 text-red-300 border border-red-500/30">
                        INACTIVO
                      </span>
                    )}
                    <span className="text-xs text-slate-400">Orden: {p.orden}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateOrden(p, -1)} className="p-1 text-slate-400 hover:text-white" title="Subir orden">↑</button>
                    <button onClick={() => updateOrden(p, 1)} className="p-1 text-slate-400 hover:text-white" title="Bajar orden">↓</button>
                    <button 
                      onClick={() => toggleActivo(p)} 
                      className={`px-2 py-1 rounded text-xs ${p.activo ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button 
                      onClick={() => setPreviewId(previewId === p.id ? null : p.id)} 
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      {previewId === p.id ? 'Ocultar' : 'Vista previa'}
                    </button>
                    <button 
                      onClick={() => remove(p)} 
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-slate-400 mb-2 break-all">{p.url}</div>
                
                {previewId === p.id && (
                  <div className="mt-3 p-3 bg-black/30 rounded-lg border border-white/10">
                    <div className="text-xs text-slate-400 mb-2">Vista previa:</div>
                    {p.platform === 'facebook' ? (
                      <FacebookPost url={p.url} />
                    ) : (
                      <InstagramPost url={p.url} />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}