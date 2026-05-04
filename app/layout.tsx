import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import { Navbar } from '@/components/navbar'
import { Providers } from '@/components/providers'
import { PwaInit } from '@/components/pwa/pwa-init'
import './globals.css'

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
  themeColor: '#F04E23',
}

export const metadata: Metadata = {
  title: 'CITIFY - Mercado de Promociones de la Ciudad',
  description: 'Promociones y ofertas exclusivas para vecinos. Conectate con comercios locales y desbloquea beneficios premium.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Citify',
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
