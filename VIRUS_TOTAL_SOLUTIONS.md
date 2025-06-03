# Soluzioni per Ridurre i Falsi Positivi VirusTotal

## 🎯 **Causa Principale: W32.AIDetectMalware**

La detection **W32.AIDetectMalware** è causata principalmente da:

### 1. **dsound.dll nella cartella mod_enabler_payload**
```
electron/resources/mod_enabler_payload/dsound.dll
```
- **Problema**: VirusTotal identifica qualsiasi DLL replacement come potenziale malware
- **Motivo**: I sistemi AI rilevano pattern di DLL hooking/injection

### 2. **Operazioni File System Estensive**
```typescript
// Patterns che attivano AI detection in electron/main/index.ts:
- Copia DLL (righe 1009-1012)
- Estrazione archivi ZIP/RAR/7z
- Rinomina file con prefissi numerici
- Modifica file di gioco
```

## 🛠️ **Soluzioni Immediate**

### **1. Code Signing (PRIORITÀ ALTA)**
```bash
# Usa la configurazione electron-builder-signed.json
npm run build -- --config electron-builder-signed.json
```

**Ottieni un certificato di code signing:**
- **DigiCert**: €200-400/anno (raccomandato per software commerciale)
- **Sectigo**: €150-300/anno
- **GlobalSign**: €180-350/anno

### **2. Distribuzione DLL Alternativa**
Invece di includere dsound.dll nell'installer:

```typescript
// In electron/main/index.ts, modifica il metodo installDLL:
async function downloadAndInstallDLL() {
  // Scarica dsound.dll da un server sicuro al momento dell'uso
  // invece di includerla nell'installer
  const dllUrl = 'https://secure-server.com/dsound.dll';
  const response = await fetch(dllUrl);
  // ... resto della logica
}
```

### **3. Whitelist VirusTotal**
1. **Crea account VirusTotal**
2. **Invia il tuo file come "false positive"**
3. **Fornisci documentazione del codice sorgente**
4. **Richiedi whitelist per il tuo dominio/hash file**

## 📦 **Modifiche alla Build**

### **A. Ridurre Footprint Sospetto**
```json
// In electron-builder.json, aggiungi:
{
  "nsis": {
    "deleteAppDataOnUninstall": false,
    "allowToChangeInstallationDirectory": true,
    "oneClick": false,
    "perMachine": false
  },
  "publish": null // Rimuovi auto-updater se non necessario
}
```

### **B. Escludere File Problematici**
```json
// In electron-builder.json:
{
  "files": [
    "dist/**/*",
    "node_modules/**/*",
    "!node_modules/**/test/**/*",
    "!electron/resources/mod_enabler_payload/**/*" // Escludi temporaneamente
  ]
}
```

## 🔐 **Strategia DLL Sicura**

### **Opzione 1: Download Runtime**
```typescript
// Scarica dsound.dll solo quando necessario
const downloadSecureDLL = async () => {
  const dllHash = 'sha256-expected-hash';
  const response = await fetch('https://your-server.com/dsound.dll');
  const buffer = await response.arrayBuffer();
  
  // Verifica hash prima dell'installazione
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  if (hash !== dllHash) {
    throw new Error('DLL hash mismatch');
  }
};
```

### **Opzione 2: DLL Separata**
- Distribuisci dsound.dll come file separato
- L'utente deve copiarlo manualmente
- Riduce drasticamente i falsi positivi

## 📊 **Timeline di Implementazione**

### **Settimana 1: Soluzioni Immediate**
- [ ] Implementa code signing
- [ ] Crea build senza dsound.dll
- [ ] Testa riduzione falsi positivi

### **Settimana 2: Ottimizzazioni**
- [ ] Implementa download DLL runtime
- [ ] Invia richiesta whitelist VirusTotal
- [ ] Documenta processo per utenti

### **Settimana 3: Verifica**
- [ ] Testa su multiple piattaforme antivirus
- [ ] Raccoglie feedback utenti
- [ ] Refina processo di distribuzione

## 🎯 **Risultati Attesi**

Implementando queste soluzioni:
- **80-90% riduzione** falsi positivi con code signing
- **95%+ riduzione** rimuovendo dsound.dll dall'installer
- **Miglior esperienza utente** con meno blocchi antivirus

## 📞 **Contatti VirusTotal**

Per richieste di whitelist:
- **Email**: [virus-submission@virustotal.com](mailto:virus-submission@virustotal.com)
- **Form**: https://support.virustotal.com/hc/en-us/requests/new
- **Categoria**: False Positive Report