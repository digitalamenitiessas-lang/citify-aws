import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import { Navbar } from '@/components/navbar'
import { Providers } from '@/components/providers'
import { PwaInit } from '@/components/pwa/pwa-init'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const iconVersion = '20260505'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-poppins',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6efe5' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1410' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CITIFY | Comunidad, beneficios y gestión para edificios',
    template: '%s | CITIFY',
  },
  description:
    'CITIFY conecta vecinos, comercios, administraciones y consorcios en una sola experiencia: promociones, comunidad y gestión del edificio.',
  applicationName: 'CITIFY',
  keywords: [
    'citify',
    'consorcios',
    'edificios',
    'vecinos',
    'promociones',
    'comercios',
    'administracion de edificios',
    'comunidad',
    'propietarios',
  ],
  authors: [{ name: 'Digital Amenities' }],
  creator: 'Digital Amenities',
  publisher: 'Digital Amenities',
  category: 'technology',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: '/',
    siteName: 'CITIFY',
    title: 'CITIFY | Comunidad, beneficios y gestión para edificios',
    description:
      'Un ecosistema para conectar vecinos, comercios y consorcios con beneficios, comunicación y operación diaria del edificio.',
    images: [
      {
        url: '/citify-logo.png',
        width: 1200,
        height: 1200,
        alt: 'CITIFY',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CITIFY | Comunidad, beneficios y gestión para edificios',
    description:
      'Promociones, comunidad y administración del edificio en una experiencia simple, moderna y conectada.',
    images: ['/citify-logo.png'],
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: `/favicon-16x16.png?v=${iconVersion}`, sizes: '16x16', type: 'image/png' },
      { url: `/favicon-32x32.png?v=${iconVersion}`, sizes: '32x32', type: 'image/png' },
      { url: `/icon-192x192.png?v=${iconVersion}`, sizes: '192x192', type: 'image/png' },
      { url: `/icon-512x512.png?v=${iconVersion}`, sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: `/icon-192x192.png?v=${iconVersion}`, sizes: '192x192', type: 'image/png' }],
    shortcut: [`/favicon-32x32.png?v=${iconVersion}`],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CITIFY',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark bg-background" suppressHydrationWarning>
      <body className={`${poppins.variable} font-sans antialiased`}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
        <PwaInit />
      </body>
    </html>
  )
}
