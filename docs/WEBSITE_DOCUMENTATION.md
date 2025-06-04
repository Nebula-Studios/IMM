# InZOI Mod Manager - Website Documentation

## 🎮 Panoramica Applicazione

**InZOI Mod Manager** è un'applicazione desktop professionale sviluppata da **Nebula Studios** per la gestione avanzata dei mod del gioco InZOI. L'applicazione offre un'interfaccia utente moderna e intuitiva che semplifica drasticamente l'installazione, organizzazione e gestione dei mod.

### 📋 Informazioni Tecniche
- **Versione Attuale**: 1.0.5
- **Sviluppatore**: Nebula Studios
- **Licenza**: MIT
- **Repository**: https://github.com/Nebula-Studios/IMM
- **Piattaforme**: Windows, macOS, Linux (Electron-based)

---

## 🌟 Funzionalità Principali

### 🔧 Setup Automatizzato
- **Configurazione Guidata**: Al primo avvio, l'applicazione guida l'utente nella selezione della cartella di gioco InZOI
- **Verifica Compatibilità**: Controllo automatico della presenza dell'InZOI Mod Enabler
- **Installazione Assistita**: Assistenza nell'installazione dei componenti necessari per il funzionamento dei mod

### 📦 Gestione Mod Avanzata
- **Interfaccia Dual-Column**: Due colonne distinte per "Mod Disabilitati" e "Mod Abilitati"
- **Drag & Drop Intelligente**: 
  - Trascina file mod (`.pak`, `.zip`, `.rar`, `.7z`) direttamente nell'applicazione
  - Sposta mod tra colonne per abilitare/disabilitare istantaneamente
- **Rilevamento Automatico**: Identificazione automatica di file associati (`.ucas`, `.utoc`) per i file `.pak`
- **Supporto Multi-Formato**: Gestione completa di archivi compressi con estrazione automatica

### 🎯 Sistema di Load Order
- **Riorganizzazione Priorità**: Riordina i mod abilitati per controllare l'ordine di caricamento nel gioco
- **Numerazione Automatica**: Il sistema aggiorna automaticamente la numerazione delle cartelle mod per riflettere il nuovo ordine
- **Gestione Conflitti**: Prevenzione automatica dei conflitti tra mod con sistema di priorità

### 👥 Sistema Profili
- **Profili Multipli**: Crea, gestisci ed elimina profili personalizzati per diverse configurazioni di mod
- **Auto-Save**: Salvataggio automatico delle modifiche alla configurazione del profilo attivo
- **Import/Export**: Condividi i tuoi profili con altri utenti o fai backup delle tue configurazioni
- **Profilo Default**: Profilo base protetto che non può essere eliminato

---

## 🎨 Interfaccia Utente e Design

### 🖥️ Layout Principale
- **MenuBar Superiore**:
  - Pulsante "Launch Game" per avviare InZOI direttamente
  - Sistema di notifiche per mod mancanti
  - Integrazione con profili attivi

- **Area Centrale**: Layout a due colonne con:
  - **Colonna Sinistra**: Mod Disabilitati (sfondo neutro)
  - **Colonna Destra**: Mod Abilitati (evidenziazione visiva)
  - **Drag Handle**: Icone di trascinamento per riordinamento

- **Drop Zone**: Area di trascinamento centrale per aggiungere nuovi mod
  - Stato Attivo: "Rilascia i file mod qui..."
  - Stato Inattivo: "Trascina mod qui o clicca per selezionare"

### 🎛️ StatusBar Intelligente
- **Stato Aggiornamenti Dinamico**:
  - ✅ "Up to date" (verde) - Nessun aggiornamento disponibile
  - 🔄 "Checking for updates..." (giallo, animato) - Controllo in corso
  - 📥 "Update available: v{version}" (blu) - Aggiornamento disponibile
  - ❗ "Update check failed" (rosso) - Errore nel controllo

- **Pulsanti Contestuali**:
  - "Check for Updates" - Controllo manuale aggiornamenti
  - "Download Update" (produzione) / "View on GitHub" (sviluppo)
  - "Report Bug / Request Feature" - Link diretto alle GitHub Issues

- **Link Esterni**:
  - "InZOI on Nexus Mods" - Collegamento alla pagina Nexus Mods

### 🃏 Mod Cards
- **Design Moderno**: Cards con bordi arrotondati e ombre sottili
- **Informazioni Mod**: Nome, stato (Abilitato/Disabilitato), icone di stato
- **Context Menu**: Tasto destro per opzioni rapide (Abilita, Disabilita, Rimuovi)
- **Indicatori Visivi**: Colori e icone per identificare rapidamente lo stato dei mod

---

## 🎨 Design System e Architettura UI Dettagliata

### 🌈 Schema Colori e Tema Dark Premium

