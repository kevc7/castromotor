// Centralized email templating utilities.
// Brand palette (extracted from logo): pink/rose #f31260, dark bg #0f1725, accent emerald #10b981, slate grays.

export interface PremioGanadoItem { numero: string; premio: string; }

interface BaseData {
  year?: number;
  logoUrl?: string | null;
}

interface AprobacionData extends BaseData {
  clienteNombre: string;
  codigo: string;
  sorteoNombre?: string;
  numeros: string[]; // already formatted like ['#0123', '#0456']
  metodoPago?: string;
  monto?: string;
}

interface RechazoData extends BaseData {
  clienteNombre: string;
  codigo: string;
  sorteoNombre?: string;
  motivo?: string;
}

interface VerificacionData extends BaseData {
  codigo: string;
  minutos: number;
}

interface GanadorData extends BaseData {
  clienteNombre: string;
  codigo: string;
  sorteoNombre?: string;
  premios: PremioGanadoItem[];
  linkSorteo?: string;
}

const palette = {
  bg: '#0f1725',
  panel: '#111c2b',
  border: '#1e2d42',
  accent: '#f31260',
  accentSoft: '#f3126033',
  success: '#10b981',
  text: '#ffffff',
  sub: '#94a3b8'
};

function layout(inner: string, opts: { title?: string; logoUrl?: string | null; year?: number }) {
  return `<!DOCTYPE html><html lang='es'><head><meta charSet='utf-8' /><title>${opts.title || ''}</title></head>
  <body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:${palette.bg};padding:32px;color:${palette.text};">
  <div style="max-width:640px;margin:0 auto;background:${palette.panel};border:1px solid ${palette.border};border-radius:20px;padding:34px 38px;">
    ${opts.logoUrl ? `<div style='text-align:center;margin-bottom:26px;'>
      <img src='${opts.logoUrl}' alt='Logo' style='max-width:160px;height:auto;display:inline-block' />
    </div>` : ''}
    ${inner}
    <hr style="margin:32px 0;border:none;border-top:1px solid ${palette.border}" />
    <p style="margin:0;font-size:11px;color:${palette.sub};text-align:center">© ${opts.year || new Date().getFullYear()} Sorteos. Todos los derechos reservados.</p>
  </div>
  </body></html>`;
}

export function correoAprobacion(data: AprobacionData) {
  const list = data.numeros.map(n => `<span style='display:inline-block;background:${palette.accentSoft};color:${palette.accent};padding:6px 10px;border-radius:8px;font-weight:600;font-size:14px;margin:4px 6px 0 0;'>${n}</span>`).join('');
  return layout(`
    <h1 style='margin:0 0 14px;font-size:24px;letter-spacing:-0.5px;'>Orden aprobada ✅</h1>
    <p style='margin:0 0 12px;font-size:15px;line-height:1.5'>Hola <strong>${data.clienteNombre}</strong>, tu orden <strong>${data.codigo}</strong> ha sido aprobada.</p>
    <p style='margin:0 0 16px;font-size:14px;color:${palette.sub}'>Sorteo: <strong style='color:${palette.text}'>${data.sorteoNombre || ''}</strong><br/>Método de pago: ${data.metodoPago || '-'}${data.monto ? `<br/>Monto: ${data.monto}` : ''}</p>
    <div style='margin:6px 0 14px;'>${list}</div>
    <p style='margin:0 0 8px;font-size:12px;color:${palette.sub}'>Conserva este correo como comprobante.</p>
  `, { title: 'Orden aprobada', logoUrl: data.logoUrl, year: data.year });
}

export function correoRechazo(data: RechazoData) {
  return layout(`
    <h1 style='margin:0 0 14px;font-size:24px;color:${palette.accent};'>Orden rechazada</h1>
    <p style='margin:0 0 12px;font-size:15px;'>Hola <strong>${data.clienteNombre}</strong>, tu orden <strong>${data.codigo}</strong> fue rechazada.</p>
    <p style='margin:0 0 16px;font-size:14px;color:${palette.sub}'>Sorteo: <strong style='color:${palette.text}'>${data.sorteoNombre || ''}</strong></p>
    ${data.motivo ? `<p style='margin:0 0 16px;font-size:14px;'>Motivo: <em>${data.motivo}</em></p>` : ''}
    <p style='margin:0 0 8px;font-size:12px;color:${palette.sub}'>Puedes intentar nuevamente realizando el pago correcto.</p>
  `, { title: 'Orden rechazada', logoUrl: data.logoUrl, year: data.year });
}

export function correoVerificacion(data: VerificacionData) {
  return layout(`
    <h1 style='margin:0 0 16px;font-size:24px;'>Verifica tu correo</h1>
    <p style='margin:0 0 12px;font-size:15px;'>Tu código de verificación es:</p>
    <div style='display:inline-block;background:${palette.accent};color:#fff;padding:14px 26px;font-size:30px;font-weight:700;letter-spacing:4px;border-radius:14px;margin:0 0 18px;'>${data.codigo}</div>
    <p style='margin:0 0 10px;font-size:13px;color:${palette.sub}'>Válido por ${data.minutos} minutos.</p>
  `, { title: 'Código de verificación', logoUrl: data.logoUrl, year: data.year });
}

