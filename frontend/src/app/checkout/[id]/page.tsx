"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

type Step = 1 | 2 | 3;

interface ClienteForm {
  nombres: string; apellidos: string; cedula: string; correo_electronico: string; telefono: string; direccion: string;
}

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const sorteoId = params?.id;

  // Selección proveniente de pantalla anterior
  const paqueteIdQuery = sp.get('paqueteId');
  const cantidadQuery = sp.get('cantidad');

  // Paso
  const [step, setStep] = useState<Step>(1);

  // Datos sorteo / paquetes
  const [loadingSorteo, setLoadingSorteo] = useState(true);
  const [sorteo, setSorteo] = useState<any>(null);
  const [paquetes, setPaquetes] = useState<any[]>([]);
  const [conteos, setConteos] = useState<any>(null);

  // Cliente
  const [cliente, setCliente] = useState<ClienteForm>({ nombres: '', apellidos: '', cedula: '', correo_electronico: '', telefono: '', direccion: '' });
  const [errors, setErrors] = useState<Record<string,string>>({});

  // Verificación correo
  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifMsg, setVerifMsg] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);

  // Método de pago
  const [metodos, setMetodos] = useState<any[]>([]); // incluye Payphone + bancos
  const [paymentMode, setPaymentMode] = useState<'transferencia' | 'payphone' | null>(null);
  const [selectedBancoId, setSelectedBancoId] = useState<number | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);

  // Estados Payphone
  const [payphoneLoading, setPayphoneLoading] = useState(false);
  const [payphoneMsg, setPayphoneMsg] = useState<string | null>(null);

  // Resultado (Step 3)
  const [result, setResult] = useState<any>(null);
  const [payphoneOrdenId, setPayphoneOrdenId] = useState<string | null>(null);

  // Feedback general
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info'; msg: string } | null>(null);

  // Carga inicial de sorteo / paquetes
  useEffect(() => {
    (async () => {
      if (!sorteoId) return;
      try {
        const res = await fetch(`${API_BASE}/api/sorteos/${sorteoId}`);
        const data = await res.json();
        setSorteo(data.sorteo);
        setPaquetes(data.paquetes || []);
        setConteos(data.conteos);
      } catch (e) {
        setAlert({ type: 'error', msg: 'Error cargando sorteo' });
      } finally { setLoadingSorteo(false); }
    })();
  }, [sorteoId]);

  // Cargar métodos de pago públicos
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metodos_pago`, { cache: "no-store" });
        const data = await res.json();
        setMetodos(data.metodos || []);
      } catch (e) {
        // silencioso
      }
    })();
  }, []);

  // Derivar selección final
  const paqueteSeleccionado = useMemo(() => paquetes.find(p => String(p.id) === String(paqueteIdQuery)), [paquetes, paqueteIdQuery]);
  const cantidad = useMemo(() => paqueteSeleccionado ? Number(paqueteSeleccionado.cantidad_numeros || 0) : Math.max(1, Number(cantidadQuery || 0)), [paqueteSeleccionado, cantidadQuery]);
  const precioUnitario = Number(sorteo?.precio_por_numero || 0);
  const monto = paqueteSeleccionado ? Number(paqueteSeleccionado.precio_total || 0) : (precioUnitario * cantidad);
  const precioSinPromo = paqueteSeleccionado ? precioUnitario * Number(paqueteSeleccionado.cantidad_numeros || 0) : monto;

  // Validación datos cliente
  const emailRegex = /^(?!.*\.{2})[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  const validateCliente = useCallback(() => {
    const e: Record<string,string> = {};
    if (!cliente.nombres.trim()) e.nombres = 'Requerido';
    if (!cliente.apellidos.trim()) e.apellidos = 'Requerido';
    if (!cliente.cedula.trim()) e.cedula = 'Requerido';
    if (!cliente.correo_electronico.trim()) e.correo_electronico = 'Correo requerido';
    else if (!emailRegex.test(cliente.correo_electronico.trim())) e.correo_electronico = 'Correo inválido';
  const tel = cliente.telefono.replace(/\D/g, '');
  if (!tel) e.telefono = 'Requerido';
  else if (tel.length !== 9) e.telefono = 'Debe tener 9 dígitos';
    if (!cliente.direccion.trim()) e.direccion = 'Requerido';
    setErrors(e); return e;
  }, [cliente]);
  useEffect(() => { validateCliente(); }, [cliente, validateCliente]);

  // Countdown verificación y control de resend timeout
  const [canResendCode, setCanResendCode] = useState(true);
  const [resendCountdown, setResendCountdown] = useState(0);
  
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setIsVerified(false);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  
  // Countdown para reenvío de código
  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResendCode(true);
      return;
    }
    
    setCanResendCode(false);
    const id = setInterval(() => {
      setResendCountdown(prev => {
        const newValue = prev - 1;
        if (newValue <= 0) setCanResendCode(true);
        return newValue;
      });
    }, 1000);
    
    return () => clearInterval(id);
  }, [resendCountdown]);

  async function solicitarCodigo() {
    try {
      if (!canResendCode) return;
      
      setVerifMsg(null);
      setSendingCode(true);
      const e = validateCliente();
      if (e.correo_electronico) throw new Error(e.correo_electronico);
      const res = await fetch(`${API_BASE}/api/verificaciones/solicitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo_electronico: cliente.correo_electronico }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar');
      setVerificationId(Number(data.verification_id));
      setVerificationCode('');
      setExpiresAt(Date.now() + 10 * 60 * 1000);
      setVerifMsg(data.mail_sent ? 'Código enviado al correo' : 'Generado pero no se envió. Revisa dirección.');
      
      // Establecer timeout para reenvío (60 segundos)
      setResendCountdown(60);
    } catch (err: any) {
      setVerifMsg(err?.message || 'Error solicitando código');
    } finally { setSendingCode(false); }
  }

  async function verificarCodigo() {
    try {
      if (isVerified) return;
      if (!verificationId || verificationCode.length !== 3) throw new Error('Ingresa el código de 3 dígitos');
      setVerifying(true);
      const res = await fetch(`${API_BASE}/api/verificaciones/verificar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verification_id: verificationId, codigo: verificationCode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Código inválido');
      setIsVerified(true);
      setVerifMsg('Código verificado');
    } catch (err: any) { setVerifMsg(err?.message || 'Error verificando'); setIsVerified(false); }
    finally { setVerifying(false); }
  }

  const canNextFromStep1 = isVerified && Object.keys(errors).length === 0;
  const bancos = useMemo(() => metodos.filter(m => (m.nombre || '').toLowerCase() !== 'payphone' && (m.tipo || '').includes('transfer')), [metodos]);
  const metodoPayphoneDisponible = metodos.some(m => (m.nombre || '').toLowerCase() === 'payphone');

  async function crearOrdenTransferencia() {
    try {
      setAlert(null);
      // Verificar que estamos en modo transferencia
      if (paymentMode !== 'transferencia') throw new Error('Método de pago no es transferencia');
      if (!selectedBancoId) throw new Error('Selecciona una cuenta bancaria');
      if (!comprobanteFile) throw new Error('Debes subir el comprobante');
      if (!isVerified) throw new Error('Verifica tu correo');
      if (!verificationId || verificationCode.length !== 3) throw new Error('Código de verificación incompleto');
      // FormData
      const form = new FormData();
      form.append('nombres', cliente.nombres);
      form.append('apellidos', cliente.apellidos);
      form.append('cedula', cliente.cedula);
      form.append('correo_electronico', cliente.correo_electronico);
      form.append('telefono', cliente.telefono);
      form.append('direccion', cliente.direccion);
      form.append('verification_id', String(verificationId));
      form.append('verification_code', verificationCode);
      form.append('sorteo_id', String(sorteoId));
      if (paqueteSeleccionado) form.append('paquete_id', String(paqueteSeleccionado.id)); else form.append('cantidad_numeros', String(cantidad));
      form.append('metodo_pago_id', String(selectedBancoId));
      form.append('file', comprobanteFile);
      const res = await fetch(`${API_BASE}/api/orders/complete`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error creando la orden');
      setResult({ modo: 'transferencia', estado: 'pendiente', codigo: data?.orden?.codigo || data?.codigo, monto: monto.toFixed(2), cantidad });
      setStep(3);
    } catch (err: any) {
      setAlert({ type: 'error', msg: err?.message || 'Error en transferencia' });
    }
  }

  async function iniciarPayphone() {
    try {
      setAlert(null);
      // Verificar que estamos en modo payphone
      if (paymentMode !== 'payphone') throw new Error('Método de pago no es Payphone');
      if (!metodoPayphoneDisponible) throw new Error('Payphone no disponible');
      if (!isVerified) throw new Error('Verifica tu correo primero');
      setPayphoneLoading(true); setPayphoneMsg('Preparando pago con Payphone...');
      const r = await fetch(`${API_BASE}/api/payments/payphone/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        nombres: cliente.nombres, apellidos: cliente.apellidos, cedula: cliente.cedula, correo_electronico: cliente.correo_electronico, telefono: cliente.telefono, direccion: cliente.direccion, sorteo_id: Number(sorteoId), paquete_id: paqueteSeleccionado ? Number(paqueteSeleccionado.id) : undefined, cantidad_numeros: paqueteSeleccionado ? undefined : Number(cantidad)
      })});
  const d = await r.json();
  if (!r.ok || !d.payphoneConfig) throw new Error(d?.error || 'No se pudo iniciar pago');
  setPayphoneOrdenId(String(d.orden_id));
      setPayphoneMsg('Cargando cajita...');
      // Cargar SDK
      if (typeof window !== 'undefined') {
        if (!(window as any).PPaymentButtonBox) {
          const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.css'; document.head.appendChild(link);
          const script = document.createElement('script'); script.src = 'https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.js'; script.type = 'module';
          await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
          await new Promise(r => setTimeout(r, 600));
        }
        if ((window as any).PPaymentButtonBox) {
          // Overlay + contenedor interno, con botón de cierre
          let overlay = document.getElementById('pp-overlay');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pp-overlay';
            Object.assign(overlay.style, {
              position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: '9999', padding: '20px', boxSizing: 'border-box'
            } as CSSStyleDeclaration);
            document.body.appendChild(overlay);
          } else {
            overlay.innerHTML = '';
          }
          const closeBtn = document.createElement('button');
          closeBtn.type = 'button';
          closeBtn.innerText = '✕';
            Object.assign(closeBtn.style, {
              position: 'absolute', top: '14px', right: '16px', background: 'rgba(0,0,0,0.55)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', cursor: 'pointer', fontSize: '16px',
              width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            } as CSSStyleDeclaration);
          closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,0,90,0.6)'; };
          closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(0,0,0,0.55)'; };
          closeBtn.onclick = () => { cancelarPayphone(); };
          // Contenedor donde Payphone inyectará su UI
          const inner = document.createElement('div');
          inner.id = 'pp-box';
          Object.assign(inner.style, {
            width: '100%', maxWidth: '640px', background: '#fff', borderRadius: '12px',
            boxShadow: '0 8px 28px -6px rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative'
          } as CSSStyleDeclaration);
          overlay.appendChild(inner);
          overlay.appendChild(closeBtn);
          const ppb = new (window as any).PPaymentButtonBox(d.payphoneConfig);
          ppb.render('pp-box');
          setPayphoneMsg('✔ Cajita abierta. Completa el pago.');
        } else throw new Error('SDK Payphone no cargado');
      }
    } catch (err: any) {
      setPayphoneMsg(null);
      setAlert({ type: 'error', msg: err?.message || 'Error Payphone' });
    } finally { setPayphoneLoading(false); }
  }

  async function cancelarPayphone() {
    try {
      if (!payphoneOrdenId) return;
      const overlay = document.getElementById('pp-overlay');
      if (overlay) overlay.remove();
      const resp = await fetch(`${API_BASE}/api/orders/${payphoneOrdenId}/cancel`, { method: 'POST' });
      if (!resp.ok) throw new Error('No se pudo cancelar');
      setResult({ modo: 'payphone', estado: 'fallido', reason: 'cancelado_usuario' });
      setStep(3);
    } catch (e:any) {
      setAlert({ type: 'error', msg: e?.message || 'Error cancelando' });
    }
  }

  function retryPayphone() {
    // Elimina overlay residual
    const overlay = document.getElementById('pp-overlay');
    if (overlay) overlay.remove();
    setResult(null);
    setPayphoneOrdenId(null);
    // Volver al paso 2 directamente (se mantienen datos cliente)
    setStep(2);
    // Limpiar query params resultado sin perder selección inicial
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('resultado');
      url.searchParams.delete('orden');
      url.searchParams.delete('ordenId');
      url.searchParams.delete('reason');
      url.searchParams.delete('clientTx');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  // UI helpers
  function StepIndicator() {
    const steps = [1,2,3] as Step[];
    const stepTitles = ['Datos', 'Pago', 'Confirmación'];
    
    return (
      <div className="mb-8">
        {/* Progress line background */}
        <div className="relative flex items-center justify-between max-w-md mx-auto mb-4">
          {/* Background line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/20 transform -translate-y-1/2"></div>
          
          {/* Progress line (only shows progress between completed steps) */}
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-[#AA2F0B] to-[#fb923c] transform -translate-y-1/2 transition-all duration-500 ease-out"
            style={{ 
              width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' 
            }}
          ></div>
          
          {/* Step circles */}
          {steps.map(s => (
            <div key={s} className="relative z-10">
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 shadow-lg
                  ${step === s
                    ? 'bg-gradient-to-br from-[#AA2F0B] to-[#fb923c] text-white ring-4 ring-[#AA2F0B]/20 scale-110 shadow-xl'
                    : s < step
                      ? 'bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-lg'
                      : 'bg-white/10 text-white/50 border-2 border-white/20'
                  }
                `}
              >
                {s < step ? (
                  // Checkmark for completed steps
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Step labels */}
        <div className="flex items-center justify-between max-w-md mx-auto">
          {stepTitles.map((title, index) => {
            const s = index + 1;
            return (
              <div key={s} className="text-center">
                <span
                  className={`
                    text-sm font-medium transition-colors duration-300
                    ${step === s
                      ? 'text-[#fb923c] font-semibold'
                      : s < step
                        ? 'text-[#10b981] font-semibold'
                        : 'text-white/60'
                    }
                  `}
                >
                  {title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Manejo de resultado de Payphone (query params)
  const payResult = sp.get('resultado');
  const ordenCodigo = sp.get('orden');
  const ordenId = sp.get('ordenId');
  const reason = sp.get('reason');
  const pendingClientTx = sp.get('clientTx');
  useEffect(() => {
    if (payResult && step !== 3) {
      if (payResult === 'payphone_ok') {
        setResult({ modo: 'payphone', estado: 'aprobado', codigo: ordenCodigo, ordenId });
        setStep(3 as Step);
      } else if (payResult === 'payphone_fail') {
        setResult({ modo: 'payphone', estado: 'fallido', codigo: ordenCodigo, ordenId, reason });
        setStep(3 as Step);
      } else if (payResult === 'payphone_pending') {
        // Mostrar pantalla intermedia de espera y comenzar polling
        setResult({ modo: 'payphone', estado: 'pendiente', codigo: ordenCodigo, ordenId, clientTx: pendingClientTx });
        setStep(3 as Step);
      }
    }
  }, [payResult, step, ordenCodigo, ordenId, reason, pendingClientTx]);

  // Polling si pendiente
  useEffect(() => {
    if (result?.modo === 'payphone' && result.estado === 'pendiente' && result.clientTx) {
      let stop = false;
      async function poll() {
        if (stop) return;
        try {
          const r = await fetch(`${API_BASE}/api/payments/payphone/status/${result.clientTx}`);
          const d = await r.json();
          if (d.status === 'approved') {
            setResult({ modo: 'payphone', estado: 'aprobado', codigo: result.codigo, ordenId: result.ordenId });
          } else if (d.status === 'failed') {
            setResult({ modo: 'payphone', estado: 'fallido', codigo: result.codigo, ordenId: result.ordenId, reason: 'rechazado' });
          } else {
            setTimeout(poll, 2000);
          }
        } catch { setTimeout(poll, 3000); }
      }
      poll();
      return () => { stop = true; };
    }
  }, [result]);

  if (loadingSorteo) return <div className="min-h-screen flex items-center justify-center bg-[#0f1725] text-white">Cargando…</div>;
  if (!sorteo) return <div className="min-h-screen flex items-center justify-center bg-[#0f1725] text-white">Sorteo no encontrado</div>;
  if (!cantidad || cantidad <= 0) return <div className="min-h-screen flex items-center justify-center bg-[#0f1725] text-white">Seleccione primero su compra</div>;

  return (
    <main className="min-h-screen bg-[#0f1725] text-white px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
        <p className="text-sm text-slate-300 mb-6">{sorteo.nombre}</p>
        <StepIndicator />
        {alert && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${alert.type === 'error' ? 'bg-rose-600/20 border border-rose-500/40 text-rose-200' : alert.type === 'success' ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-200' : 'bg-blue-600/20 border border-blue-500/40 text-blue-200'}`}>{alert.msg}</div>}

        {step === 1 && (
          <section className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-5 rounded-xl border border-white/10 bg-white/5">
              <h2 className="text-lg font-semibold mb-4">Tus datos (Paso 1)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['nombres','apellidos','cedula'] as (keyof ClienteForm)[]).map(field => (
                  <label key={field} className="grid gap-1">
                    <span className="text-xs text-slate-400 capitalize">{field}</span>
                    <input className={`border rounded-md px-3 py-2 bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40 ${errors[field] ? 'ring-rose-500/40 border-rose-500/50' : ''}`} value={cliente[field]} onChange={e => setCliente(c => ({ ...c, [field]: e.target.value }))} />
                    {errors[field] && <span className="text-[11px] text-rose-400">{errors[field]}</span>}
                  </label>
                ))}

                {/* Teléfono con prefijo +593 y restricción a 9 dígitos */}
                <label className="grid gap-1">
                  <span className="text-xs text-slate-400">Telefono</span>
                  <div className={`flex items-center gap-2 border rounded-md bg-black/30 border-white/10 focus-within:ring-2 focus-within:ring-rose-500/40 ${errors.telefono ? 'ring-rose-500/40 border-rose-500/50' : ''}`}>
                    <span className="pl-3 pr-1 text-slate-300 select-none">+593</span>
                    <input
                      inputMode="numeric"
                      pattern="\\d{9}"
                      maxLength={9}
                      placeholder="9 dígitos"
                      className="flex-1 bg-transparent outline-none text-white py-2 pr-3"
                      value={cliente.telefono}
                      onChange={e => {
                        const onlyDigits = e.target.value.replace(/[^0-9]/g, '').slice(0,9);
                        setCliente(c => ({ ...c, telefono: onlyDigits }));
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400">Ingresa solo los 9 dígitos. El código de país se agrega automáticamente.</span>
                  {errors.telefono && <span className="text-[11px] text-rose-400">{errors.telefono}</span>}
                </label>

                {/* Dirección */}
                <label className="grid gap-1">
                  <span className="text-xs text-slate-400 capitalize">direccion</span>
                  <input className={`border rounded-md px-3 py-2 bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40 ${errors.direccion ? 'ring-rose-500/40 border-rose-500/50' : ''}`} value={cliente.direccion} onChange={e => setCliente(c => ({ ...c, direccion: e.target.value }))} />
                  {errors.direccion && <span className="text-[11px] text-rose-400">{errors.direccion}</span>}
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-slate-400">Correo</span>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <input type="email" className={`flex-1 border rounded-md px-3 py-2 bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40 ${errors.correo_electronico ? 'ring-rose-500/40 border-rose-500/50' : ''}`} value={cliente.correo_electronico} onChange={e => { setCliente(c => ({ ...c, correo_electronico: e.target.value })); setIsVerified(false); }} />
                    <button type="button" onClick={solicitarCodigo} disabled={sendingCode || !canResendCode || !!errors.correo_electronico} className={`px-4 py-2 rounded-md text-white text-sm font-medium ${!canResendCode ? 'bg-gray-600 cursor-not-allowed' : sendingCode ? 'bg-rose-700/60 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'} transition`}>
                      {sendingCode ? 'Enviando…' : !canResendCode ? `Espera ${resendCountdown}s` : 'Enviar código'}
                    </button>
                  </div>
                  {verifMsg && <span className={`text-[11px] ${isVerified ? 'text-emerald-400' : 'text-amber-300'}`}>{verifMsg}{expiresAt && remaining>0 && ` (expira en ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')})`}</span>}
                </label>
                <label className="grid gap-1 w-full md:col-span-2">
                  <span className="text-xs text-slate-400">Código verificación</span>
                  <div className="flex gap-2">
                    <input maxLength={3} disabled={isVerified} value={verificationCode} onChange={e => !isVerified && setVerificationCode(e.target.value.replace(/\D/g,'').slice(0,3))} className={`flex-1 border rounded-md px-3 py-2 tracking-widest bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${isVerified ? 'bg-emerald-900/30 text-emerald-300' : ''}`} placeholder="___" />
                    <button type="button" onClick={verificarCodigo} disabled={isVerified || !verificationId || verificationCode.length !== 3 || verifying} className={`px-4 py-2 rounded-md text-white text-sm font-medium ${isVerified ? 'bg-emerald-700/60' : verifying ? 'bg-emerald-700/60 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'} transition`}>{isVerified ? 'Verificado' : verifying ? 'Verificando…' : 'Verificar'}</button>
                  </div>
                </label>
              </div>
              <div className="mt-6 flex justify-end">
                <button disabled={!canNextFromStep1} onClick={() => setStep(2)} className={`px-6 py-2 rounded-md font-semibold text-sm ${canNextFromStep1 ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'} transition`}>Continuar</button>
              </div>
            </div>
            <ResumenCompra paquete={paqueteSeleccionado} cantidad={cantidad} monto={monto} precioSinPromo={precioSinPromo} conteos={conteos} />
          </section>
        )}

        {step === 2 && (
          <section className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-5 rounded-xl border border-white/10 bg-white/5">
              <h2 className="text-lg font-semibold mb-4">Método de pago (Paso 2)</h2>
              <div className="grid gap-3 mb-6">
                {metodos.map((m) => (
                  <label key={m.id} className={`block rounded-lg border p-3 text-sm cursor-pointer transition-all ${Number(selectedBancoId)===Number(m.id) ? 'border-rose-500 bg-rose-500/10' : 'border-white/10 bg-black/20 hover:border-rose-400/50'}`}>
                    <div className="flex items-center gap-2">
                      <input type="radio" name="metodo" value={m.id} checked={Number(selectedBancoId) === Number(m.id)} onChange={() => {
                        setSelectedBancoId(Number(m.id));
                        // Determinar el tipo de método de pago según sus detalles
                        if (m.detalles?.titular && m.detalles?.numero_cuenta) {
                          // Si tiene titular y número de cuenta, es transferencia bancaria
                          setPaymentMode('transferencia');
                          // No limpiar el comprobante si ya estaba en modo transferencia
                          if (paymentMode !== 'transferencia') {
                            setComprobanteFile(null);
                          }
                        } else if (m.detalles?.storeId || m.tipo === 'gateway') {
                          // Si tiene storeId o es de tipo gateway, es Payphone
                          setPaymentMode('payphone');
                          // Limpiar comprobante si cambia a Payphone
                          setComprobanteFile(null);
                        }
                      }} />
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
                {metodos.length === 0 && <div className="text-sm text-slate-400">Pronto habilitaremos métodos disponibles…</div>}
              </div>
              {/* Si el método seleccionado es transferencia/deposito, mostrar comprobante */}
              {paymentMode === 'transferencia' && selectedBancoId && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Comprobante de pago</h3>
                    <label className="block cursor-pointer">
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => {
                        setComprobanteFile(e.target.files?.[0] || null);
                      }} />
                      <div className={`rounded-lg border-2 border-dashed p-6 text-center text-xs ${comprobanteFile ? 'border-emerald-500/60 bg-emerald-500/5 text-emerald-200' : 'border-white/15 bg-black/20 hover:border-rose-400/60 text-slate-300'} transition`}>
                        {comprobanteFile ? <>Archivo: <span className="font-medium">{comprobanteFile.name}</span></> : <>Click para subir (imagen o PDF)</>}
                      </div>
                    </label>
                    <p className="mt-2 text-[11px] text-slate-400">El equipo revisará tu comprobante y aprobará tus números.</p>
                  </div>
                  <div className="flex justify-between mt-4 gap-2 flex-wrap">
                    <button onClick={() => setStep(1)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Atrás</button>
                    <button disabled={!selectedBancoId || !comprobanteFile || !isVerified} onClick={crearOrdenTransferencia} className={`px-6 py-2 rounded-md font-semibold text-sm ${selectedBancoId && comprobanteFile && isVerified ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'} transition`}>Enviar orden</button>
                    <button type="button" onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Volver al sorteo</button>
                  </div>
                </div>
              )}
              {/* Si el método seleccionado es Payphone, mostrar botón cajita */}
              {paymentMode === 'payphone' && selectedBancoId && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-300">Al presionar el botón se abrirá la cajita de pagos de Payphone. Debes completar el pago para recibir la confirmación.</p>
                  <div className="flex gap-3 flex-wrap">
                    <button onClick={() => setStep(1)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Atrás</button>
                    <button disabled={!isVerified || payphoneLoading} onClick={iniciarPayphone} className={`px-6 py-2 rounded-md font-semibold text-sm ${isVerified && !payphoneLoading ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white/10 text-white/40'} transition`}>{payphoneLoading ? 'Preparando…' : 'Pagar con Payphone'}</button>
                    {payphoneOrdenId && (
                      <button type="button" onClick={cancelarPayphone} className="px-5 py-2 rounded-md bg-rose-700/30 hover:bg-rose-700/50 text-rose-200 text-sm">Cancelar pago</button>
                    )}
                    <button type="button" onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Volver al sorteo</button>
                  </div>
                  {payphoneMsg && <div className="text-xs text-emerald-300">{payphoneMsg}</div>}
                  <p className="text-[10px] text-slate-500">Si tu pago es aprobado serás redirigido automáticamente y recibirás un correo de confirmación.</p>
                </div>
              )}
            </div>
            <ResumenCompra paquete={paqueteSeleccionado} cantidad={cantidad} monto={monto} precioSinPromo={precioSinPromo} conteos={conteos} />
          </section>
        )}

        {step === 3 && (
          <section className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-6 rounded-xl border border-white/10 bg-white/5">
              <h2 className="text-lg font-semibold mb-4">Resultado (Paso 3)</h2>
              {result?.modo === 'transferencia' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-100 text-sm">
                    Tu orden <span className="font-semibold">{result.codigo}</span> fue recibida y está <span className="font-semibold">pendiente de revisión</span>. Te notificaremos por correo cuando sea aprobada y se asignen tus números.
                  </div>
                  <button onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm">Volver al sorteo</button>
                </div>
              )}
              {result?.modo === 'payphone' && result.estado === 'aprobado' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-100 text-sm">
                    Pago aprobado. Orden <span className="font-semibold">{result.codigo}</span> confirmada. Recibirás un correo con tus números y factura.
                  </div>
                  <button onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Volver al sorteo</button>
                </div>
              )}
              {result?.modo === 'payphone' && result.estado === 'pendiente' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-100 text-sm animate-pulse">
                    Estamos confirmando tu pago con Payphone. Esto puede tardar unos segundos...
                  </div>
                  <button onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Volver al sorteo</button>
                </div>
              )}
        {result?.modo === 'payphone' && result.estado === 'fallido' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-100 text-sm">
                    El pago no se completó {result.reason && `(motivo: ${result.reason})`}. Puedes intentar nuevamente.
                  </div>
          <button onClick={retryPayphone} className="px-5 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm">Intentar otra vez</button>
                </div>
              )}
              {!result && (
                <div className="text-sm text-slate-300">No hay resultado disponible. Regresa al paso anterior.</div>
              )}
            </div>
            <ResumenCompra paquete={paqueteSeleccionado} cantidad={cantidad} monto={monto} precioSinPromo={precioSinPromo} conteos={conteos} />
          </section>
        )}
      </div>
    </main>
  );
}

function ResumenCompra({ paquete, cantidad, monto, precioSinPromo, conteos }: any) {
  return (
    <aside className="p-5 rounded-xl border border-white/10 bg-white/5 h-max">
      <h3 className="text-sm font-semibold mb-3">Resumen</h3>
      {paquete ? (
        <div className="space-y-2 text-sm">
          <div className="font-medium text-slate-200">Promoción: {paquete.nombre || `${paquete.cantidad_numeros} tickets`}</div>
          <div className="text-xs text-slate-400">Incluye {paquete.cantidad_numeros} tickets</div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="font-medium text-slate-200">Compra por cantidad</div>
          <div className="text-xs text-slate-400">{cantidad} tickets</div>
        </div>
      )}
      <div className="mt-4 border-t border-white/10 pt-3 text-sm space-y-1">
        {paquete && <div className="text-xs text-slate-400 line-through">${precioSinPromo.toFixed(2)}</div>}
        <div className="text-lg font-bold text-white">${monto.toFixed(2)}</div>
        {conteos && (
          <div className="text-[11px] text-slate-400">Disponibles: {conteos.disponibles}</div>
        )}
      </div>
      <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">Los números se asignarán únicamente cuando el pago sea aprobado (Payphone) o validado por un administrador (transferencia).</p>
    </aside>
  );
}
