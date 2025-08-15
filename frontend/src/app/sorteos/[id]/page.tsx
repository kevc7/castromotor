"use client";

import React, { useEffect, useMemo, useState } from "react";

function Carousel({ images }: { images: any[] }) {
  const [index, setIndex] = useState(0);
  const current = images?.[index];
  
  console.log('Carousel render:', { images, current, index });
  
  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Si es una ruta relativa, construir la URL completa
    const baseUrl = API_BASE.replace(/\/$/, '');
    const fullUrl = `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
    console.log('Image URL construction:', { original: url, baseUrl, fullUrl });
    return fullUrl;
  };
  
  return (
    <div className="absolute inset-0">
      {current && (
        <img
          src={getImageUrl(current.url)}
          alt={current.alt || "Sorteo"}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          onError={(e) => console.error('Error loading image:', current.url, e)}
          onLoad={() => console.log('Image loaded successfully:', current.url)}
        />
      )}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
              aria-label={`Imagen ${i + 1}`}
            />)
          )}
        </div>
      )}
      {images.length > 1 && (
        <>
          <button onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9">‹</button>
          <button onClick={() => setIndex((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9">›</button>
        </>
      )}
    </div>
  );
}
import { useParams, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function SorteoPage() {
  const params = useParams<{ id: string }>();
  const sorteoId = params?.id;
  const [loading, setLoading] = useState(true);
  const [sorteo, setSorteo] = useState<any>(null);
  const [paquetes, setPaquetes] = useState<any[]>([]);
  const [conteos, setConteos] = useState<any>(null);
  const [cliente, setCliente] = useState({ nombres: "", apellidos: "", cedula: "", correo_electronico: "", telefono: "", direccion: "" });
  const [cantidad, setCantidad] = useState<number>(1);
  const [paqueteId, setPaqueteId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info' | null>(null);
  const [metodos, setMetodos] = useState<any[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState<number | null>(null);
  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [verifMsg, setVerifMsg] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [sendingCode, setSendingCode] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [payOpening, setPayOpening] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      if (!sorteoId) return;
      const res = await fetch(`${API_BASE}/api/sorteos/${sorteoId}`);
      const data = await res.json();
      console.log('Sorteo data received:', data);
      setSorteo(data.sorteo);
      setPaquetes(data.paquetes || []);
      setConteos(data.conteos);
      setLoading(false);
    })();
    (async () => {
      const r = await fetch(`${API_BASE}/api/metodos_pago`);
      const d = await r.json();
      setMetodos(d.metodos || []);
      if (d.metodos?.length) setMetodoPagoId(Number(d.metodos[0].id));
    })();
  }, [sorteoId]);

  // Preseleccionar paquete si viene en query
  const search = useSearchParams();
  useEffect(() => {
    const pid = search?.get('paqueteId');
    if (pid) setPaqueteId(Number(pid));
    const cant = search?.get('cantidad');
    if (cant) setCantidad(Math.max(1, Number(cant)));
  }, [search]);

  const precioUnitario = useMemo(() => Number(sorteo?.precio_por_numero || 0), [sorteo]);
  const paqueteSeleccionado = useMemo(() => paquetes.find((p) => Number(p.id) === Number(paqueteId)), [paquetes, paqueteId]);
  const precioSinDesc = useMemo(() => {
    if (paqueteSeleccionado) return precioUnitario * Number(paqueteSeleccionado.cantidad_numeros || 0);
    return precioUnitario * cantidad;
  }, [precioUnitario, paqueteSeleccionado, cantidad]);
  const precioConDesc = useMemo(() => {
    if (paqueteSeleccionado) return Number(paqueteSeleccionado.precio_total || 0);
    return precioUnitario * cantidad;
  }, [precioUnitario, paqueteSeleccionado, cantidad]);

  async function crearOrdenCompleta(e: React.FormEvent) {
    e.preventDefault();
    try {
      setMsg(null);
      setMsgType(null);
      // Validación rápida en cliente contra disponibles
      const solicitados = paqueteSeleccionado ? Number(paqueteSeleccionado.cantidad_numeros || 0) : Number(cantidad || 0);
      if (conteos && solicitados > Number(conteos.disponibles || 0)) {
        throw new Error(`Solo quedan ${conteos.disponibles} números disponibles para este sorteo`);
      }
      if (!file) throw new Error("Sube tu comprobante de pago");
      if (!metodoPagoId) throw new Error("Selecciona un método de pago");
      if (!verificationId || verificationCode.length !== 3) throw new Error("Verifica tu correo con el código de 3 dígitos");
      // Auto-verificar si aún no está verificado
      if (!isVerified) {
        setVerifying(true);
        const resVer = await fetch(`${API_BASE}/api/verificaciones/verificar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verification_id: verificationId, codigo: verificationCode })
        });
        const dVer = await resVer.json();
        if (!resVer.ok) throw new Error(dVer?.error || 'Código de verificación inválido');
        setIsVerified(true);
      }
      setSubmitting(true);
      const form = new FormData();
      form.append("nombres", cliente.nombres);
      form.append("apellidos", cliente.apellidos);
      form.append("cedula", cliente.cedula);
      form.append("correo_electronico", cliente.correo_electronico);
      form.append("telefono", cliente.telefono);
      form.append("direccion", cliente.direccion);
      form.append("verification_id", String(verificationId));
      form.append("verification_code", verificationCode);
      form.append("sorteo_id", String(sorteoId));
      if (paqueteId) form.append("paquete_id", String(paqueteId));
      else form.append("cantidad_numeros", String(cantidad));
      form.append("metodo_pago_id", String(metodoPagoId));
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/orders/complete`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error creando la orden');
      setMsg("✅ ¡Tu orden fue generada con éxito! Un administrador la revisará y te llegará un correo con el resultado.");
      setMsgType('success');
      
      // Limpiar formulario completamente
      limpiarFormulario();
      
      // Scroll a arriba para ver el mensaje
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setMsg(e?.message || 'Error creando la orden');
      setMsgType('error');
    } finally {
      setSubmitting(false);
      setVerifying(false);
    }
  }

  // Función para limpiar completamente el formulario
  function limpiarFormulario() {
    setCliente({ nombres: "", apellidos: "", cedula: "", correo_electronico: "", telefono: "", direccion: "" });
    setVerificationId(null);
    setVerificationCode("");
    setIsVerified(false);
    setVerifMsg(null);
    setFile(null);
    setPaqueteId(null);
    setCantidad(1);
    setMsg(null);
    setMsgType(null);
    
    // Limpiar el input de archivo del DOM
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  async function solicitarCodigo() {
    try {
      setVerifMsg(null);
      setIsVerified(false);
      setSendingCode(true);
      if (!cliente.correo_electronico) throw new Error("Ingresa tu correo primero");
      
      const res = await fetch(`${API_BASE}/api/verificaciones/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo_electronico: cliente.correo_electronico })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error('Error en la respuesta del servidor. Intenta nuevamente.');
      }
      
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo enviar el código');
      }
      
      setVerificationId(Number(data.verification_id));
      setExpiresAt(Date.now() + 10 * 60 * 1000);
      setVerificationCode("");
      
      if (data.mail_sent) {
        setVerifMsg("✅ Código enviado a tu correo. Revisa tu bandeja (vigente 10 minutos)");
      } else {
        setVerifMsg("⚠️ Código generado pero no se pudo enviar el correo. Verifica tu dirección de email.");
      }
    } catch (e: any) {
      console.error('Error en solicitarCodigo:', e);
      setVerifMsg(e?.message || 'Error enviando el código');
    } finally {
      setSendingCode(false);
    }
  }

  async function verificarCodigo() {
    try {
      setVerifMsg(null);
      setVerifying(true);
      if (!verificationId || verificationCode.length !== 3) throw new Error('Ingresa el código de 3 dígitos');
      const res = await fetch(`${API_BASE}/api/verificaciones/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_id: verificationId, codigo: verificationCode })
    });
    const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Código inválido');
      setIsVerified(true);
      setVerifMsg('Código verificado');
    } catch (e: any) {
      setIsVerified(false);
      setVerifMsg(e?.message || 'No se pudo verificar el código');
    } finally {
      setVerifying(false);
    }
  }

  // Countdown para expiración
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setIsVerified(false);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <main className="min-h-screen bg-[#0f1725] text-white">
      <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="text-sm text-slate-600">Cargando...</div>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">{sorteo?.nombre}</h1>
            <p className="text-slate-300 mt-1">{sorteo?.descripcion}</p>
            {conteos && (
              <div className="mt-3 text-sm text-slate-700">Disponibles: {conteos.disponibles} / {conteos.total}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 sm:mt-8">
              <section className="p-4 sm:p-5 rounded-xl border border-white/10 bg-white/5 shadow-sm md:col-span-2">
                <h2 className="text-lg font-semibold mb-3">{paqueteSeleccionado ? 'Compra de promoción' : 'Compra por cantidad'}</h2>
                {paqueteSeleccionado ? (
                  <div className="p-4 rounded-xl border border-white/10 bg-black/30 mb-4">
                    <div className="text-sm text-slate-200">{paqueteSeleccionado.nombre || `${paqueteSeleccionado.cantidad_numeros} tickets`}</div>
                    <div className="text-xs font-semibold text-emerald-400">Incluye {paqueteSeleccionado.cantidad_numeros} tickets</div>
                    <div className="text-rose-400 text-xl font-bold">${Number(paqueteSeleccionado.precio_total || 0).toFixed(2)}</div>
                    <div className="text-xs text-slate-400 line-through">${(precioUnitario * Number(paqueteSeleccionado.cantidad_numeros || 0)).toFixed(2)}</div>
                  </div>
                ) : (
                  <div className="p-3 sm:p-4 rounded-lg border border-white/10 bg-white/5">
                    <div className="text-sm text-slate-300 mb-1">Cantidad de números</div>
                    <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className="border border-white/10 bg-black/30 rounded-md px-3 py-2 w-full text-white" />
                    <div className="text-xs text-slate-400 mt-2">Precio estimado: ${(precioUnitario * cantidad).toFixed(2)}</div>
                </div>
                )}

                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Tus datos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-400">Nombres</span>
                      <input required className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={cliente.nombres} onChange={(e) => setCliente({ ...cliente, nombres: e.target.value })} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-400">Apellidos</span>
                      <input required className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={cliente.apellidos} onChange={(e) => setCliente({ ...cliente, apellidos: e.target.value })} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-400">Cédula</span>
                      <input required className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={cliente.cedula} onChange={(e) => setCliente({ ...cliente, cedula: e.target.value })} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-400">Correo</span>
                      <div className="flex gap-2">
                        <input required type="email" className="flex-1 border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={cliente.correo_electronico} onChange={(e) => setCliente({ ...cliente, correo_electronico: e.target.value })} />
                        <button type="button" onClick={solicitarCodigo} disabled={sendingCode} className={`px-3 py-2 rounded-md text-white text-sm whitespace-nowrap ${sendingCode ? 'bg-rose-700/60 cursor-not-allowed animate-pulse' : 'bg-rose-600 hover:bg-rose-700'}`}>{sendingCode ? 'Enviando…' : 'Enviar código'}</button>
                      </div>
                      {verifMsg && (
                        <span className={`text-xs ${isVerified ? 'text-emerald-400' : 'text-amber-300'}`}>
                          {verifMsg}
                          {expiresAt && remaining > 0 && (
                            <>
                              {" "}(expira en {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')})
                            </>
                          )}
                          {expiresAt && remaining === 0 && ' (expirado)'}
                        </span>
                      )}
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-400">Teléfono</span>
                      <input required className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-400">Código de verificación</span>
                      <div className="flex gap-2">
                        <input required maxLength={3} placeholder="___" className="flex-1 border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white tracking-widest" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0,3))} />
                        <button type="button" onClick={verificarCodigo} disabled={verifying || !verificationId || verificationCode.length !== 3} className={`px-3 py-2 rounded-md text-white text-sm whitespace-nowrap ${verifying ? 'bg-emerald-700/60 cursor-not-allowed animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{verifying ? 'Verificando…' : 'Verificar'}</button>
                      </div>
                    </label>
                    <label className="grid gap-1 md:col-span-1">
                      <span className="text-xs text-slate-400">Dirección</span>
                      <input required className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-white" value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} />
                    </label>
                  </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                  <div className="text-sm font-medium mb-2 text-white">Método de pago</div>
                  {metodos.length === 0 && <div className="text-sm text-slate-400">Pronto habilitaremos métodos disponibles…</div>}
                  <div className="grid gap-3">
                    {metodos.map((m) => (
                      <label key={m.id} className="block rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                        <div className="flex items-center gap-2">
                          <input type="radio" name="metodo" value={m.id} checked={Number(metodoPagoId) === Number(m.id)} onChange={() => setMetodoPagoId(Number(m.id))} />
                          <span className="font-medium">{m.nombre}</span>
                        </div>
                        {m.detalles && (
                          <div className="mt-2 text-xs text-slate-300 grid sm:grid-cols-3 gap-2">
                            {m.detalles.numero_cuenta && <div><span className="text-slate-400">Cuenta:</span> {m.detalles.numero_cuenta}</div>}
                            {m.detalles.tipo_cuenta && <div><span className="text-slate-400">Tipo:</span> {m.detalles.tipo_cuenta}</div>}
                            {m.detalles.titular && <div className="sm:col-span-3"><span className="text-slate-400">Titular:</span> {m.detalles.titular}</div>}
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                  <div className="text-sm font-medium mb-2 text-white">Comprobante de pago</div>
                  <input className="text-sm" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                     <div className="text-xs text-slate-300 mt-2">Total a pagar: <span className="font-semibold text-white">${precioConDesc.toFixed(2)}</span> {paqueteSeleccionado && <span className="line-through ml-2 text-slate-400">${precioSinDesc.toFixed(2)}</span>}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={crearOrdenCompleta} disabled={submitting} className={`w-full sm:w-auto px-4 py-2 rounded-md text-white ${submitting ? 'bg-rose-700/60 cursor-not-allowed animate-pulse' : 'bg-rose-600 hover:bg-rose-700'}`}>{submitting ? 'Generando orden…' : 'Confirmar compra'}</button>
                {metodoPagoId && metodos.find(m => Number(m.id) === Number(metodoPagoId))?.nombre?.toLowerCase().includes('payphone') && (
                  <button
                    onClick={async () => {
                      try {
                        setMsg(null); setMsgType(null);
                        const solicitados = paqueteSeleccionado ? Number(paqueteSeleccionado.cantidad_numeros || 0) : Number(cantidad || 0);
                        if (conteos && solicitados > Number(conteos.disponibles || 0)) throw new Error(`Solo quedan ${conteos.disponibles} números disponibles`);
                        if (!cliente.correo_electronico || !cliente.nombres) throw new Error('Completa tus datos básicos (nombres y correo)');
                        setPayOpening(true);
                        const r = await fetch(`${API_BASE}/api/payments/payphone/init`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            nombres: cliente.nombres,
                            apellidos: cliente.apellidos,
                            cedula: cliente.cedula,
                            correo_electronico: cliente.correo_electronico,
                            telefono: cliente.telefono,
                            direccion: cliente.direccion,
                            sorteo_id: Number(sorteoId),
                            paquete_id: paqueteId ? Number(paqueteId) : undefined,
                            cantidad_numeros: paqueteId ? undefined : Number(cantidad)
                          })
                        });
                        const d = await r.json();
                        if (!r.ok) throw new Error(d?.error || 'No se pudo iniciar Payphone');
                        const payload = d?.payload;
                        const storeId = payload?.storeId;
                        const amount = payload?.amount; // centavos
                        const clientTransactionId = payload?.clientTransactionId;
                        const responseUrl = payload?.responseUrl;
                        // Abrir cajita Payphone inline con callbacks
                        // @ts-ignore
                        if (window?.PayPhone?.Button) {
                          console.log('Payphone SDK config:', { storeId, amount, clientTransactionId });
                          
                          // @ts-ignore
                          window.PayPhone.Button({
                            storeId: storeId,
                            amount: amount,
                            clientTransactionId: clientTransactionId,
                            currency: 'USD',
                            countryCode: 'EC',
                            email: cliente.correo_electronico,
                            phoneNumber: cliente.telefono,
                            onSuccess: async (result: any) => {
                              console.log('Payphone success callback:', result);
                              try {
                                // Esperar 5 segundos para que Payphone procese internamente
                                setMsg('⏳ Procesando confirmación del pago...');
                                setMsgType('info');
                                
                                await new Promise(resolve => setTimeout(resolve, 5000));
                                
                                // Intentar confirmación con retry (máximo 3 intentos)
                                let attempts = 0;
                                let success = false;
                                
                                while (attempts < 3 && !success) {
                                  attempts++;
                                  console.log(`Intento de confirmación ${attempts}/3`);
                                  
                                  try {
                                    const confirmRes = await fetch(`${API_BASE}/api/payments/payphone/confirm`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ clientTransactionId })
                                    });
                                    
                                    console.log(`Backend confirm response (intento ${attempts}):`, confirmRes.status);
                                    const confirmData = await confirmRes.json();
                                    console.log(`Backend confirm data (intento ${attempts}):`, confirmData);
                                    
                                    if (confirmRes.ok) {
                                      success = true;
                                      setMsg('✅ Pago aprobado exitosamente. ¡Gracias por tu compra!');
                                      setMsgType('success');
                                      // Redirigir después de 3 segundos
                                      setTimeout(() => {
                                        window.location.href = '/';
                                      }, 3000);
                                    } else {
                                      throw new Error(confirmData?.error || 'Error confirmando pago');
                                    }
                                  } catch (error: any) {
                                    console.error(`Error en intento ${attempts}:`, error);
                                    
                                    if (attempts < 3) {
                                      setMsg(`⏳ Reintentando confirmación... (${attempts}/3)`);
                                      setMsgType('info');
                                      // Esperar 2 segundos antes del siguiente intento
                                      await new Promise(resolve => setTimeout(resolve, 2000));
                                    } else {
                                      throw error;
                                    }
                                  }
                                }
                                
                                if (!success) {
                                  throw new Error('No se pudo confirmar el pago después de 3 intentos');
                                }
                                
                              } catch (error: any) {
                                console.error('Error final en onSuccess:', error);
                                setMsg(`❌ Error: ${error.message}`);
                                setMsgType('error');
                              }
                            },
                            onError: (error: any) => {
                              console.error('Payphone error callback:', error);
                              setMsg(`❌ Error en el pago: ${error.message || 'Pago no aprobado'}`);
                              setMsgType('error');
                            },
                            onCancel: () => {
                              console.log('Payphone cancelled callback');
                              setMsg('❌ Pago cancelado por el usuario');
                              setMsgType('error');
                            }
                          }).open();
                        } else {
                          // fallback: redirigir a return
                          window.location.href = `/pagos/payphone/return?clientTransactionId=${encodeURIComponent(clientTransactionId)}`;
                        }
                      } catch (e: any) {
                        setMsg(e?.message || 'Error iniciando Payphone');
                        setMsgType('error');
                      } finally {
                        setPayOpening(false);
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
                  >
                    {payOpening ? 'Abriendo Payphone…' : 'Pagar con Payphone'}
                  </button>
                )}
                
                {/* Botón de debug para Payphone */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setMsg('🔍 Probando conexión con Payphone...');
                      setMsgType('info');
                      
                      const debugRes = await fetch(`${API_BASE}/api/payments/payphone/debug`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      const debugData = await debugRes.json();
                      console.log('Payphone debug response:', debugData);
                      
                      if (debugRes.ok) {
                        setMsg(`✅ Conexión exitosa: ${debugData.response.status} - ${debugData.response.statusText}`);
                        setMsgType('success');
                      } else {
                        setMsg(`❌ Error de conexión: ${debugData.error}`);
                        setMsgType('error');
                      }
                    } catch (error: any) {
                      console.error('Error en debug Payphone:', error);
                      setMsg(`❌ Error: ${error.message}`);
                      setMsgType('error');
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
                >
                  🔍 Debug Payphone
                </button>
              </div>
                </div>
              </section>

              <section className="p-4 sm:p-5 rounded-xl border border-white/10 bg-white/5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Resumen</h2>
            <div className="text-sm text-slate-200 space-y-1">
              <div>Sorteo: {sorteo?.nombre}</div>
              <div>Opción: {paqueteSeleccionado ? `${paqueteSeleccionado.cantidad_numeros} tickets (paquete)` : `${cantidad} tickets`}</div>
              <div>Total: ${precioConDesc.toFixed(2)} {paqueteSeleccionado && <span className="line-through ml-1 text-slate-400">${precioSinDesc.toFixed(2)}</span>}</div>
              <div className={`${isVerified ? 'text-emerald-400' : 'text-amber-300'}`}>{isVerified ? 'Código verificado' : 'Código no verificado'}</div>
                  </div>
            {msg && (
              <div className={`mt-3 rounded-lg p-3 text-sm ${
                msgType === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 
                msgType === 'info' ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' :
                'bg-rose-500/10 text-rose-300 border border-rose-500/20'
              }`}>
                {msg}
                {msgType === 'success' && (
                  <div className="mt-2">
                    <button 
                      onClick={limpiarFormulario}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded mr-2"
                    >
                      Hacer otra compra
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 text-xs text-slate-400">
              <a href="/" className="underline hover:text-white">Volver a la página principal</a>
            </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}


