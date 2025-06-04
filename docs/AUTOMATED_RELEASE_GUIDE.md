# 🤖 Guida al Sistema di Release Automatizzato

## 📋 Panoramica

Il **InZOI Mod Manager** ora dispone di un sistema di release completamente automatizzato che elimina i falsi positivi antivirus e gestisce la distribuzione dei payload tramite GitHub Actions.

## ✨ Caratteristiche Principali

- **🚀 Release Automatiche**: Un solo comando per creare release complete
- **🛡️ Installer Pulito**: Nessun file sospetto nell'installer
- **🔐 Sicurezza Garantita**: Verifica SHA256 automatica per tutti i file
- **📦 Gestione Payload**: Preparazione e distribuzione automatica dei file Mod Enabler
- **🌐 Download-on-Demand**: I payload vengono scaricati solo quando necessario

## 🔄 Come Funziona

### 1. Workflow GitHub Actions

Il file [`.github/workflows/build.yml`](.github/workflows/build.yml) gestisce tutto automaticamente:

```yaml
# Si attiva quando viene pushato un tag v*.*.*
on:
  push:
    tags: ['v*.*.*']

# Esegue:
# 1. Build dell'applicazione Electron
# 2. Estrazione e preparazione payload
# 3. Calcolo hash SHA256
# 4. Generazione manifest.json
# 5. Upload su GitHub Releases
```

### 2. Struttura dei File

```
root/
├── payload.zip                    # File sorgente (con dsound.dllX)
├── .github/workflows/build.yml    # Workflow automatizzato
└── dist/                          # Output generato automaticamente
    ├── InzoiModManager-Setup-{version}.exe
    ├── latest.yml
    ├── release_payload.zip         # Payload preparato (dsound.dll)
    └── manifest.json              # Manifest generato
```

## 🚀 Processo di Release

### Passo 1: Preparazione

```bash
# 1. Assicurati che payload.zip sia aggiornato nella root
# 2. Aggiorna la versione in package.json
# 3. Committa tutte le modifiche
git add .
git commit -m "Release v1.0.6"
```

### Passo 2: Release Automatica

```bash
# Crea e pusha il tag - questo attiva TUTTO automaticamente!
git tag v1.0.6
git push origin v1.0.6
```

### Passo 3: Verifica

1. **Vai su GitHub Actions** per monitorare il workflow
2. **Controlla la Release** generata automaticamente
3. **Testa il download** del manifest e payload

## 📁 File Generati Automaticamente

### 1. Installer Pulito
- **Nome**: `InzoiModManager-Setup-{version}.exe`
- **Contenuto**: Applicazione senza payload embedded
- **Risultato**: ✅ Nessun falso positivo antivirus

### 2. Payload Preparato
- **Nome**: `release_payload.zip`
- **Trasformazione**: `dsound.dllX` → `dsound.dll`
- **Verifica**: Hash SHA256 calcolato automaticamente

### 3. Manifest Automatico
```json
{
  "version": "1.0.6",
  "files": {
    "payload": {
      "url": "https://github.com/NebulaStudioOfficial/inzoi-mod-manager/releases/download/v1.0.6/release_payload.zip",
      "sha256": "automaticamente_calcolato",
      "size": 123456
    }
  },
  "metadata": {
    "description": "Payload files for Inzoi Mod Manager - Mod Enabler system",
    "created_at": "2025-06-04T08:00:00Z",
    "compatible_versions": ["1.0.6"]
  }
}
```

## 🧪 Testing del Sistema

### Test Rapido del Workflow

```bash
# Test con tag di prova
git tag v1.0.6-test
git push origin v1.0.6-test

# Verifica che:
# ✅ GitHub Actions si attivi
# ✅ Build completi senza errori
# ✅ Release venga creata
# ✅ Tutti i file siano presenti
```

### Test End-to-End

1. **Installa l'applicazione** dall'installer pulito
2. **Vai in Impostazioni** → Mod Enabler
3. **Clicca "Installa Mod Enabler"**
4. **Verifica che:**
   - Il download funzioni
   - Il progress tracking sia visibile
   - I file vengano installati correttamente
   - La cache locale funzioni

## 🛠️ Risoluzione Problemi

### Workflow Fallisce

1. **Controlla i log** in GitHub Actions
2. **Verifica** che `payload.zip` sia presente nella root
3. **Assicurati** che il tag segua il formato `v*.*.*`
4. **Controlla** le permissioni del repository

### Download Fallisce

1. **Verifica** che la release sia pubblica
2. **Controlla** gli URL nel manifest
3. **Testa** manualmente con curl:
   ```bash
   curl -L "https://github.com/NebulaStudioOfficial/inzoi-mod-manager/releases/download/v1.0.6/manifest.json"
   ```

### Hash SHA256 Non Corrisponde

1. Il workflow **ricalcola automaticamente** tutti gli hash
2. **Ricarica** il manifest se necessario
3. **Pulisci** la cache locale dell'applicazione

## 🎯 Vantaggi del Sistema

### ✅ Per gli Sviluppatori

- **Zero Configurazione Manuale**: Tutto automatizzato
- **Processo Consistente**: Stesso workflow per ogni release
- **Riduzione Errori**: Nessun passaggio manuale soggetto a errori
- **Tracciabilità Completa**: Log dettagliati per ogni operazione

### ✅ Per gli Utenti

- **Installer Sicuro**: Nessun falso positivo antivirus
- **Download Veloce**: Solo quando necessario
- **Aggiornamenti Automatici**: Sistema di cache intelligente
- **Esperienza Trasparente**: Processo invisibile all'utente

### ✅ Per la Sicurezza

- **Verifica Crittografica**: SHA256 per ogni file
- **Distribuzione Sicura**: Solo tramite HTTPS da GitHub
- **Tracciabilità**: Ogni file è tracciabile alla sua release
- **Integrità Garantita**: Impossibile modificare file senza invalidare gli hash

## 📚 Documentazione Correlata

- [**Design Plan**](DESIGN_PLAN_DOWNLOAD_ON_DEMAND.md) - Architettura tecnica completa
- [**Setup GitHub Releases**](GITHUB_RELEASES_SETUP.md) - Configurazione dettagliata
- [**Implementation Complete**](IMPLEMENTATION_COMPLETE.md) - Documentazione implementazione
- [**README**](../README.md) - Guida utente generale

---

🎉 **Il sistema è completamente automatizzato e pronto all'uso!** 🎉

Basta un `git tag` e tutto il resto viene gestito automaticamente dal workflow.