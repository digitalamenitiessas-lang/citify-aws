import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Navbar } from '@/components/navbar'
import { Providers } from '@/components/providers'
import { PwaInit } from '@/components/pwa/pwa-init'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#B85C38',
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
  icons: {
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="bg-background" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
        <PwaInit />
      </body>
    </html>
  )
}
