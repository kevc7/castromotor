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
  const [errors, setErrors] = useState<Record<string,string>>({});
  // Modal de éxito de orden
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  // Validaciones ligeras (solo UI) — NO cambian nombres de campos
  // Regex corregido (antes estaba doble escapado y fallaba con correos válidos)
  const emailRegex = /^(?!.*\.{2})[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  function validate(fields = cliente) {
    const e: Record<string,string> = {};
    if (!fields.nombres.trim()) e.nombres = 'Requerido';
    if (!fields.apellidos.trim()) e.apellidos = 'Requerido';
    if (!fields.cedula.trim()) e.cedula = 'Requerido';
    if (!fields.correo_electronico.trim()) e.correo_electronico = 'Ingresa tu correo';
    else if (!emailRegex.test(fields.correo_electronico.trim())) e.correo_electronico = 'Formato de correo inválido';
    if (!fields.telefono.trim()) e.telefono = 'Requerido';
    if (!fields.direccion.trim()) e.direccion = 'Requerido';
    setErrors(e);
    return e;
  }

  useEffect(() => { validate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cliente.correo_electronico, cliente.nombres, cliente.apellidos, cliente.cedula, cliente.telefono, cliente.direccion]);

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
  const currentErrors = validate();
  if (Object.keys(currentErrors).length) throw new Error('Corrige los campos marcados antes de continuar');
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
      // Guardar data para modal (solo mostrar campos relevantes si existen)
      setOrderData({
        order_id: data?.order_id || data?.id,
        codigo: data?.codigo || data?.order_code,
        total: precioConDesc,
        tickets: paqueteSeleccionado ? Number(paqueteSeleccionado.cantidad_numeros || 0) : Number(cantidad || 0),
        paquete: paqueteSeleccionado ? paqueteSeleccionado.nombre || `${paqueteSeleccionado.cantidad_numeros} tickets` : null,
        correo: cliente.correo_electronico
      });
      setShowSuccessModal(true);
      // No limpiar inmediatamente para que el usuario vea el resumen; se limpiará al cerrar el modal
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
  if (errors.correo_electronico) throw new Error(errors.correo_electronico);
      
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
      if (isVerified) return; // ya verificado, evitar doble petición
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
    <>
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

            {conteos && Number(conteos.disponibles) === 0 ? (
              <div className="mt-6 sm:mt-8 p-6 rounded-xl border border-white/10 bg-white/5 text-center">
                <h2 className="text-xl font-semibold mb-2">Tickets agotados</h2>
                <p className="text-sm text-slate-300 max-w-md mx-auto">Se han vendido todos los números disponibles para este sorteo. Muy pronto abriremos nuevos sorteos y promociones.</p>
                <p className="text-sm text-slate-400 max-w-lg mx-auto mt-4 leading-relaxed">Si ya compraste tus tickets para este sorteo, mantente pendiente de esta página y de nuestras redes sociales. El sorteo se jugará con los números oficiales de la lotería y anunciaremos la fecha exacta oportunamente. ¡Gracias por participar y mucha suerte!</p>
                <div className="mt-5 flex justify-center">
                  <a href="/" className="px-5 py-2.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium shadow-sm">Ir al inicio</a>
                </div>
              </div>
            ) : (
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
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          required
                          type="email"
                          className={`flex-1 border ${errors.correo_electronico ? 'border-rose-500/70 ring-1 ring-rose-500/40' : 'border-white/10'} bg-black/30 rounded-md px-3 py-2 text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition`}
                          value={cliente.correo_electronico}
                          onChange={(e) => setCliente({ ...cliente, correo_electronico: e.target.value })}
                          onBlur={() => validate()}
                          placeholder="tu@correo.com"
                        />
                        <button
                          type="button"
                          onClick={solicitarCodigo}
                          disabled={sendingCode || Boolean(errors.correo_electronico)}
                          className={`sm:w-auto w-full px-3 py-2 rounded-md text-white text-xs font-medium ${(sendingCode || errors.correo_electronico) ? 'bg-rose-700/60 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'} transition`}
                        >
                          {sendingCode ? 'Enviando…' : 'Enviar código'}
                        </button>
                      </div>
                      {errors.correo_electronico && <span className="text-[11px] text-rose-400">{errors.correo_electronico}</span>}
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
                        <input
                          required
                          maxLength={3}
                          placeholder="___"
                          disabled={isVerified}
                          readOnly={isVerified}
                          className={`flex-1 border rounded-md px-3 py-2 tracking-widest transition ${isVerified ? 'border-emerald-500/50 bg-emerald-900/30 text-emerald-300 cursor-not-allowed' : 'border-white/10 bg-black/30 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40'}`}
                          value={verificationCode}
                          onChange={(e) => !isVerified && setVerificationCode(e.target.value.replace(/\D/g, '').slice(0,3))}
                        />
                        <button
                          type="button"
                          onClick={verificarCodigo}
                          disabled={isVerified || verifying || !verificationId || verificationCode.length !== 3}
                          className={`px-3 py-2 rounded-md text-white text-sm whitespace-nowrap ${isVerified ? 'bg-emerald-700/60 cursor-not-allowed' : verifying ? 'bg-emerald-700/60 cursor-not-allowed animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                          {isVerified ? 'Verificado' : verifying ? 'Verificando…' : 'Verificar'}
                        </button>
                      </div>
                      {isVerified && <span className="text-[11px] text-emerald-400 mt-0.5">Código confirmado. Ya no puedes modificarlo.</span>}
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
                <div className="p-4 rounded-xl border-2 border-dashed border-rose-500/40 bg-gradient-to-br from-black/40 to-black/20 relative group overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition duration-500 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)]" />
                  <div className="text-sm font-semibold mb-3 flex items-center gap-2 text-white">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-600/80 text-white shadow ring-1 ring-white/10">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                        <circle cx="9" cy="11" r="2.5" />
                        <path d="M21 15l-4.5-4.5a1 1 0 0 0-1.4 0L9 17" />
                      </svg>
                      <span className="sr-only">Imagen</span>
                    </span>
                    Comprobante de pago
                  </div>
                  <label className="block cursor-pointer">
                    <span className="sr-only">Subir comprobante</span>
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <div className={`rounded-lg border-2 border-dashed ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/15 hover:border-rose-400/60 bg-white/5 hover:bg-white/10'} p-4 text-center transition`}>                        
                      {file ? (
                        <div className="text-xs text-emerald-300 break-all">
                          Archivo seleccionado: <span className="font-medium">{file.name}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-300">
                          Arrastra y suelta aquí o <span className="text-rose-400 font-medium">haz clic</span> para subir tu comprobante (imagen o PDF)
                        </div>
                      )}
                    </div>
                  </label>
                  <div className="mt-4 text-center">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-1">Total a pagar</div>
                    <div className="text-2xl font-extrabold text-white drop-shadow-sm">${precioConDesc.toFixed(2)}</div>
                    {paqueteSeleccionado && (
                      <div className="text-[11px] text-slate-400 mt-1">Precio sin promoción: <span className="line-through">${precioSinDesc.toFixed(2)}</span></div>
                    )}
                    <p className="mt-3 text-[11px] leading-relaxed text-slate-300 max-w-xs mx-auto">
                      Realiza una <span className="text-white font-medium">transferencia o depósito</span> EXACTA por este monto y adjunta el comprobante para validar tu participación.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={crearOrdenCompleta} disabled={submitting || Object.keys(errors).length > 0} className={`w-full sm:w-auto px-4 py-2 rounded-md text-white ${(submitting || Object.keys(errors).length > 0) ? 'bg-rose-700/60 cursor-not-allowed animate-pulse' : 'bg-rose-600 hover:bg-rose-700'} transition`}>{submitting ? 'Generando orden…' : 'Confirmar compra'}</button>
                {metodoPagoId && metodos.find(m => Number(m.id) === Number(metodoPagoId))?.nombre?.toLowerCase().includes('payphone') && (
                  <button
                    onClick={async () => {
                      console.log('🚀 [Frontend] === INICIO PROCESO PAYPHONE ===');
                      try {
                        setMsg(null); setMsgType(null);
                        
                        console.log('🔍 [Frontend] Validando formulario...');
                        const currentErrors = validate();
                        console.log('🔍 [Frontend] Errores de validación:', currentErrors);
                        
                        if (Object.keys(currentErrors).length > 0) {
                          console.error('❌ [Frontend] Formulario inválido:', currentErrors);
                          throw new Error('Completa los campos requeridos en tus datos.');
                        }
                        
                        const solicitados = paqueteSeleccionado ? Number(paqueteSeleccionado.cantidad_numeros || 0) : Number(cantidad || 0);
                        console.log('🔍 [Frontend] Verificando stock:', { solicitados, disponibles: conteos?.disponibles });
                        
                        if (conteos && solicitados > Number(conteos.disponibles || 0)) {
                          console.error('❌ [Frontend] Stock insuficiente:', { solicitados, disponibles: conteos.disponibles });
                          throw new Error(`Solo quedan ${conteos.disponibles} números disponibles`);
                        }
                        
                        setPayOpening(true);
                        setMsg('Preparando pago con Payphone...');
                        setMsgType('info');

                        const requestData = {
                          nombres: cliente.nombres,
                          apellidos: cliente.apellidos,
                          cedula: cliente.cedula,
                          correo_electronico: cliente.correo_electronico,
                          telefono: cliente.telefono,
                          direccion: cliente.direccion,
                          sorteo_id: Number(sorteoId),
                          paquete_id: paqueteId ? Number(paqueteId) : undefined,
                          cantidad_numeros: paqueteId ? undefined : Number(cantidad)
                        };

                        console.log('📤 [Frontend] Enviando request a backend:', {
                          url: `${API_BASE}/api/payments/payphone/init`,
                          method: 'POST',
                          data: requestData
                        });

                        const r = await fetch(`${API_BASE}/api/payments/payphone/init`, {
                          method: 'POST', 
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(requestData)
                        });
                        
                        console.log('📥 [Frontend] Respuesta del backend:', {
                          status: r.status,
                          statusText: r.statusText,
                          ok: r.ok,
                          headers: Object.fromEntries(r.headers.entries())
                        });

                        const d = await r.json();
                        console.log('📥 [Frontend] Datos de respuesta:', d);
                        
                        if (!r.ok || !d.payphoneConfig) {
                          console.error('❌ [Frontend] Error en respuesta:', { 
                            status: r.status, 
                            response: d,
                            hasPayphoneConfig: !!d.payphoneConfig
                          });
                          throw new Error(d?.error || 'No se pudo iniciar el pago con Payphone.');
                        }

                        setMsg('Abriendo cajita de pagos...');
                        console.log('🔍 [Frontend] Iniciando carga de Payphone SDK...');
                        
                        // Cargar dinámicamente la Cajita de Pagos de Payphone
                        if (typeof window !== 'undefined') {
                          console.log('🔍 [Frontend] Verificando SDK de Payphone...');
                          // Verificar si ya está cargado el SDK
                          if (!(window as any).PPaymentButtonBox) {
                            console.log('🔍 [Frontend] SDK no cargado, cargando recursos...');
                            
                            // Cargar CSS
                            const link = document.createElement('link');
                            link.rel = 'stylesheet';
                            link.href = 'https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.css';
                            document.head.appendChild(link);
                            console.log('✅ [Frontend] CSS de Payphone cargado');
                            
                            // Cargar JS
                            const script = document.createElement('script');
                            script.src = 'https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.js';
                            script.type = 'module';
                            
                            await new Promise((resolve, reject) => {
                              script.onload = () => {
                                console.log('✅ [Frontend] JavaScript de Payphone cargado');
                                resolve(undefined);
                              };
                              script.onerror = (err) => {
                                console.error('❌ [Frontend] Error cargando JavaScript de Payphone:', err);
                                reject(err);
                              };
                              document.head.appendChild(script);
                            });
                            
                            // Esperar un poco más para que se inicialice
                            console.log('🔍 [Frontend] Esperando inicialización del SDK...');
                            await new Promise(resolve => setTimeout(resolve, 1000));
                          } else {
                            console.log('✅ [Frontend] SDK ya estaba cargado');
                          }
                          
                          // Verificar que el SDK esté disponible
                          if ((window as any).PPaymentButtonBox) {
                            console.log('🔍 [Frontend] Configuración Payphone recibida:', d.payphoneConfig);
                            
                            // Crear contenedor temporal para la cajita
                            const containerId = 'payphone-button-container';
                            let container = document.getElementById(containerId);
                            if (!container) {
                              console.log('🔍 [Frontend] Creando contenedor para cajita...');
                              container = document.createElement('div');
                              container.id = containerId;
                              container.style.position = 'fixed';
                              container.style.top = '50%';
                              container.style.left = '50%';
                              container.style.transform = 'translate(-50%, -50%)';
                              container.style.zIndex = '9999';
                              container.style.background = 'white';
                              container.style.padding = '20px';
                              container.style.borderRadius = '10px';
                              container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
                              document.body.appendChild(container);
                              console.log('✅ [Frontend] Contenedor creado');
                            } else {
                              console.log('🔍 [Frontend] Reutilizando contenedor existente');
                            }
                            
                            // Crear la cajita de pagos
                            console.log('🔍 [Frontend] Creando instancia de PPaymentButtonBox...');
                            try {
                              const ppb = new (window as any).PPaymentButtonBox(d.payphoneConfig);
                              console.log('✅ [Frontend] Instancia PPaymentButtonBox creada');
                              
                              // Configurar callbacks para manejar el resultado del pago
                              ppb.onSuccess = (response: any) => {
                                console.log('✅ [Frontend] Pago exitoso callback:', response);
                                setMsg('¡Pago procesado exitosamente! Redirigiendo...');
                                setMsgType('success');
                                
                                // Redirigir a página de éxito después de un breve delay
                                setTimeout(() => {
                                  window.location.href = `/payphone/success?clientTxId=${d.payphoneConfig.clientTransactionId}&id=${response.id || ''}`;
                                }, 2000);
                              };
                              
                              ppb.onFailure = (error: any) => {
                                console.error('❌ [Frontend] Pago fallido callback:', error);
                                setMsg('El pago no pudo completarse. Intenta nuevamente.');
                                setMsgType('error');
                                
                                // Redirigir a página de error después de un breve delay
                                setTimeout(() => {
                                  window.location.href = `/payphone/error?reason=payment_failed&message=${encodeURIComponent(error.message || 'Pago no completado')}`;
                                }, 2000);
                              };
                              
                              ppb.onCancelled = () => {
                                console.log('ℹ️ [Frontend] Pago cancelado por usuario');
                                setMsg('Pago cancelado.');
                                setMsgType('error');
                                
                                // Limpiar contenedor
                                const cont = document.getElementById(containerId);
                                if (cont) cont.remove();
                              };
                              
                              console.log('🔍 [Frontend] Renderizando cajita en contenedor...');
                              ppb.render(containerId);
                              console.log('✅ [Frontend] Cajita renderizada exitosamente');
                              
                              setMsg('✅ Cajita de pagos abierta. Completa tu pago en la ventana.');
                              setMsgType('success');
                              
                              // Limpiar contenedor después de un tiempo
                              setTimeout(() => {
                                console.log('🔍 [Frontend] Limpiando contenedor por timeout...');
                                const cont = document.getElementById(containerId);
                                if (cont) {
                                  cont.remove();
                                  console.log('✅ [Frontend] Contenedor limpiado');
                                }
                              }, 300000); // 5 minutos
                            } catch (payboxError) {
                              console.error('❌ [Frontend] Error creando/renderizando PPaymentButtonBox:', payboxError);
                              throw new Error(`Error inicializando cajita de pagos: ${payboxError}`);
                            }
                            
                          } else {
                            console.error('❌ [Frontend] SDK no disponible después de la carga');
                            throw new Error('No se pudo cargar el SDK de Payphone.');
                          }
                        } else {
                          console.error('❌ [Frontend] Window no disponible (SSR?)');
                          throw new Error('Entorno no compatible con Payphone.');
                        }

                      } catch (e: any) {
                        console.error('❌ [Frontend] === ERROR GENERAL ===');
                        console.error('❌ [Frontend] Error completo:', e);
                        console.error('❌ [Frontend] Stack trace:', e?.stack);
                        setMsg(e?.message || 'Error iniciando Payphone');
                        setMsgType('error');
                      } finally {
                        console.log('🔍 [Frontend] Finalizando proceso, limpiando estado...');
                        setPayOpening(false);
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md transition-transform transform hover:scale-105"
                  >
                    {payOpening ? 'Preparando Payphone…' : 'Pagar con Payphone'}
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
            )}
          </>
        )}
      </div>
    </main>
    {showSuccessModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-[#0f1725] w-full max-w-md rounded-xl border border-white/10 shadow-lg p-6 relative">
          <button onClick={() => { setShowSuccessModal(false); limpiarFormulario(); }} className="absolute top-2 right-2 text-slate-400 hover:text-white">✕</button>
          <h3 className="text-xl font-semibold mb-2 text-emerald-400">Orden generada</h3>
          <p className="text-sm text-slate-300 mb-4">Hemos recibido tu orden. Un administrador la revisará y recibirás un correo con la confirmación.</p>
          {orderData && (
            <div className="text-sm bg-black/50 rounded-lg border border-white/10 p-4 space-y-2">
              {orderData.order_id && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 min-w-[90px]">ID Orden:</span>
                  <span className="font-semibold text-white tracking-wide">{orderData.order_id}</span>
                </div>
              )}
              {orderData.codigo && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 min-w-[90px]">Código:</span>
                  <span className="font-medium text-emerald-300 bg-emerald-600/10 px-2 py-0.5 rounded border border-emerald-500/30 select-all">{orderData.codigo}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-slate-400 min-w-[90px]">Tickets:</span>
                <span className="font-semibold text-white">{orderData.tickets}</span>
              </div>
              {orderData.paquete && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 min-w-[90px]">Paquete:</span>
                  <span className="text-white/90">{orderData.paquete}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-slate-400 min-w-[90px]">Total:</span>
                <span className="font-bold text-white">${orderData.total?.toFixed ? orderData.total.toFixed(2) : orderData.total}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-400 min-w-[90px]">Correo:</span>
                <a href={`mailto:${orderData.correo}`} className="text-sky-300 hover:text-sky-200 underline break-all select-all">{orderData.correo}</a>
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button onClick={() => { setShowSuccessModal(false); limpiarFormulario(); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-4 py-2">Nueva compra</button>
            <a href="/" className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white rounded-md px-4 py-2">Ir al inicio</a>
          </div>
        </div>
      </div>
    )}
    </>
  );
}