**Palette Principale:**
- **Base Neutral**: Gradiente dal `neutral-900` al `neutral-800` per backgrounds principali
- **Trasparenze Glassmorphism**: Estensivo uso di `backdrop-blur-sm` e opacità variabili (`/60`, `/80`, `/90`)

**Accenti Funzionali:**
- **Verde** (`green-400` → `emerald-500`): Mod abilitati, successi, stati "ready"
- **Blu** (`blue-400` → `sky-500`): Aggiornamenti, informazioni, dragging states
- **Rosso** (`red-400` → `red-500`): Errori, rimozioni, warning critici
- **Giallo** (`yellow-400`): Warning, stati di caricamento, controlli in corso
- **Neutral** (`slate-200` → `slate-500`): Testi, elementi disabilitati

### 🏗️ Componenti UI Principali

#### **1. MenuBar Header**
```css
/* Classe CSS principale */
h-14 px-4 mx-4 mb-1 flex items-center justify-between
bg-gradient-to-r from-neutral-900/90 to-neutral-800/90
backdrop-blur-sm text-slate-100 border-b border-l border-r
border-neutral-700/80 rounded-b-xl shadow-2xl
hover:shadow-neutral-900/50 transition-all duration-300
```

**Elementi Interattivi:**
- **Logo + Titolo**: Font semibold con icona SVG custom
- **Pulsanti Azione**: 5 varianti × 5 colori = 25 combinazioni stilistiche
  - `Launch Game`: Success verde con icona Play
  - `Refresh`: Ghost neutral con RefreshCw animata
  - `Settings`: Outline neutral con icona Settings
  - `Reset Path` (DEV): Danger red con Trash2

#### **2. Layout Dual-Column Resizable**

**Container Principale:**
```css
flex flex-col h-full text-white →
flex flex-col flex-1 px-4 py-4 overflow-hidden
```

**Sistema Ridimensionamento:**
- **Colonna Sinistra**: `width: ${leftPanelWidth}%` (default 50%)
- **Resizer Handle**: `w-4 cursor-col-resize` con hover effects e transizioni fluide
- **Colonna Destra**: `width: ${100 - leftPanelWidth}%` dinamico

**Styling Colonne Differenziato:**
```css
/* Colonna Disabilitati */
h-full flex flex-col relative bg-neutral-900/60 p-3 md:p-4
rounded-lg shadow-lg border border-neutral-700

/* Colonna Abilitati */
h-full flex flex-col bg-neutral-900/90 p-3 md:p-4
rounded-lg border border-neutral-700
```

#### **3. ModCard Premium Design**

**Sistema Stati Multipli:**
```css
/* Mod Abilitato */
border border-green-600/30 bg-gradient-to-r from-green-900/20 to-emerald-900/20
hover:from-green-800/30 hover:to-emerald-800/30 hover:border-green-500/50
shadow-lg hover:shadow-green-500/30 hover:shadow-2xl

/* Mod Disabilitato */
border border-neutral-600/50 bg-gradient-to-r from-neutral-800/80 to-slate-800/80
hover:from-neutral-700/90 hover:to-slate-700/90 hover:border-neutral-500/70

/* Durante Dragging */
shadow-2xl shadow-sky-500/50 border-2 border-sky-400
bg-gradient-to-r from-sky-900/60 to-blue-900/60 opacity-0.8 z-index-1000
```

**Elementi UI Card:**
- **Indicatore Stato**: Barra colorata sinistra con gradiente (`h-8 rounded-r-full`)
- **Drag Handle**: `GripVertical` con animazioni `rotate-90` e `scale-125` durante drag
- **Nome Mod**: Typography `font-medium text-base` con `truncate` e tooltip
- **Badge Tipo**: `.pak badge` blu semi-trasparente con bordi arrotondati
- **Icona Stato**: `PlayCircle` (verde) / `PauseCircle` (neutral) con scale effects

#### **4. StatusBar Glassmorphism**

**Container Design:**
```css
bg-gradient-to-r from-neutral-900/90 to-neutral-800/90 backdrop-blur-sm
text-slate-400 flex items-center justify-between px-6 py-2 h-10
border-t border-l border-r border-neutral-700/80 rounded-t-xl mx-4
text-xs shadow-2xl hover:shadow-neutral-900/50 transition-all duration-300
```

**Stati Update con Icone Animate:**
- **Checking**: `RefreshCw animate-spin` + testo giallo
- **Available**: `Info` + testo blu + pulsante Download/GitHub
- **Error**: `AlertCircle` + testo rosso
- **Up-to-date**: `CheckCircle` + testo verde

### 🎭 Sistema Animazioni Avanzate

