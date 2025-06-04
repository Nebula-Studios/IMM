# InZOI Mod Manager (IMM)

Un gestore di mod moderno e sicuro per InZOI, sviluppato con Electron, React e TypeScript.

## 🌟 Caratteristiche Principali

### 🛡️ Sistema Anti-Antivirus Avanzato
- **Download-on-Demand**: I file del Mod Enabler (`dsound.dll` e `bitfix/sig.lua`) vengono scaricati solo quando necessario
- **Installer Pulito**: L'installer non contiene più payload che causano falsi positivi antivirus
- **Verifica SHA256**: Tutti i file scaricati vengono verificati per garantire integrità e sicurezza
- **Cache Intelligente**: I file vengono memorizzati in cache per installazioni future più veloci

### 📦 Gestione Mod Completa
- **Drag & Drop**: Trascina file `.pak`, `.zip`, `.rar`, e `.7z` per aggiungere mod
- **Abilitazione/Disabilitazione**: Gestisci facilmente i tuoi mod attivi
- **Riordinamento**: Cambia l'ordine di caricamento dei mod con drag & drop
- **Rinomina**: Rinomina i mod direttamente nell'interfaccia
- **Scansione Automatica**: Rileva automaticamente mod esistenti

### 👥 Sistema Profili
- **Profili Multipli**: Crea configurazioni separate per diversi set di mod
- **Import/Export**: Condividi configurazioni con altri utenti
- **Backup Automatico**: I profili vengono salvati automaticamente

### 🎨 Interfaccia Moderna
- **Design Responsivo**: Interfaccia pulita e intuitiva
- **Temi**: Supporto per tema chiaro, scuro e automatico
- **Multilingua**: Supporto per italiano e inglese
- **Accessibilità**: Conforme agli standard di accessibilità

## 🚀 Installazione

### Download
Scarica l'ultima versione da [GitHub Releases](https://github.com/NebulaStudioOfficial/inzoi-mod-manager/releases).

### Requisiti di Sistema
- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4GB minimo, 8GB raccomandati
- **Spazio**: 100MB per l'applicazione + spazio per mod
- **Connessione Internet**: Richiesta per il primo download del Mod Enabler

## 🔧 Primo Utilizzo

1. **Avvia IMM** e seleziona la cartella di installazione di InZOI
2. **Installa Mod Enabler** cliccando sul pulsante dedicato
   - Il sistema scaricherà automaticamente i file necessari da GitHub
   - I file vengono verificati con SHA256 per garantire sicurezza
3. **Aggiungi mod** trascinando file `.pak` o archivi nella finestra
4. **Abilita/Disabilita** mod secondo le tue preferenze
5. **Avvia InZOI** e divertiti!

## 🛡️ Sicurezza e Antivirus

### Sistema Download-on-Demand
IMM utilizza un innovativo sistema di distribuzione che elimina completamente i falsi positivi antivirus:

- **Installer Pulito**: L'installer contiene solo il codice dell'applicazione
- **Download Sicuro**: I payload vengono scaricati da GitHub Releases tramite HTTPS
- **Verifica Crittografica**: Ogni file viene verificato con hash SHA256
- **Cache Locale**: I file vengono memorizzati localmente per riutilizzo futuro

### Automazione GitHub Actions 🤖
Il sistema include un workflow automatizzato che gestisce tutto il processo di release:
- **Trigger Automatico**: Si attiva con tag `v*.*.*`
- **Preparazione Payload**: Estrazione e rinomina automatica dei file
- **Calcolo Hash**: SHA256 generato automaticamente per ogni file
- **Generazione Manifest**: Creazione automatica del `manifest.json`
- **Upload Release**: Distribuzione automatica su GitHub Releases

### Configurazione GitHub Releases
I file del Mod Enabler sono distribuiti tramite:
- **Repository**: `NebulaStudioOfficial/inzoi-mod-manager`
- **Manifest**: `manifest.json` contiene metadati e hash di verifica
- **Payload**: `release_payload.zip` contiene `dsound.dll` e `bitfix/sig.lua`
- **Processo**: Completamente automatizzato tramite CI/CD pipeline

