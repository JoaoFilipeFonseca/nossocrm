import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { InstallBanner } from '@/components/pwa/InstallBanner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Foco Imo',
  description: 'CRM Inteligente para Gestão de Vendas',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
}

/**
 * Componente React `RootLayout`.
 *
 * @param {{ children: ReactNode; }} {
  children,
} - Parâmetro `{
  children,
}`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: necessário porque a classe "dark" é aplicada no servidor mas pode ser sobrescrita pela preferência guardada no cliente
    <html lang="pt-PT" className="dark" suppressHydrationWarning>
      <head>
        {/* Aplica a preferência de tema ANTES do primeiro paint, para não
            haver flash escuro→claro num utilizador em modo claro. A classe é
            reconciliada depois pelo ThemeProvider. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=localStorage.getItem('crm_dark_mode');var e=document.documentElement;if(d==='false'){e.classList.remove('dark')}else{e.classList.add('dark')}}catch(e){}",
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-[var(--color-bg)] text-[var(--color-text-primary)]`}>
        <ServiceWorkerRegister />
        <InstallBanner />
        {children}
      </body>
    </html>
  )
}
