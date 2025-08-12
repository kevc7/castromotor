"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function AdminLoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, contrasena })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Credenciales inválidas");
      localStorage.setItem("admin_token", data.token);
      router.replace("/admin");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0f1725] text-white flex items-center justify-center px-6">
      <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold mb-4">Acceso administrador</h1>
        <label className="grid gap-1 mb-3">
          <span className="text-xs text-slate-400">Usuario</span>
          <input className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
        </label>
        <label className="grid gap-1 mb-4">
          <span className="text-xs text-slate-400">Contraseña</span>
          <input type="password" className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        </label>
        <button disabled={loading} className={`w-full px-4 py-2 rounded-md ${loading ? 'bg-rose-700/60 cursor-not-allowed animate-pulse' : 'bg-rose-600 hover:bg-rose-700'} text-white`}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
        {msg && <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm">{msg}</div>}
      </form>
    </main>
  );
}


