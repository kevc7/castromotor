import nodemailer from 'nodemailer';

export function createTransport() {
  const env = process.env as Record<string, string>;
  const host = env.SMTP_HOST;
  const port = Number(env.SMTP_PORT || 465);
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string; attachments?: { filename: string; path: string }[] }) {
  const transporter = createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await transporter.verify();
  } catch {}
  try {
    return await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });
  } catch (err) {
    const env = process.env as Record<string, string>;
    // Fallback automático a 587 STARTTLS si el puerto actual no es 587
    if (Number(env.SMTP_PORT || 0) !== 587) {
      try {
        const alt = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: 587,
          secure: false,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        });
        return await alt.sendMail({
          from,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
          attachments: opts.attachments,
        });
      } catch (second) {
        // Segundo fallback: Gmail si se configuró
        try {
          const gUser = env.SMTP_GMAIL_USER || env.GMAIL_USER;
          const gPass = (env.SMTP_GMAIL_PASS || env.GMAIL_PASS || '').replace(/\s+/g, '');
          if (gUser && gPass) {
            const gmail = nodemailer.createTransport({
              host: 'smtp.gmail.com',
              port: 587,
              secure: false,
              auth: { user: gUser, pass: gPass },
            });
            return await gmail.sendMail({
              from: gUser,
              to: opts.to,
              subject: opts.subject,
              html: opts.html,
              text: opts.text,
              attachments: opts.attachments,
            });
          }
        } catch (gerr) {
          console.error('SMTP send failed (primary, 587 fallback, gmail):', err, second, gerr);
          throw gerr;
        }
        console.error('SMTP send failed (primary & 587 fallback), no gmail fallback configured:', err, second);
        throw second;
      }
    }
    // Fallback Gmail también cuando ya veníamos usando 587
    try {
      const gUser = env.SMTP_GMAIL_USER || env.GMAIL_USER;
      const gPass = (env.SMTP_GMAIL_PASS || env.GMAIL_PASS || '').replace(/\s+/g, '');
      if (gUser && gPass) {
        const gmail = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: gUser, pass: gPass },
        });
        return await gmail.sendMail({
          from: gUser,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
          attachments: opts.attachments,
        });
      }
    } catch (gerr) {
      console.error('SMTP send failed (primary on 587, gmail):', err, gerr);
      throw gerr;
    }
    console.error('SMTP send failed and no gmail fallback configured:', err);
    throw err;
  }
}


