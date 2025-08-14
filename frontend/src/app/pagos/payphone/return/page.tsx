"use client";

import React, { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function PayphoneReturnPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState<string>("Procesando pago…");

  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const clientTransactionId = usp.get("clientTransactionId") || usp.get("id") || "";
    if (!clientTransactionId) {
      setStatus("error");
      setMsg("Falta clientTransactionId en la URL");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/payments/payphone/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientTransactionId })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "Pago no aprobado");
        setStatus("ok");
        setMsg("Pago aprobado. ¡Gracias por tu compra!");
      } catch (e: any) {
        setStatus("error");
        setMsg(e?.message || "Ocurrió un error al confirmar el pago");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1725] to-[#0b1220] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-xl font-bold mb-3">Payphone</h1>
        <div className={status === "loading" ? "animate-pulse" : ""}>{msg}</div>
        <div className="mt-6">
          <a href="/" className="text-rose-400 hover:text-rose-300 text-sm">Volver al inicio</a>
        </div>
      </div>
    </main>
  );
}


