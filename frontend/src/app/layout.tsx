import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/fire-effects.css";
import Script from "next/script";
import ThemeToggle from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CASTROMOTOR SORTEOS | Rifas y Sorteos Online Ecuador",
    template: "%s | CASTROMOTOR SORTEOS"
  },
  description: "Participa en sorteos y rifas online con CASTROMOTOR. Premios increíbles, pagos seguros con Payphone y transferencias bancarias. ¡Compra tus números y gana en Ecuador!",
  keywords: [
    "sorteos", "rifas", "premios", "Ecuador", "castromotor", "sorteos online", 
    "rifas Ecuador", "pagos seguros", "payphone", "loteria", "concursos", 
    "premios Ecuador", "rifas online", "sorteos legales"
  ],
  authors: [{ name: "CASTROMOTOR" }],
  creator: "CASTROMOTOR",
  publisher: "CASTROMOTOR",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_EC',
    url: '/',
    title: 'CASTROMOTOR SORTEOS | Rifas y Sorteos Online Ecuador',
    description: 'Participa en sorteos y rifas online con CASTROMOTOR. Premios increíbles, pagos seguros con Payphone y transferencias bancarias.',
    siteName: 'CASTROMOTOR SORTEOS',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'CASTROMOTOR SORTEOS - Rifas y Sorteos Online Ecuador',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CASTROMOTOR SORTEOS | Rifas y Sorteos Online Ecuador',
    description: 'Participa en sorteos y rifas online con CASTROMOTOR. Premios increíbles, pagos seguros.',
    images: ['/logo.png'],
    creator: '@castromotor',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/favicon.png', sizes: '180x180' },
      { url: '/logo.png', sizes: '192x192' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/favicon.png',
        color: '#AA2F0B',
      },
    ],
  },
  manifest: '/manifest.json',
  // Meta requerida por Facebook / WhatsApp Business para verificar el dominio
  other: {
    'facebook-domain-verification': 'bj5dmzuins4o7texoptjewihp04ymd',
    'theme-color': '#AA2F0B',
    'color-scheme': 'dark light',
  },
  verification: {
    google: 'google-site-verification-code', // Reemplazar con código real de Google Search Console
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script src="https://pay.payphonetodoesposible.com/payphone-client/PayPhone.js" strategy="afterInteractive" />
  {/* Logo flotante removido según solicitud */}
        <ThemeToggle />
        {children}
        {/* Botón flotante de WhatsApp */}
        <a
          href="https://wa.me/593981309202"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar por WhatsApp"
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-white shadow-lg hover:brightness-110 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M20.52 3.48A11.94 11.94 0 0 0 12.05 0C5.43 0 .03 5.4.03 12.07c0 2.12.56 4.19 1.62 6.02L0 24l6.07-1.6a12.07 12.07 0 0 0 5.98 1.58h.01c6.63 0 12.02-5.4 12.02-12.07 0-3.21-1.25-6.23-3.56-8.43ZM12.06 22a10.04 10.04 0 0 1-5.1-1.4l-.37-.22-3.6.95.96-3.52-.24-.36a10.09 10.09 0 0 1-1.55-5.38C2.16 6.5 6.56 2.1 12.06 2.1c2.66 0 5.16 1.04 7.05 2.94a9.93 9.93 0 0 1 2.92 7.04C22.04 17.5 17.64 22 12.06 22Zm5.52-7.52c-.3-.15-1.76-.86-2.03-.96-.27-.1-.47-.15-.67.15-.2.3-.77.95-.95 1.14-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5-.17 0-.37-.02-.57-.02-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.06.15.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.08-.12-.27-.2-.57-.35Z"/>
          </svg>
          <span className="hidden sm:inline font-medium">Contáctanos</span>
        </a>
      </body>
    </html>
  );
}