export function correoGanador(data: GanadorData) {
  const items = data.premios.map(p => `<tr><td style='padding:8px 12px;border:1px solid ${palette.border};font-size:14px;'>#${p.numero}</td><td style='padding:8px 12px;border:1px solid ${palette.border};font-size:14px;color:${palette.success};font-weight:600;'>${p.premio}</td></tr>`).join('');
  return layout(`
    <h1 style='margin:0 0 14px;font-size:24px;color:${palette.success};'>¡Felicidades!</h1>
    <p style='margin:0 0 14px;font-size:15px;'>Hola <strong>${data.clienteNombre}</strong>, ha${data.premios.length>1?'s':''} ganado ${data.premios.length>1?'premios':'un premio'} en el sorteo <strong>${data.sorteoNombre||''}</strong>.</p>
    <table style='border-collapse:collapse;margin:8px 0 18px;'>
      <thead><tr><th style='text-align:left;padding:8px 12px;border:1px solid ${palette.border};background:${palette.accentSoft};font-size:13px;'>Número</th><th style='text-align:left;padding:8px 12px;border:1px solid ${palette.border};background:${palette.accentSoft};font-size:13px;'>Premio</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    ${data.linkSorteo ? `<p style='margin:0 0 16px;font-size:13px;'><a href='${data.linkSorteo}' style='color:${palette.accent};text-decoration:none;font-weight:600;'>Ver sorteo</a></p>`:''}
    <p style='margin:0 0 8px;font-size:12px;color:${palette.sub}'>Nos pondremos en contacto para coordinar la entrega.</p>
  `, { title: 'Premio ganado', logoUrl: data.logoUrl, year: data.year });
}

export function correoOrdenRecibida(data: { clienteNombre: string; codigo: string; sorteoNombre?: string; cantidad?: number; monto?: string; metodoPago?: string; logoUrl?: string|null; year?: number; }) {
  return layout(`
    <h1 style='margin:0 0 14px;font-size:24px;'>Orden recibida</h1>
    <p style='margin:0 0 12px;font-size:15px;'>Hola <strong>${data.clienteNombre}</strong>, hemos recibido tu orden <strong>${data.codigo}</strong>.</p>
    <p style='margin:0 0 16px;font-size:14px;color:${palette.sub}'>Estado inicial: <span style='color:${palette.accent};font-weight:600;'>Pendiente de revisión</span></p>
    <div style='background:${palette.accentSoft};border:1px solid ${palette.border};padding:14px 16px;border-radius:12px;font-size:13px;line-height:1.5;margin:0 0 18px;'>
      <div><strong>Sorteo:</strong> ${data.sorteoNombre || ''}</div>
      ${data.cantidad!==undefined ? `<div><strong>Tickets:</strong> ${data.cantidad}</div>`:''}
      ${data.monto ? `<div><strong>Total:</strong> ${data.monto}</div>`:''}
      ${data.metodoPago ? `<div><strong>Método de pago:</strong> ${data.metodoPago}</div>`:''}
    </div>
    <p style='margin:0 0 10px;font-size:12px;color:${palette.sub}'>Te avisaremos por correo cuando sea aprobada o rechazada.</p>
  `, { title: 'Orden recibida', logoUrl: data.logoUrl, year: data.year });
}

export function plainList(items: string[]) {
  return items.map(i => `- ${i}`).join('\n');
}

// Nueva plantilla: cancelación por usuario
export function correoCancelacion(data: { clienteNombre: string; codigo: string; sorteoNombre?: string; motivo?: string; logoUrl?: string|null; year?: number; }) {
  return layout(`
    <h1 style='margin:0 0 14px;font-size:24px;color:${palette.accent};'>Orden cancelada</h1>
    <p style='margin:0 0 12px;font-size:15px;'>Hola <strong>${data.clienteNombre}</strong>, tu orden <strong>${data.codigo}</strong> fue cancelada correctamente.</p>
    ${data.sorteoNombre ? `<p style='margin:0 0 12px;font-size:14px;color:${palette.sub}'>Sorteo: <strong style='color:${palette.text}'>${data.sorteoNombre}</strong></p>` : ''}
    ${data.motivo ? `<p style='margin:0 0 16px;font-size:13px;'>Motivo: <em>${data.motivo}</em></p>` : ''}
    <p style='margin:0 0 8px;font-size:12px;color:${palette.sub}'>Puedes volver a intentar tu compra cuando desees.</p>
  `, { title: 'Orden cancelada', logoUrl: data.logoUrl, year: data.year });
}
