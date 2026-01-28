import './globals.css'

export const metadata = {
  title: 'Generatore Report ADM | Rilevazioni Gioco Fisico',
  description: 'Genera automaticamente i report PDF per le rilevazioni sul Gioco Fisico ai fini del controllo dei Livelli di Servizio ADM',
  keywords: 'ADM, report, gioco fisico, scommesse, PDF generator',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  )
}
