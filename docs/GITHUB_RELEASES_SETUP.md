# Setup GitHub Releases per Download-on-Demand

Questa guida spiega come configurare GitHub Releases per il sistema Download-on-Demand del Mod Enabler.

## Panoramica

Il sistema Download-on-Demand richiede che i file payload (`dsound.dll` e `bitfix/sig.lua`) siano distribuiti tramite GitHub Releases invece di essere inclusi nell'installer. Questo elimina i falsi positivi antivirus.

## 🚀 Setup Automatico (Raccomandato)

Il progetto include un workflow GitHub Actions (`.github/workflows/build.yml`) che automatizza completamente la creazione delle release e la gestione dei payload.

### Come Funziona il Workflow Automatico

1. **Trigger:** Si attiva automaticamente quando viene pushato un tag `v*.*.*`
2. **Build:** Compila l'applicazione Electron
3. **Payload Processing:** 
   - Estrae il `payload.zip` dalla root del progetto
   - Rinomina `dsound.dllX` in `dsound.dll` (per evitare problemi antivirus durante lo sviluppo)
   - Calcola automaticamente l'hash SHA256
   - Determina la dimensione del file
4. **Manifest Generation:** Crea automaticamente il `manifest.json` con tutti i metadati corretti
5. **Release Creation:** Carica tutti i file nella GitHub Release

### Per Creare una Nuova Release Automatica

```bash
# 1. Assicurati che payload.zip sia presente nella root del progetto
# 2. Aggiorna la versione in package.json
# 3. Committa le modifiche
git add .
git commit -m "Release v1.0.6"

# 4. Crea e pusha il tag
git tag v1.0.6
git push origin v1.0.6

# 5. Il workflow GitHub Actions si attiverà automaticamente
```

### File Automaticamente Inclusi nella Release

- `InzoiModManager-Setup-{version}.exe` - Installer pulito
- `latest.yml` - Metadati per auto-updater
- `release_payload.zip` - Archive con payload preparato
- `manifest.json` - Manifest generato automaticamente

## 📁 Struttura dei File

### 1. Payload Source (`payload.zip` nella root)

Il file `payload.zip` nella root del progetto deve contenere:
```
mod_enabler_payload/
├── dsound.dllX          # Rinominato automaticamente in dsound.dll
├── LICENSE.txt
└── bitfix/
    └── sig.lua
```

> **Nota:** Il file è nominato `dsound.dllX` per evitare falsi positivi antivirus durante lo sviluppo. Il workflow lo rinomina automaticamente in `dsound.dll`.

### 2. Manifest Generato (`manifest.json`)

Il workflow genera automaticamente un manifest con questa struttura:

```json
{
  "version": "1.0.6",
  "files": {
    "payload": {
      "url": "https://github.com/NebulaStudioOfficial/inzoi-mod-manager/releases/download/v1.0.6/release_payload.zip",
      "sha256": "a1b2c3d4e5f6...",
      "size": 1234567
    }
  },
  "metadata": {
    "description": "Payload files for Inzoi Mod Manager - Mod Enabler system",
    "created_at": "2025-06-04T08:00:00Z",
    "compatible_versions": ["1.0.6"]
  }
}
```

## 🔧 Setup Manuale (Solo se Necessario)

### Step 1: Preparare i File

1. **Creare la directory payload:**
   ```bash
   mkdir payload_release
   cd payload_release
   ```

2. **Copiare i file necessari:**
   ```
   payload_release/
   ├── dsound.dll
   ├── LICENSE.txt
   └── bitfix/
       └── sig.lua
   ```

3. **Creare l'archive ZIP:**
   ```bash
   zip -r payload.zip dsound.dll LICENSE.txt bitfix/
   ```

4. **Calcolare l'hash SHA256:**
   ```bash
   # Windows PowerShell
   Get-FileHash -Path "payload.zip" -Algorithm SHA256
   
   # Linux/macOS
   sha256sum payload.zip
   ```

### Step 2: Creare il Manifest

Creare `manifest.json` con i metadati corretti:

