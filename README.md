# 🎰 Generatore Report ADM

Applicazione web per generare automaticamente i report PDF delle **Rilevazioni sul Gioco Fisico** ai fini del controllo dei Livelli di Servizio per ADM (Agenzia delle Dogane e dei Monopoli).

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![React](https://img.shields.io/badge/React-18-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Demo

[Link alla demo su Vercel] <!-- Aggiorna con il tuo URL -->

## ✨ Funzionalità

- **📊 Prestazioni Sistema** - Importa dati settimanali di giocate e genera tabelle mensili
- **📈 Disponibilità Sistema** - Supporta tutti i tipi di gioco (IP, QF, BIG, CPS, V7, IN)
- **🔧 Ripristino Sistema** - Traccia malfunzionamenti e tempi di risoluzione
- **📄 Generazione PDF** - Report completo conforme al formato ADM
- **🎨 UI Moderna** - Interfaccia responsive con Tailwind CSS

## 📁 Formato File Excel

### 1. Prestazioni Sistema (obbligatorio)
| Mese | Settimana | Giocate | Giocate emesse in più di 5 secondi | % |
|------|-----------|---------|-------------------------------------|---|
| 1 | 1 | 20944 | 43 | 99.79 |
| 1 | 2 | 28358 | 82 | 99.71 |
| ... | ... | ... | ... | ... |

### 2. Disponibilità Sistema (obbligatorio)
File con fogli multipli per tipo gioco:
- `Prestazioni QF`
- `Prestazioni BIG`
- `Prestazioni CPS`
- `Prestazioni IPPICA` (o `Prestazioni IP`)
- `Prestazioni PGDA` (o `Prestazioni IN`)
- `Prestazioni PSV` (o `Prestazioni V7`)

Ogni foglio contiene 12 mesi con colonne: `mese`, `giorno`, `disponibilità %`

### 3. Ripristino Sistema (opzionale)
| Data | Secondi |
|------|---------|
| 2025-12-25 06:45:32 | 10 |
| 2025-12-24 11:54:50 | 11 |
| ... | ... |

## 🛠️ Installazione Locale

```bash
# Clona il repository
git clone https://github.com/TUO-USERNAME/adm-report-generator.git

# Entra nella directory
cd adm-report-generator

# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

## 🚀 Deploy su Vercel

### Metodo 1: Deploy automatico
1. Fai fork di questo repository
2. Vai su [vercel.com](https://vercel.com)
3. Clicca "New Project"
4. Importa il repository da GitHub
5. Clicca "Deploy"

### Metodo 2: Vercel CLI
```bash
# Installa Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## 📦 Tecnologie Utilizzate

- **[Next.js 14](https://nextjs.org/)** - Framework React
- **[React 18](https://react.dev/)** - Libreria UI
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling
- **[jsPDF](https://github.com/parallax/jsPDF)** - Generazione PDF
- **[SheetJS](https://sheetjs.com/)** - Parsing Excel

## 📋 Struttura del Progetto

```
adm-report-generator/
├── src/
│   └── app/
│       ├── layout.js      # Layout principale
│       ├── page.js        # Componente principale
│       └── globals.css    # Stili globali
├── public/                # Asset statici
├── package.json           # Dipendenze
├── tailwind.config.js     # Configurazione Tailwind
├── next.config.js         # Configurazione Next.js
└── README.md              # Documentazione
```

## 🔧 Configurazione

Puoi personalizzare i valori di default del frontespizio modificando lo state iniziale in `src/app/page.js`:

```javascript
const [frontespizio, setFrontespizio] = useState({
  anno: '2025',
  dataConsegna: '28/01/2026',
  concessionario: 'La Tua Azienda',
  codiceConcessione: '12345',
  // ...
});
```

## 📄 Licenza

MIT License - vedi [LICENSE](LICENSE) per dettagli.

## 🤝 Contributi

I contributi sono benvenuti! Apri una issue o una pull request.

## 📧 Contatti

Per domande o supporto, apri una issue su GitHub.

---

Made with ❤️ for ADM compliance