### 📖 Documentazione Tecnica
- [**🤖 Guida Release Automatizzate**](docs/AUTOMATED_RELEASE_GUIDE.md) - Processo semplificato
- [**🏗️ Design Plan Completo**](docs/DESIGN_PLAN_DOWNLOAD_ON_DEMAND.md) - Architettura tecnica
- [**📦 Setup GitHub Releases**](docs/GITHUB_RELEASES_SETUP.md) - Configurazione avanzata

##  Configurazione Avanzata

### Percorsi di Staging
- **Default**: `%APPDATA%/inzoi-mod-manager/inzoi_mod_manager_files/staged_mods`
- **Personalizzato**: Configurabile tramite Impostazioni

### Cache Sistema
- **Percorso**: `%APPDATA%/inzoi-mod-manager/mod_enabler_cache`
- **Pulizia**: Automatica per file temporanei obsoleti
- **Riutilizzo**: I file vengono riutilizzati tra installazioni

## 🐛 Risoluzione Problemi

### Problemi Antivirus
Se il tuo antivirus blocca IMM:
1. **Aggiungi Eccezione**: Aggiungi la cartella di IMM alle eccezioni
2. **Download Manuale**: Se il download automatico fallisce, verifica la connessione
3. **Cache Corrotta**: Elimina `%APPDATA%/inzoi-mod-manager/mod_enabler_cache`

### Problemi di Connessione
- Verifica la connessione a GitHub (github.com)
- Controlla firewall e proxy
- Verifica che le porte HTTPS (443) siano aperte

### Log e Debug
I log si trovano in:
- **Windows**: `%APPDATA%/inzoi-mod-manager/logs/`
- **Livelli**: Error, Warn, Info, Debug, Verbose

## 🛠️ Sviluppo

### Requisiti di Sviluppo
- Node.js 18+
- npm 9+
- Git

### Setup Locale
```bash
git clone https://github.com/NebulaStudioOfficial/inzoi-mod-manager.git
cd inzoi-mod-manager
npm install
npm run dev
```

### Build Produzione
```bash
npm run build        # Build renderer
npm run build:electron # Build main process
npm run dist         # Crea installer
```

### Struttura Progetto
```
inzoi-mod-manager/
├── electron/          # Processo principale Electron
├── src/              # Interfaccia React
├── public/           # Assets statici
├── locales/          # File di traduzione
├── build/            # File di build temporanei
└── dist/             # Installer finali
```

## 📝 Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi [LICENSE](LICENSE) per dettagli.

## 🤝 Contributi

I contributi sono benvenuti! Per contribuire:
1. Fork del repository
2. Crea un branch per le tue modifiche
3. Commit delle modifiche con messaggi descrittivi
4. Apri una Pull Request

### Linee Guida
- Segui gli standard di codice esistenti
- Aggiungi test per nuove funzionalità
- Aggiorna la documentazione
- Mantieni compatibilità backwards

## 📞 Supporto

- **Bug Report**: [GitHub Issues](https://github.com/NebulaStudioOfficial/inzoi-mod-manager/issues)
- **Discussioni**: [GitHub Discussions](https://github.com/NebulaStudioOfficial/inzoi-mod-manager/discussions)
- **Email**: support@nebulastudio.dev

## 🙏 Ringraziamenti

- Team di sviluppo InZOI per il fantastico gioco
- Community di modding InZOI per feedback e testing
- Contributori open source per librerie e strumenti utilizzati

## 📊 Statistiche

![GitHub release (latest by date)](https://img.shields.io/github/v/release/NebulaStudioOfficial/inzoi-mod-manager)
![GitHub downloads](https://img.shields.io/github/downloads/NebulaStudioOfficial/inzoi-mod-manager/total)
![GitHub issues](https://img.shields.io/github/issues/NebulaStudioOfficial/inzoi-mod-manager)
![GitHub stars](https://img.shields.io/github/stars/NebulaStudioOfficial/inzoi-mod-manager)

---

**InZOI Mod Manager** - Gestisci i tuoi mod con sicurezza e semplicità! 🎮✨