```json
{
  "version": "1.0.6",
  "files": {
    "payload": {
      "url": "https://github.com/NebulaStudioOfficial/inzoi-mod-manager/releases/download/v1.0.6/payload.zip",
      "sha256": "<HASH_CALCOLATO>",
      "size": <DIMENSIONE_FILE>
    }
  },
  "metadata": {
    "description": "Payload files for Inzoi Mod Manager - Mod Enabler system",
    "created_at": "2025-06-04T08:00:00Z",
    "compatible_versions": ["1.0.6"]
  }
}
```

### Step 3: Creare GitHub Release

1. **Vai su GitHub → Releases → Create a new release**

2. **Configura la release:**
   - **Tag:** `v1.0.6` (deve corrispondere alla versione)
   - **Title:** `Release v1.0.6`
   - **Description:** Descrizione delle modifiche

3. **Carica i file:**
   - `InzoiModManager-Setup-1.0.6.exe` (installer pulito)
   - `latest.yml` (metadati auto-updater)
   - `payload.zip` (file payload)
   - `manifest.json` (manifest del payload)

4. **Pubblica la release**

## 🔗 URL del Manifest

Il sistema cercherà sempre il manifest all'URL:
```
https://github.com/{OWNER}/{REPO}/releases/download/{TAG}/manifest.json
```

Esempio:
```
https://github.com/NebulaStudioOfficial/inzoi-mod-manager/releases/download/v1.0.6/manifest.json
```

## ✅ Verifica del Setup

### Test del Download

Testare manualmente il download:

```bash
# Download del manifest
curl -L "https://github.com/NebulaStudioOfficial/inzoi-mod-manager/releases/download/v1.0.6/manifest.json"

# Download del payload
curl -L "https://github.com/NebulaStudioOfficial/inzoi-mod-manager/releases/download/v1.0.6/release_payload.zip" -o "test_payload.zip"

# Verifica hash
sha256sum test_payload.zip
```

### Test dell'Applicazione

1. **Avviare l'applicazione**
2. **Andare nelle Impostazioni → Mod Enabler**
3. **Cliccare "Installa Mod Enabler"**
4. **Verificare che il download funzioni correttamente**

## 🛠️ Risoluzione dei Problemi

### Errore 404 - File Non Trovato

- Verificare che la release sia pubblica
- Controllare che i nomi dei file siano corretti
- Verificare l'URL nel manifest

### Errore di Verifica SHA256

- Ricalcolare l'hash del file payload
- Aggiornare il manifest con l'hash corretto
- Ricaricare il manifest nella release

### Timeout di Download

- Verificare la connessione internet
- Controllare le dimensioni del file payload
- Verificare che GitHub non abbia limitazioni

### Workflow Actions Fallisce

- Controllare i log del workflow in GitHub Actions
- Verificare che `payload.zip` sia presente nella root
- Assicurarsi che il formato del tag sia corretto (`v*.*.*`)

## 📋 Best Practices

### Sicurezza

1. **Sempre verificare gli hash SHA256**
2. **Usare HTTPS per tutti i download**
3. **Validare la dimensione dei file**
4. **Implementare timeout appropriati**

### Versioning

1. **Mantenere compatibilità con versioni precedenti**
2. **Usare tag semantici (v1.0.6)**
3. **Documentare le modifiche nelle release notes**
4. **Testare ogni release prima della pubblicazione**

### Workflow Automation

1. **Mantenere aggiornato il `payload.zip` nella root**
2. **Verificare il workflow su branch di test prima dei tag**
3. **Monitorare i log di GitHub Actions**
4. **Aggiornare le dipendenze del workflow regolarmente**

### Manutenzione

1. **Monitorare i download tramite GitHub Insights**
2. **Aggiornare regolarmente i file payload**
3. **Mantenere la documentazione aggiornata**
4. **Archiviare le versioni obsolete**

## 🎯 Conclusione

Con il setup automatico:
- ✅ L'installer è completamente pulito (nessun falso positivo antivirus)
- ✅ I file payload sono distribuiti in modo sicuro
- ✅ Il processo di release è completamente automatizzato
- ✅ Gli utenti ricevono sempre la versione corretta
- ✅ Zero intervento manuale richiesto per le release standard