**Pattern Animazioni Coerenti:**
- **Durate Standard**: `duration-300` (principale), `duration-200` (rapida), `duration-150` (micro)
- **Easing Curves**: `ease-out`, `cubic-bezier(0.34, 1.56, 0.64, 1)` per bounce effects
- **Hover Progressions**: `scale-105` → `shadow-xl` → color shifts
- **Drag Feedback**: `opacity-0.8`, `transform: rotate(3deg) scale(1.05)`, shadow intensificate

**DragOverlay Styling:**
```css
transform rotate-3 scale-105 shadow-2xl shadow-sky-500/30
border-2 border-sky-400/70 backdrop-blur-lg
```

### 🔘 Sistema Pulsanti con Class Variance Authority

**Compound Variants Matrix:**
```typescript
// Esempio: variant='outline' + color='success'
"border-green-600 bg-gradient-to-r from-green-800/20 to-green-700/20
hover:border-green-500 hover:bg-green-600/30
active:scale-95 transition-all duration-200"

// Esempio: variant='default' + color='primary'
"bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:shadow-xl"
```

### 🪟 Dialog System con Radix UI

**DialogContent Glassmorphism:**
```css
bg-gradient-to-br from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl
p-6 shadow-2xl border border-neutral-700/80 sm:rounded-xl
data-[state=open]:animate-in data-[state=open]:zoom-in-95
data-[state=closed]:animate-out data-[state=closed]:zoom-out-95
```

**Settings Dialog Responsive:**
- **Breakpoints**: `sm:max-w-2xl md:max-w-3xl lg:max-w-4xl`
- **Scroll Area**: `max-h-[60vh]` con `overflow-y-auto`
- **Sezioni Organizzate**: Game Path, Staging Path, Theme, Language

### 📱 Responsive Design System

**Breakpoint Strategy:**
- **Mobile First**: Padding `p-3`, text `text-base`
- **Medium+**: Padding `md:p-4`, text `md:text-lg`
- **Large+**: Layout `lg:max-w-4xl`, grid `lg:grid-cols-4`

**Adaptive Components:**
```css
/* Esempio responsive padding */
p-3 md:p-4 lg:p-6

/* Esempio responsive grid */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-4

/* Esempio responsive text */
text-sm md:text-base lg:text-lg
```

### ♿ Accessibilità e UX Patterns

**Features Accessibilità:**
- **Screen Reader**: `sr-only` labels su tutti gli elementi interattivi
- **Focus Management**: `focus-visible:ring-2 focus-visible:ring-ring`
- **Keyboard Navigation**: Supporto completo Tab/Shift+Tab/Enter/Space
- **Color Contrast**: Tutti i colori rispettano WCAG AA (4.5:1 ratio)

**UX Micro-Interactions:**
- **Loading States**: Toast notifications con promise handling
- **Error Recovery**: Toast rossi con messaggi specifici e retry actions
- **Success Feedback**: Toast verdi con checkmark animations
- **Progressive Disclosure**: Sezioni espandibili con smooth height transitions

### 🎨 Context Menu Radix Styling

**Menu Container:**
```css
w-48 bg-neutral-800/95 backdrop-blur-lg border border-neutral-700/80
rounded-lg shadow-2xl shadow-black/50 p-1
```

**Menu Items con Color Coding:**
- **Enable/Disable**: `focus:bg-green-700/20` con icone colorate
- **Rename**: `focus:bg-blue-700/20` con `FileEdit` icon
- **Remove**: `focus:bg-red-700/20` con `Trash2` icon e conferma

Questo design system implementa un approccio "**Premium Dark-First**" con emphasis su:
- **Glassmorphism Effects**: Backdrop blur e trasparenze layered
- **Micro-Animations**: Feedback visivo immediato per ogni interazione
- **Color Psychology**: Verde=successo, Blu=info, Rosso=danger, Giallo=warning
- **Professional Feel**: Typography bilanciata, spacing coerente, componenti riutilizzabili

---

## 🔄 Sistema di Aggiornamenti

### 🚀 Aggiornamenti Automatici (Modalità Produzione)
- **Controllo Silenzioso**: Verifica automatica all'avvio senza popup invasivi
- **Notifiche Discrete**: Sistema di toast notifications invece di finestre modali
- **Download Automatico**: Possibilità di scaricare e installare aggiornamenti direttamente dall'app

### 🛠️ Modalità Sviluppo
- **GitHub Integration**: Controllo aggiornamenti tramite GitHub API
- **Simulazione Reale**: Mostra dati reali delle release senza aggiornare l'applicazione
- **Link Diretto**: Pulsante "View on GitHub" per aprire la pagina delle release

### 🔔 Sistema Notifiche
- **Toast Notifications**: Utilizzo della libreria Sonner per notifiche non invasive
- **Feedback Immediato**: Conferme visive per tutte le azioni dell'utente
- **Gestione Errori**: Notifiche chiare in caso di errori o problemi

