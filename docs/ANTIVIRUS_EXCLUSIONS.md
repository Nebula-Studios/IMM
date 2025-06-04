# Esclusioni Antivirus per Inzoi Mod Manager

## ⚠️ Falsi Positivi Comuni

Il **Inzoi Mod Manager** può essere segnalato erroneamente come malware da alcuni antivirus a causa delle seguenti funzionalità legittime:

### 🔧 **Componenti che Possono Attivare Detection**

1. **dsound.dll** - DLL modificata per l'abilitazione mod
   - Sostituisce temporaneamente la DLL DirectSound di sistema
   - Utilizzata solo per abilitare il supporto mod in InZOI
   - **NON È MALWARE** - è un componente standard per il modding

2. **Auto-updater** - Sistema di aggiornamento automatico
   - Scarica aggiornamenti da GitHub
   - Modifica file dell'applicazione

3. **Gestione File di Gioco** - Operazioni sui file mod
   - Copia/sposta file .pak nella directory di InZOI
   - Estrazione automatica di archivi ZIP/RAR/7z
   - Rinomina file con prefissi numerici

## 🛡️ **Come Aggiungere Esclusioni**

### **Windows Defender**
1. Apri **Windows Security**
2. Vai a **Protezione da virus e minacce**
3. Clicca **Gestisci impostazioni** sotto "Impostazioni di protezione da virus e minacce"
4. Scorri fino a **Esclusioni** e clicca **Aggiungi o rimuovi esclusioni**
5. Aggiungi queste cartelle/file:
   ```
   C:\Users\[TuoNome]\AppData\Roaming\inzoi-mod-manager\
   [Percorso dove hai installato Inzoi Mod Manager]
   ```

### **Altri Antivirus**
- **Kaspersky**: Impostazioni → Eccezioni → Aggiungi
- **Norton**: Impostazioni → Antivirus → Scansioni ed Esclusioni → Esclusioni
- **AVG/Avast**: Impostazioni → Eccezioni

## 🔍 **Verifica Sicurezza**

### **VirusTotal Report**
- Il software è compilato da codice sorgente pubblico
- Repository GitHub: https://github.com/Nebula-Studios/IMM
- Falsi positivi comuni: W32.AIDetectMalware (detection basata su AI)

### **Codice Sorgente Aperto**
- Tutto il codice è disponibile su GitHub
- Puoi ispezionare ogni file prima dell'installazione
- Build riproducibili dal codice sorgente

## 📞 **Supporto**

Se continui ad avere problemi con falsi positivi:
1. Segnala il falso positivo al tuo provider antivirus
2. Usa la versione portable se disponibile
3. Compila il software dal codice sorgente

---

**Importante**: Inzoi Mod Manager è software libero e open source. Non contiene malware, spyware o altri codici dannosi.