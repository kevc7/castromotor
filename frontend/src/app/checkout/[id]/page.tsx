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
  const [showPayphoneInline, setShowPayphoneInline] = useState(false);

  // Estados de animaciones de carga
  const [loadingStates, setLoadingStates] = useState({
    sendingCode: false,
    verifying: false,
    creatingOrder: false,
    initializingPayphone: false
  });

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
      setLoadingStates(prev => ({ ...prev, sendingCode: true }));
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
    } finally { 
      setSendingCode(false);
      setLoadingStates(prev => ({ ...prev, sendingCode: false }));
    }
  }

  async function verificarCodigo() {
    try {
      if (isVerified) return;
      if (!verificationId || verificationCode.length !== 3) throw new Error('Ingresa el código de 3 dígitos');
      setVerifying(true);
      setLoadingStates(prev => ({ ...prev, verifying: true }));
      const res = await fetch(`${API_BASE}/api/verificaciones/verificar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verification_id: verificationId, codigo: verificationCode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Código inválido');
      setIsVerified(true);
      setVerifMsg('Código verificado');
    } catch (err: any) { setVerifMsg(err?.message || 'Error verificando'); setIsVerified(false); }
    finally { 
      setVerifying(false);
      setLoadingStates(prev => ({ ...prev, verifying: false }));
    }
  }

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const canNextFromStep1 = isVerified && Object.keys(errors).length === 0 && acceptedTerms;
  const bancos = useMemo(() => metodos.filter(m => (m.nombre || '').toLowerCase() !== 'payphone' && (m.tipo || '').includes('transfer')), [metodos]);
  const metodoPayphoneDisponible = metodos.some(m => (m.nombre || '').toLowerCase() === 'payphone');

  async function crearOrdenTransferencia() {
    try {
      setAlert(null);
      setLoadingStates(prev => ({ ...prev, creatingOrder: true }));
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
    } finally {
      setLoadingStates(prev => ({ ...prev, creatingOrder: false }));
    }
  }

  async function iniciarPayphone() {
    try {
      setAlert(null);
      // Verificar que estamos en modo payphone
      if (paymentMode !== 'payphone') throw new Error('Método de pago no es Payphone');
      if (!metodoPayphoneDisponible) throw new Error('Payphone no disponible');
      if (!isVerified) throw new Error('Verifica tu correo primero');
      setPayphoneLoading(true); 
      setPayphoneMsg('Preparando pago con Payphone...');
      setLoadingStates(prev => ({ ...prev, initializingPayphone: true }));
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
          // Intentar primero modo embebido en la página
          setShowPayphoneInline(true);
          await new Promise(r => setTimeout(r, 0));
          const inlineContainer = document.getElementById('pp-inline');
          if (inlineContainer) {
            inlineContainer.innerHTML = '';
            const ppb = new (window as any).PPaymentButtonBox(d.payphoneConfig);
            ppb.render('pp-inline');
            setPayphoneMsg('✔ Cajita embebida lista. Completa el pago.');
            return; // No usar overlay si ya se pudo embebido
          }

          // Fallback: Overlay + contenedor interno, con botón de cierre mejorado
          let overlay = document.getElementById('pp-overlay');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pp-overlay';
            Object.assign(overlay.style, {
              position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: '99999', padding: '20px', boxSizing: 'border-box',
              backdropFilter: 'blur(4px)', animation: 'fadeIn 0.3s ease-out'
            } as CSSStyleDeclaration);
            
            // Añadir CSS de animación si no existe
            if (!document.getElementById('payphone-animations')) {
              const style = document.createElement('style');
              style.id = 'payphone-animations';
              style.textContent = `
                @keyframes fadeIn {
                  from { opacity: 0; transform: scale(0.95); }
                  to { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeOut {
                  from { opacity: 1; transform: scale(1); }
                  to { opacity: 0; transform: scale(0.95); }
                }
                .pp-fade-out {
                  animation: fadeOut 0.2s ease-in forwards;
                }
              `;
              document.head.appendChild(style);
            }
            
            document.body.appendChild(overlay);
            
            // Prevenir scroll del body cuando el modal está abierto
            document.body.style.overflow = 'hidden';
          } else {
            overlay.innerHTML = '';
          }
          
          // Contenedor principal donde Payphone inyectará su UI
          const inner = document.createElement('div');
          inner.id = 'pp-box';
          Object.assign(inner.style, {
            width: '100%', maxWidth: '640px', background: '#fff', borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden', position: 'relative',
            animation: 'fadeIn 0.3s ease-out'
          } as CSSStyleDeclaration);
          
          // Header del modal con título y botón de cierre
          const header = document.createElement('div');
          Object.assign(header.style, {
            position: 'relative', background: 'linear-gradient(135deg, #1e293b, #334155)', 
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          } as CSSStyleDeclaration);
          
          const title = document.createElement('h3');
          title.textContent = 'Completar pago con Payphone';
          Object.assign(title.style, {
            margin: '0', color: '#fff', fontSize: '18px', fontWeight: '600'
          } as CSSStyleDeclaration);
          
          const closeBtn = document.createElement('button');
          closeBtn.type = 'button';
          closeBtn.innerHTML = '✕';
          closeBtn.title = 'Cerrar y cancelar pago';
          Object.assign(closeBtn.style, {
            background: 'rgba(239, 68, 68, 0.8)', color: '#fff', border: 'none', 
            borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold',
            width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease', outline: 'none'
          } as CSSStyleDeclaration);
          
          closeBtn.onmouseenter = () => { 
            closeBtn.style.background = 'rgba(239, 68, 68, 1)'; 
            closeBtn.style.transform = 'scale(1.05)';
          };
          closeBtn.onmouseleave = () => { 
            closeBtn.style.background = 'rgba(239, 68, 68, 0.8)'; 
            closeBtn.style.transform = 'scale(1)';
          };
          closeBtn.onclick = (e) => { 
            e.preventDefault();
            e.stopPropagation();
            cancelarPayphone(); 
          };
          
          header.appendChild(title);
          header.appendChild(closeBtn);
          inner.appendChild(header);
          
          // Contenedor para el contenido de Payphone
          const content = document.createElement('div');
          content.id = 'pp-content';
          Object.assign(content.style, {
            minHeight: '400px', background: '#fff'
          } as CSSStyleDeclaration);
          inner.appendChild(content);
          
          overlay.appendChild(inner);
          
          // Cerrar al hacer clic en el overlay (fuera del modal)
          overlay.onclick = (e) => {
            if (e.target === overlay) {
              cancelarPayphone();
            }
          };
          
          // Cerrar con tecla ESC
          const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              cancelarPayphone();
            }
          };
          document.addEventListener('keydown', handleEscape);
          
          // Guardar función de limpieza
          (overlay as any).cleanup = () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
          };
          
          const ppb = new (window as any).PPaymentButtonBox(d.payphoneConfig);
          ppb.render('pp-content');
          setPayphoneMsg('✔ Cajita abierta. Completa el pago o cierra para cancelar.');
        } else throw new Error('SDK Payphone no cargado');
      }
    } catch (err: any) {
      setPayphoneMsg(null);
      setAlert({ type: 'error', msg: err?.message || 'Error Payphone' });
    } finally { 
      setPayphoneLoading(false);
      setLoadingStates(prev => ({ ...prev, initializingPayphone: false }));
    }
  }

  async function cancelarPayphone() {
    try {
      setAlert(null);
      setPayphoneMsg('Cancelando pago...');
      // Limpiar modo embebido si está activo
      setShowPayphoneInline(false);
      const inline = document.getElementById('pp-inline');
      if (inline) inline.innerHTML = '';
      
      const overlay = document.getElementById('pp-overlay');
      if (overlay) {
        // Añadir animación de cierre
        overlay.classList.add('pp-fade-out');
        
        // Ejecutar función de limpieza si existe
        if ((overlay as any).cleanup) {
          (overlay as any).cleanup();
        }
        
        // Remover después de la animación
        setTimeout(() => {
          overlay.remove();
          document.body.style.overflow = ''; // Restaurar scroll
        }, 200);
      }
      
      // Cancelar orden en el backend si existe
      if (payphoneOrdenId) {
        const resp = await fetch(`${API_BASE}/api/orders/${payphoneOrdenId}/cancel`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'cancelado_usuario' })
        });
        
        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data?.error || 'No se pudo cancelar la orden');
        }
        
        const data = await resp.json();
        
        // Mostrar resultado de cancelación exitosa
        setResult({ 
          modo: 'payphone', 
          estado: 'cancelado', 
          reason: 'cancelado_usuario',
          mensaje: 'Pago cancelado. Los números han sido liberados y están disponibles nuevamente.'
        });
      setStep(3);
        setPayphoneMsg(null);
        setPayphoneOrdenId(null);
        
        // Limpiar estados de Payphone
        setPaymentMode(null);
        setSelectedBancoId(null);
      } else {
        // Si no hay orden ID, simplemente volver al paso 2
        setPayphoneMsg(null);
        setPayphoneOrdenId(null);
        setPaymentMode(null);
        setSelectedBancoId(null);
        setAlert({ type: 'info', msg: 'Pago cancelado. Puedes elegir otro método de pago.' });
      }
    } catch (e: any) {
      console.error('Error cancelando Payphone:', e);
      setPayphoneMsg(null);
      setAlert({ type: 'error', msg: e?.message || 'Error cancelando el pago' });
      
      // Asegurar que el modal se cierre incluso si hay error
      const overlay = document.getElementById('pp-overlay');
      if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
      }
    }
  }

  function retryPayphone() {
    // Elimina overlay residual
    const overlay = document.getElementById('pp-overlay');
    if (overlay) overlay.remove();
    // Limpiar inline
    const inline = document.getElementById('pp-inline');
    if (inline) inline.innerHTML = '';
    setShowPayphoneInline(false);
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
      <div className="mb-8 checkout-step-indicator">
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
        // Si la razón es cancelación y tenemos ordenId, intentar cancelar automáticamente
        if ((reason === 'cancelado_usuario' || reason === 'canceled' || reason === 'cancelled') && ordenId) {
          (async () => {
            try {
              await fetch(`${API_BASE}/api/orders/${ordenId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            } catch {}
          })();
        }
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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white client-surface">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
            <p className="text-slate-400">Completa tu compra paso a paso</p>
          </div>
        <StepIndicator />
        {alert && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${alert.type === 'error' ? 'bg-rose-600/20 border border-rose-500/40 text-rose-200' : alert.type === 'success' ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-200' : 'bg-blue-600/20 border border-blue-500/40 text-blue-200'}`}>{alert.msg}</div>}

        {step === 1 && (
          <section className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-5 rounded-xl border border-white/10 bg-white/5">
              <h2 className="text-lg font-semibold mb-4">Tus datos (Paso 1)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombres */}
                <label className="grid gap-1">
                  <span className="text-xs text-slate-400 capitalize checkout-label">nombres</span>
                  <input className={`border rounded-md px-3 py-2 bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40 checkout-input ${errors.nombres ? 'ring-rose-500/40 border-rose-500/50' : ''}`} value={cliente.nombres} onChange={e => setCliente(c => ({ ...c, nombres: e.target.value }))} />
                  {errors.nombres && <span className="text-[11px] text-rose-400 checkout-error-text">{errors.nombres}</span>}
                </label>

                {/* Apellidos */}
                <label className="grid gap-1">
                  <span className="text-xs text-slate-400 capitalize checkout-label">apellidos</span>
                  <input className={`border rounded-md px-3 py-2 bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40 checkout-input ${errors.apellidos ? 'ring-rose-500/40 border-rose-500/50' : ''}`} value={cliente.apellidos} onChange={e => setCliente(c => ({ ...c, apellidos: e.target.value }))} />
                  {errors.apellidos && <span className="text-[11px] text-rose-400 checkout-error-text">{errors.apellidos}</span>}
                </label>

                {/* Número de cédula */}
                <label className="grid gap-1">
                  <span className="text-xs text-slate-400 capitalize checkout-label">Número de cédula</span>
                  <input 
                    inputMode="numeric"
                    pattern="\\d{10}"
                    maxLength={10}
                    placeholder="10 dígitos"
                    className={`border rounded-md px-3 py-2 bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40 checkout-input ${errors.cedula ? 'ring-rose-500/40 border-rose-500/50' : ''}`}
                    value={cliente.cedula}
                    onChange={e => {
                      const onlyDigits = e.target.value.replace(/[^0-9]/g, '').slice(0,10);
                      setCliente(c => ({ ...c, cedula: onlyDigits }));
                    }}
                  />
                  {errors.cedula && <span className="text-[11px] text-rose-400 checkout-error-text">{errors.cedula}</span>}
                  </label>

                {/* Teléfono */}
                <label className="grid gap-1">
                  <span className="text-xs text-slate-400 capitalize checkout-label">teléfono</span>
                  <div className="flex items-center border rounded-md bg-black/30 border-white/10 focus-within:ring-2 focus-within:ring-rose-500/40">
                    <span className="pl-3 pr-1 text-slate-300 select-none">+593</span>
                    <input
                      inputMode="numeric"
                      pattern="\\d{9}"
                      maxLength={9}
                      placeholder="9 dígitos"
                      className="flex-1 bg-transparent outline-none text-white py-2 pr-3 checkout-input"
                      value={cliente.telefono}
                      onChange={e => {
                        const onlyDigits = e.target.value.replace(/[^0-9]/g, '').slice(0,9);
                        setCliente(c => ({ ...c, telefono: onlyDigits }));
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 checkout-help-text">Ingresa solo los 9 dígitos. El código de país se agrega automáticamente.</span>
                  {errors.telefono && <span className="text-[11px] text-rose-400 checkout-error-text">{errors.telefono}</span>}
                </label>

                {/* Dirección */}
                <label className="grid gap-1">
                  <span className="text-xs text-slate-400 capitalize checkout-label">direccion</span>
                  <input className={`border rounded-md px-3 py-2 bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40 checkout-input ${errors.direccion ? 'ring-rose-500/40 border-rose-500/50' : ''}`} value={cliente.direccion} onChange={e => setCliente(c => ({ ...c, direccion: e.target.value }))} />
                  {errors.direccion && <span className="text-[11px] text-rose-400 checkout-error-text">{errors.direccion}</span>}
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-slate-400 checkout-label">Correo</span>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <input type="email" className={`flex-1 border rounded-md px-3 py-2 bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40 checkout-input ${errors.correo_electronico ? 'ring-rose-500/40 border-rose-500/50' : ''}`} value={cliente.correo_electronico} onChange={e => { setCliente(c => ({ ...c, correo_electronico: e.target.value })); setIsVerified(false); }} />
                    <button type="button" onClick={solicitarCodigo} disabled={sendingCode || !canResendCode || !!errors.correo_electronico} className={`px-4 py-2 rounded-md text-white text-sm font-medium btn-primary ${!canResendCode ? 'bg-gray-600 cursor-not-allowed' : sendingCode ? 'bg-rose-700/60 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'} transition-all duration-200 flex items-center justify-center gap-2`}>
                      {sendingCode && (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {sendingCode ? 'Enviando…' : !canResendCode ? <span className="countdown-timer" title="Podrás reenviar el código cuando el contador llegue a 0 (máx. 1 minuto)">Reenviar código en {resendCountdown}s</span> : 'Enviar código'}
                    </button>
                  </div>
                  {!canResendCode && (
                    <div className="text-[11px] text-slate-400 checkout-help-text mt-1">
                      Espera a que termine el contador para volver a reenviar el código. Revisa también SPAM o Promociones.
                    </div>
                  )}
                  {verifMsg && <span className={`text-[11px] ${isVerified ? 'text-emerald-400 verification-success' : 'text-amber-300 verification-pending'}`}>{verifMsg}{expiresAt && remaining>0 && ` (expira en ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')})`}</span>}
                </label>
                <label className="grid gap-1 w-full md:col-span-2">
                  <span className="text-xs text-slate-400 checkout-label">Código verificación</span>
                  <div className="flex gap-2">
                    <input maxLength={3} disabled={isVerified} value={verificationCode} onChange={e => !isVerified && setVerificationCode(e.target.value.replace(/\D/g,'').slice(0,3))} className={`flex-1 border rounded-md px-3 py-2 tracking-widest bg-black/30 text-white border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 checkout-input ${isVerified ? 'bg-emerald-900/30 text-emerald-300' : ''}`} placeholder="___" />
                    <button type="button" onClick={verificarCodigo} disabled={isVerified || !verificationId || verificationCode.length !== 3 || verifying} className={`px-4 py-2 rounded-md text-white text-sm font-medium btn-primary ${isVerified ? 'bg-emerald-700/60' : verifying ? 'bg-emerald-700/60' : 'bg-emerald-600 hover:bg-emerald-700'} transition-all duration-200 flex items-center gap-2`}>
                      {verifying && (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isVerified ? '✓ Verificado' : verifying ? 'Verificando…' : 'Verificar'}
                    </button>
                  </div>
                </label>
              </div>
              <div className="mt-4">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={acceptedTerms} onChange={(e)=> setAcceptedTerms(e.target.checked)} className="mt-1" />
                  <span>Acepto los <a href="/terminos-condiciones" target="_blank" className="underline text-rose-300 hover:text-rose-200">Términos y Condiciones</a>.</span>
                </label>
              </div>
              <div className="mt-6 flex justify-between gap-2">
                <button onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm btn-secondary">Volver al sorteo</button>
                <button disabled={!canNextFromStep1} onClick={() => setStep(2)} className={`px-6 py-2 rounded-md font-semibold text-sm btn-primary ${canNextFromStep1 ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'} transition`}>Continuar</button>
              </div>
            </div>
            <ResumenCompra paquete={paqueteSeleccionado} cantidad={cantidad} monto={monto} precioSinPromo={precioSinPromo} conteos={conteos} />
          </section>
        )}

        {step === 2 && (
          <section className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-5 rounded-xl border border-white/10 bg-white/5">
              <h2 className="text-lg font-semibold mb-4 checkout-section-header">Método de pago (Paso 2)</h2>
              <div className="grid gap-3 mb-6">
                {metodos.map((m) => (
                  <label key={m.id} className={`block rounded-lg border p-3 text-sm cursor-pointer transition-all payment-method-card ${Number(selectedBancoId)===Number(m.id) ? 'border-rose-500 bg-rose-500/10 selected' : 'border-white/10 bg-black/20 hover:border-rose-400/50'}`}>
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
                      <span className="font-medium">{(m.detalles?.storeId || m.tipo === 'gateway') ? 'Crédito/Débito' : m.nombre}</span>
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
              {/* Botón para volver al sorteo cuando no se ha seleccionado un método aún */}
              {!selectedBancoId && (
                <div className="mb-6">
                  <button type="button" onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm btn-secondary">Volver al sorteo</button>
                </div>
              )}
              {/* Si el método seleccionado es transferencia/deposito, mostrar comprobante */}
              {paymentMode === 'transferencia' && selectedBancoId && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Comprobante de pago</h3>
                    <label className="block cursor-pointer">
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => {
                        setComprobanteFile(e.target.files?.[0] || null);
                      }} />
                      <div className={`rounded-lg border-2 border-dashed p-6 text-center text-xs file-upload-area ${comprobanteFile ? 'border-emerald-500/60 bg-emerald-500/5 text-emerald-200 has-file' : 'border-white/15 bg-black/20 hover:border-rose-400/60 text-slate-300'} transition`}>
                        {comprobanteFile ? <>Archivo: <span className="font-medium">{comprobanteFile.name}</span></> : <>Click para subir (imagen o PDF)</>}
                      </div>
                    </label>
                    <p className="mt-2 text-[11px] text-slate-400 checkout-help-text">El equipo revisará tu comprobante y aprobará tus números.</p>
                  </div>
                  <div className="flex justify-between mt-4 gap-2 flex-wrap">
                    <button onClick={() => setStep(1)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm btn-secondary">Atrás</button>
                    <button disabled={!selectedBancoId || !comprobanteFile || !isVerified || loadingStates.creatingOrder} onClick={crearOrdenTransferencia} className={`px-6 py-2 rounded-md font-semibold text-sm btn-primary ${selectedBancoId && comprobanteFile && isVerified && !loadingStates.creatingOrder ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'} transition-all duration-200 flex items-center gap-2`}>
                      {loadingStates.creatingOrder && (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {loadingStates.creatingOrder ? 'Creando orden…' : 'Enviar orden'}
                    </button>
                    <button type="button" onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm btn-secondary">Volver al sorteo</button>
                  </div>
                </div>
              )}
              {/* Si el método seleccionado es Payphone, mostrar botón cajita */}
              {paymentMode === 'payphone' && selectedBancoId && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-300">Haz clic en el botón para ingresar tus datos de tarjeta (crédito/débito) y completar el pago de forma segura.</p>
                  <div className="flex gap-3 flex-wrap">
                    <button onClick={() => setStep(1)} className="px-5 py-2 rounded-md btn-surface text-sm">Atrás</button>
                    <button disabled={!isVerified || payphoneLoading || loadingStates.initializingPayphone} onClick={iniciarPayphone} className={`px-6 py-2 rounded-md font-semibold text-sm btn-primary ${isVerified && !payphoneLoading && !loadingStates.initializingPayphone ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white/10 text-white/40'} transition-all duration-200 flex items-center gap-2`}>
                      {(payphoneLoading || loadingStates.initializingPayphone) && (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {payphoneLoading || loadingStates.initializingPayphone ? 'Preparando…' : 'Click aquí para ingresar tus datos de tarjeta'}
                    </button>
                    {payphoneOrdenId && (
                      <button type="button" onClick={cancelarPayphone} className="px-5 py-2 rounded-md text-sm btn-surface">Cancelar pago</button>
                    )}
                    <button type="button" onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md text-sm btn-surface">Volver al sorteo</button>
                  </div>
                  {showPayphoneInline && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 payphone-inline-container">
                      <div id="pp-inline" />
                  </div>
                  )}
                  {payphoneMsg && <div className="text-xs text-emerald-600 [data-theme='dark']:text-emerald-300 checkout-success">{payphoneMsg}</div>}
                  <p className="text-[10px] text-slate-500 checkout-help-text">Si tu pago es aprobado serás redirigido automáticamente y recibirás un correo de confirmación.</p>
                </div>
              )}
            </div>
            <ResumenCompra paquete={paqueteSeleccionado} cantidad={cantidad} monto={monto} precioSinPromo={precioSinPromo} conteos={conteos} />
          </section>
        )}

        {step === 3 && (
          <section className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-6 rounded-xl border border-white/10 bg-white/5">
              <h2 className="text-lg font-semibold mb-4 checkout-section-header">Resultado (Paso 3)</h2>
              {result?.modo === 'transferencia' && (
                <div className="space-y-4">
                  <div className="alert alert-success text-sm checkout-success">
                    Tu orden <span className="font-semibold">{result.codigo}</span> fue recibida y está <span className="font-semibold">pendiente de revisión</span>. Te notificaremos por correo cuando sea aprobada y se asignen tus números.
                  </div>
                  <button onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md text-sm btn-secondary">Volver al sorteo</button>
                </div>
              )}
              {result?.modo === 'payphone' && result.estado === 'aprobado' && (
                <div className="space-y-4">
                  <div className="alert alert-success text-sm checkout-success">
                    Pago aprobado. Orden <span className="font-semibold">{result.codigo}</span> confirmada. Recibirás un correo con tus números y factura.
                  </div>
                  <button onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md text-sm btn-secondary">Volver al sorteo</button>
                </div>
              )}
              {result?.modo === 'payphone' && result.estado === 'pendiente' && (
                <div className="space-y-4">
                  <div className="alert alert-info text-sm animate-pulse checkout-info">
                    Estamos confirmando tu pago con Payphone. Esto puede tardar unos segundos...
                  </div>
                  <button onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md text-sm btn-secondary">Volver al sorteo</button>
                </div>
              )}
        {result?.modo === 'payphone' && result.estado === 'fallido' && (
                <div className="space-y-4">
                  <div className="alert alert-error text-sm checkout-error">
                    El pago no se completó {result.reason && `(motivo: ${result.reason})`}. Puedes intentar nuevamente.
                  </div>
                  <button onClick={retryPayphone} className="px-5 py-2 rounded-md text-sm btn-secondary">Intentar otra vez</button>
                </div>
              )}
              {result?.modo === 'payphone' && result.estado === 'cancelado' && (
                <div className="space-y-4">
                  <div className="alert alert-warn text-sm checkout-warning">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <strong>Pago cancelado</strong>
                    </div>
                    {result.mensaje || 'El pago fue cancelado por el usuario. Los números reservados han sido liberados y están disponibles nuevamente.'}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={retryPayphone} className="px-5 py-2 rounded-md text-sm btn-secondary">Intentar otra vez</button>
                    <button onClick={() => router.push(`/sorteos/${sorteoId}/info`)} className="px-5 py-2 rounded-md text-sm btn-secondary">Volver al sorteo</button>
                  </div>
                </div>
              )}
              {!result && (
                <div className="text-sm text-slate-700 [data-theme='dark']:text-slate-300">No hay resultado disponible. Regresa al paso anterior.</div>
              )}
            </div>
            <ResumenCompra paquete={paqueteSeleccionado} cantidad={cantidad} monto={monto} precioSinPromo={precioSinPromo} conteos={conteos} />
          </section>
        )}
      </div>
      </div>
    </main>
  );
}

function ResumenCompra({ paquete, cantidad, monto, precioSinPromo, conteos }: any) {
  return (
    <aside className="p-5 rounded-xl border border-white/10 bg-white/5 h-max checkout-summary">
      <h3 className="text-sm font-semibold mb-3">Resumen</h3>
      {paquete ? (
        <div className="space-y-2 text-sm">
          <div className="font-medium text-slate-200 summary-title">Promoción: {paquete.nombre || `${paquete.cantidad_numeros} tickets`}</div>
          <div className="text-xs text-slate-400">Incluye {paquete.cantidad_numeros} tickets</div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="font-medium text-slate-200 summary-title">Compra por cantidad</div>
          <div className="text-xs text-slate-400">{cantidad} tickets</div>
        </div>
      )}
      <div className="mt-4 border-t border-white/10 pt-3 text-sm space-y-1">
        {paquete && <div className="text-xs text-slate-400 line-through">${precioSinPromo.toFixed(2)}</div>}
        <div className="text-lg font-bold text-white price">${monto.toFixed(2)}</div>
      </div>
      <p className="mt-4 text-[11px] text-slate-500 leading-relaxed checkout-help-text">Los números se asignarán únicamente cuando el pago sea aprobado (Payphone) o validado por un administrador (transferencia).</p>
    </aside>
  );
}