---

## 🌍 Internazionalizzazione

### 🗣️ Supporto Multilingue
- **Lingue Supportate**: Inglese (EN) e Italiano (IT)
- **Rilevamento Automatico**: Rilevamento automatico della lingua del sistema
- **Traduzioni Complete**: Interfaccia completamente tradotta inclusi messaggi di errore
- **React-i18next**: Sistema di traduzione professionale con interpolazione variabili

### 🔤 Esempi Traduzioni
**Inglese**:
- "Update available: v1.2.3"
- "Drag 'n' drop mod files here..."
- "You're all set! No new updates right now."

**Italiano**:
- "Aggiornamento disponibile: v1.2.3"
- "Trascina e rilascia i file mod qui..."
- "Tutto aggiornato! Nessun nuovo aggiornamento per ora."

---

## ⚙️ Caratteristiche Tecniche

### 🏗️ Architettura
- **Framework**: Electron con React + TypeScript
- **UI Components**: Radix UI per componenti accessibili
- **Styling**: Tailwind CSS con sistema di temi personalizzato
- **State Management**: React Hooks personalizzati
- **Drag & Drop**: @dnd-kit per interazioni avanzate

### 🎨 Sistema di Temi
- **Tema Chiaro/Scuro**: Supporto completo per entrambi i temi
- **Transizioni Fluide**: Animazioni CSS per cambio tema
- **Colori Dinamici**: Palette di colori che si adatta automaticamente
- **Next-themes**: Gestione avanzata dei temi con persistenza

### 📱 Design Responsive
- **Layout Adattivo**: Interfaccia che si adatta a diverse dimensioni finestra
- **Componenti Scalabili**: UI elements che mantengono proporzioni su tutti i display
- **Accessibilità**: Supporto completo per screen reader e navigazione da tastiera

---

## 🔐 Sicurezza e Affidabilità

### 🛡️ Gestione File
- **Validazione Formato**: Controllo rigoroso dei formati file supportati
- **Estrazione Sicura**: Gestione sicura di archivi compressi
- **Backup Automatico**: Sistema di backup automatico per prevenire perdita dati
- **Rilevamento Conflitti**: Identificazione automatica di potenziali conflitti tra mod

### 📊 Logging e Debug
- **Electron-log**: Sistema di logging professionale
- **Error Tracking**: Tracciamento dettagliato degli errori
- **Debug Mode**: Modalità di debug per sviluppatori
- **Crash Reporting**: Sistema di segnalazione crash automatico

---

## 🚀 Installazione e Distribuzione

### 📦 Packaging
- **Electron-builder**: Sistema di build automatizzato
- **Multi-platform**: Build per Windows, macOS e Linux
- **Code Signing**: Firma digitale per sicurezza
- **Auto-updater**: Sistema di aggiornamento automatico integrato

### 🔧 Dipendenze Principali
- **React 18**: Framework UI moderno
- **TypeScript**: Type safety e development experience migliorata
- **Tailwind CSS**: Framework CSS utility-first
- **Lucide React**: Libreria di icone moderna e coerente
- **Sonner**: Sistema di notifiche toast avanzato

---

## 📈 Roadmap e Funzionalità Future

### 🔮 Pianificazione Sviluppo
- **Sorting Automatico**: Sistema di ordinamento mod automatico
- **Plugin System**: Supporto per plugin di terze parti
- **Cloud Sync**: Sincronizzazione profili nel cloud
- **Mod Workshop**: Integrazione con workshop della community
- **Performance Monitor**: Monitoraggio prestazioni mod in real-time

### 🌟 Community Features
- **Sharing Profiles**: Condivisione semplificata dei profili mod
- **Mod Recommendations**: Sistema di raccomandazioni basato sui mod installati
- **Community Hub**: Hub per la community con recensioni e rating
- **Automatic Updates**: Aggiornamenti automatici dei mod dalla community

---

## 📞 Supporto e Community

### 🔗 Link Utili
- **GitHub Repository**: [Nebula-Studios/IMM](https://github.com/Nebula-Studios/IMM)
- **Issue Tracker**: Report bug e richieste feature
- **Nexus Mods**: [InZOI su Nexus Mods](https://www.nexusmods.com/inzoi)
- **Releases**: Download delle versioni stabili

### 💬 Supporto Utenti
- **GitHub Issues**: Sistema di ticket per supporto tecnico
- **Wiki**: Documentazione dettagliata per utenti avanzati
- **FAQ**: Domande frequenti e soluzioni comuni
- **Video Tutorial**: Guide video per l'utilizzo dell'applicazione

---

*Questa documentazione è stata generata per supportare lo sviluppo del sito web ufficiale di InZOI Mod Manager. Per informazioni tecniche più dettagliate, consultare il repository GitHub ufficiale.*