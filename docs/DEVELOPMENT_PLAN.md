# Piano di Sviluppo Proposto per Estendere `inzoimodmanager`

## 1. Obiettivo Generale

Estendere `inzoimodmanager` per raggiungere la parità di funzionalità con il plugin Python [`inzoi.py`](inzoi.py:1), supportando l'installazione e la gestione di vari tipi di mod, inclusi file `.pak` (con i loro associati `.ucas`/`.utoc`), DLL (come `dwmapi.dll`, `dsound.dll`), e file di contenuto (`.glb`, `motion.dat`, `site.dat`, `appearance.dat`) nelle loro rispettive directory di installazione.

## 2. Analisi Tecnica e Strategia

### 2.1. Tipi di Mod e Percorsi di Installazione

Basandoci su [`inzoi.py`](inzoi.py:1) e l'analisi corrente:

*   **Bundle `.pak`**:
    *   File: `.pak`, `.ucas`, `.utoc`
    *   Percorso di installazione: `[CartellaGioco]/InZOI/Content/Paks/~mods/`
    *   Logica attuale: Già parzialmente supportata.
*   **DLL (DXGI/ReShade/ModEnabler)**:
    *   File: `dwmapi.dll` (per ReShade), `dsound.dll` (per ModEnabler), e file di configurazione associati (es. `ReShade.ini`, `ReShadePreset.ini`).
    *   Percorso di installazione: `[CartellaGioco]/InZOI/Binaries/Win64/`
*   **File di Contenuto Specifici**:
    *   `.glb` (Modelli 3D): `Documents/InZOI/User/Mods/glb/`
    *   `motion.dat` (Animazioni): `Documents/InZOI/User/Mods/motion/`
    *   `site.dat` (Dati Sito): `Documents/InZOI/User/Mods/site/`
    *   `appearance.dat` (Aspetto): `Documents/InZOI/User/Mods/appearance/`

### 2.2. Strategia di Attivazione Mod: Copia File (Confermata)

Continueremo ad utilizzare la **copia dei file** invece dei symlink. Sebbene i symlink offrano vantaggi teorici, la loro gestione su Windows, specialmente per quanto riguarda i permessi utente necessari per crearli (spesso richiedono privilegi amministrativi), introduce una complessità e potenziali problemi per l'utente finale che superano i benefici in questo contesto. La copia dei file è più robusta e meno soggetta a problemi di permessi.

### 2.3. Area di Staging

Manterremo l'uso dell'area di staging (`inzoi_mod_manager_files/staged_mods` nella cartella dati utente) per processare i file prima dell'attivazione. Questo permette una gestione più pulita e la possibilità di validare i mod prima di spostarli nelle directory di gioco.

## 3. Modifiche Architetturali e Strutture Dati

### 3.1. Estensione Strutture Dati Esistenti

Le interfacce `ModItem` (nel renderer) e `ModItemForStore` (nel processo main, definita in [`electron/main/index.ts:18`](electron/main/index.ts:18)) necessitano di essere estese per accomodare i nuovi tipi di mod e la gestione dei file associati.

```typescript
// Proposta per electron/main/index.ts (e struttura simile per il renderer)

// Enum per i tipi di mod
enum ModType {
  PAK_BUNDLE = 'pak_bundle', // .pak, .ucas, .utoc
  DLL_DXGI = 'dll_dxgi',     // es. dwmapi.dll per ReShade
  DLL_DSOUND = 'dll_dsound', // es. dsound.dll per ModEnabler
  CONTENT_GLB = 'content_glb',
  CONTENT_MOTION = 'content_motion',
  CONTENT_SITE = 'content_site',
  CONTENT_APPEARANCE = 'content_appearance',
  // ... altri tipi se necessario
  UNKNOWN = 'unknown'
}

interface ManagedFile {
  sourceStagePath: string; // Percorso completo del file nell'area di staging
  targetInstallPath: string; // Percorso completo di installazione target
  fileName: string;          // Nome del file (es. "modxyz.pak", "dwmapi.dll")
}

interface ModItemForStore {
  id: string; // UUID
  name: string; // Nome del mod (es. nome del file .zip o directory)
  type: 'pak' | 'zip' | 'folder'; // Tipo di archivio originale, potrebbe diventare obsoleto o integrato in modType
  modType: ModType; // NUOVO: Tipo di mod specifico
  pakFiles?: string[]; // File .pak associati (per PAK_BUNDLE)
  ucasFiles?: string[]; // File .ucas associati (per PAK_BUNDLE)
  utocFiles?: string[]; // File .utoc associati (per PAK_BUNDLE)
  otherFiles?: string[]; // Altri file nel bundle originale
  managedFiles: ManagedFile[]; // NUOVO: Elenco dei file gestiti per questo mod
  isEnabled: boolean;
  conflicts?: string[];
  order?: number; // Rilevante principalmente per PAK_BUNDLE
  originalPath?: string; // Percorso originale del file droppato
  size: number; // Dimensione totale del mod
  dateAdded: string; // Data di aggiunta
  // Aggiungere altri campi se necessario, es. versione, autore, descrizione
}
```

### 3.2. Diagramma di Flusso Proposto (Mermaid)

```mermaid
graph TD
    A[Utente trascina file/cartella Mod] --> B{Identifica Tipo Mod};

    subgraph Processo Main (`electron/main/index.ts`)
        B -- PAK, UCAS, UTOC --> C[Processa come PAK_BUNDLE];
        B -- dwmapi.dll, ReShade.ini --> D[Processa come DLL_DXGI];
        B -- dsound.dll, ModEnabler.ini --> E[Processa come DLL_DSOUND];
        B -- *.glb --> F[Processa come CONTENT_GLB];
        B -- motion.dat --> G[Processa come CONTENT_MOTION];
        B -- site.dat --> H[Processa come CONTENT_SITE];
        B -- appearance.dat --> I[Processa come CONTENT_APPEARANCE];
        B -- Altro/Sconosciuto --> J[Marca come UNKNOWN/Errore];

        C --> K[Copia in Staging & Crea `ModItemForStore` con `modType: PAK_BUNDLE`];
        D --> K[Copia in Staging & Crea `ModItemForStore` con `modType: DLL_DXGI`];
        E --> K[Copia in Staging & Crea `ModItemForStore` con `modType: DLL_DSOUND`];
        F --> K[Copia in Staging & Crea `ModItemForStore` con `modType: CONTENT_GLB`];
        G --> K[Copia in Staging & Crea `ModItemForStore` con `modType: CONTENT_MOTION`];
        H --> K[Copia in Staging & Crea `ModItemForStore` con `modType: CONTENT_SITE`];
        I --> K[Copia in Staging & Crea `ModItemForStore` con `modType: CONTENT_APPEARANCE`];

        K --> L[Salva `ModItemForStore` in `electron-store`];
        L --> M[Renderer riceve aggiornamento lista Mod];

        M -- Utente Abilita Mod --> N{Recupera `ModItemForStore`};
        N --> O{Determina `targetInstallPath` da `modType` e `ManagedFile`};
        O --> P[Copia file da Staging a `targetInstallPath`];
        P --> Q[Aggiorna stato `isEnabled` in `electron-store`];
        Q --> R[Renderer aggiorna UI];

        M -- Utente Disabilita Mod --> S{Recupera `ModItemForStore`};
        S --> T{Determina `targetInstallPath` da `modType` e `ManagedFile`};
        T --> U[Rimuovi file da `targetInstallPath`];
        U --> Q;
    end

    J --> M;
```

## 4. Modifiche agli IPC Handler Esistenti (`electron/main/index.ts`)

### 4.1. `handle-process-dropped-mods` (attualmente `process-dropped-mods` in [`electron/main/index.ts:520`](electron/main/index.ts:520))

*   **Logica Attuale**: Estrae file `.pak`, `.ucas`, `.utoc` da zip/cartelle e li copia nell'area di staging.
*   **Modifiche Necessarie**:
    1.  **Identificazione del Tipo di Mod**: Analizzare i file contenuti (non solo le estensioni, ma anche i nomi specifici come `dwmapi.dll`, `motion.dat`).
    2.  **Creazione `ManagedFile[]`**: Per ogni file rilevante, popolare l'array `managedFiles` con `sourceStagePath` (nell'area di staging), `targetInstallPath` (determinato dal `modType`), e `fileName`.
    3.  **Popolamento `modType`**: Impostare il campo `modType` corretto nell'oggetto `ModItemForStore`.
    4.  Gestire la copia di *tutti* i file rilevanti del mod nell'area di staging, non solo i `.pak`.
    5.  Se un archivio contiene tipi misti che non dovrebbero stare insieme (es. un `.pak` e un `dwmapi.dll`), decidere una strategia: creare mod separati, avvisare l'utente, o rifiutare. Per ora, si potrebbe dare priorità o gestire il tipo "principale" e loggare gli altri.

### 4.2. `handle-enable-mod` (attualmente `enable-mod` in [`electron/main/index.ts:1077`](electron/main/index.ts:1077))

*   **Logica Attuale**: Copia file `.pak`, `.ucas`, `.utoc` da staging a `~mods`.
*   **Modifiche Necessarie**:
    1.  Leggere `modType` e `managedFiles` da `ModItemForStore`.
    2.  Iterare su `managedFiles`. Per ogni file:
        *   Copiare il file da `file.sourceStagePath` a `file.targetInstallPath`.
        *   Assicurarsi che le directory di destinazione esistano (es. `InZOI/Binaries/Win64/`, `Documents/InZOI/User/Mods/glb/`), creandole se necessario (`fs.mkdirSync(path, { recursive: true })`).

### 4.3. `handle-disable-mod` (attualmente `disable-mod` in [`electron/main/index.ts:1237`](electron/main/index.ts:1237))

*   **Logica Attuale**: Rimuove file `.pak`, `.ucas`, `.utoc` da `~mods`.
*   **Modifiche Necessarie**:
    1.  Leggere `modType` e `managedFiles` da `ModItemForStore`.
    2.  Iterare su `managedFiles`. Per ogni file:
        *   Rimuovere il file da `file.targetInstallPath`.
        *   Opzionale: gestire la rimozione di directory vuote create dal mod manager.

### 4.4. `handle-scan-mods` (attualmente `scanDirectoryForPaks` in [`electron/main/index.ts:1665`](electron/main/index.ts:1665), da rinominare)

*   **Logica Attuale**: Scansiona `~mods` per file `.pak` e li confronta con `electron-store`.
*   **Modifiche Necessarie (Significative)**:
    1.  **Rinominare**: In `scanFileSystemForMods` o simile.
    2.  **Scansione Multi-Path**: Deve scansionare *tutti* i percorsi di installazione dei mod:
        *   `[CartellaGioco]/InZOI/Content/Paks/~mods/`
        *   `[CartellaGioco]/InZOI/Binaries/Win64/`
        *   `Documents/InZOI/User/Mods/glb/`
        *   `Documents/InZOI/User/Mods/motion/`
        *   `Documents/InZOI/User/Mods/site/`
        *   `Documents/InZOI/User/Mods/appearance/`
    3.  **Identificazione Mod**: Per i file trovati, tentare di associarli a `ModItemForStore` esistenti. Questo è complesso perché un file (es. `dwmapi.dll`) potrebbe non avere un nome univoco che lo leghi direttamente a un "mod" come inteso dall'utente (es. "Super ReShade Preset").
        *   Una strategia potrebbe essere quella di basarsi sui `managedFiles` registrati in `electron-store`. Se un file in `Win64` corrisponde a un `managedFile` di un `ModItemForStore` di tipo `DLL_DXGI`, allora quel mod è considerato "trovato".
    4.  **Sincronizzazione**: Aggiornare lo stato `isEnabled` dei mod in `electron-store` in base ai file trovati/mancanti.

### 4.5. `handle-synchronize-mod-states` (attualmente `synchronizeModStatesLogic` in [`electron/main/index.ts:1886`](electron/main/index.ts:1886))

*   **Logica Attuale**: Abilita/disabilita i mod `.pak` per corrispondere allo stato in `electron-store`.
*   **Modifiche Necessarie**:
    1.  Deve utilizzare la logica aggiornata di `handle-enable-mod` e `handle-disable-mod` che tiene conto di `modType` e `managedFiles` per operare sui percorsi corretti.

### 4.6. `handle-update-mod-order` (attualmente `update-mod-order` in [`electron/main/index.ts:2185`](electron/main/index.ts:2185))

*   **Logica Attuale**: Gestisce l'ordine dei file `.pak` in `~mods` (rinominandoli).
*   **Considerazioni**:
    1.  L'ordinamento è primariamente rilevante per i mod `.pak` a causa del modo in cui il gioco li carica.
    2.  Per altri tipi di mod (DLL, file di contenuto), l'ordine di caricamento è generalmente non applicabile o gestito diversamente (es. un solo `dwmapi.dll` può essere attivo).
    3.  Questa funzione potrebbe necessitare di essere condizionata per operare solo su mod di tipo `PAK_BUNDLE` o la UI dovrebbe prevenire tentativi di ordinare mod non ordinabili.

## 5. Nuovi IPC Handler

### 5.1. `handle-validate-mod` (Nuovo)

*   **Scopo**: Fornire un feedback all'utente sulla validità o sul tipo di un mod prima o dopo l'aggiunta.
*   **Logica**:
    1.  Prende un `modId` o un set di file.
    2.  Esegue la stessa logica di identificazione di `handle-process-dropped-mods` ma senza salvare/modificare lo stato.
    3.  Restituisce il `modType` identificato, i `managedFiles` proposti, e potenziali avvisi (es. "Questo DLL sovrascriverà un file di gioco core" - anche se per ora ci limitiamo a gestire i percorsi definiti).

## 6. Modifiche al Frontend (React/TypeScript)

*   **`ModDropzone.tsx` ([`src/components/mod-management/ModDropzone.tsx`](src/components/mod-management/ModDropzone.tsx:1))**:
    *   Continuerà a chiamare `window.electronAPI.processDroppedMods`.
*   **`ModManagerLayout.tsx` ([`src/components/layout/ModManagerLayout.tsx`](src/components/layout/ModManagerLayout.tsx:1)) e componenti figli (`ModList`, `ModItemCard`):**
    *   Dovranno renderizzare correttamente i mod in base al nuovo `modType` e `managedFiles`.
    *   Visualizzare icone o etichette diverse per tipi di mod diversi.
    *   Le azioni (abilita/disabilita) chiameranno gli stessi IPC handler, ma il backend gestirà la logica specifica.
    *   La funzionalità di ordinamento dovrebbe essere disponibile/visibile solo per i mod `PAK_BUNDLE`.
*   **Interfacce Frontend (`StagedModInfo`, `ModItem` etc. in `src/types/index.ts` o simili):**
    *   Dovranno rispecchiare le modifiche a `ModItemForStore`, includendo `modType` e `managedFiles`.
*   **`profileService.ts` ([`src/services/profileService.ts`](src/services/profileService.ts:1))**:
    *   Le modifiche principali sono nel backend; questo servizio dovrebbe continuare a funzionare se le firme degli IPC handler che chiama rimangono compatibili o vengono aggiornate di conseguenza.

## 7. Gestione dei Percorsi Utente e di Gioco

*   **Configurazione Iniziale**: L'applicazione necessita di conoscere il percorso della cartella di installazione di InZOI e, implicitamente, la cartella `Documents` dell'utente.
    *   Attualmente, sembra che alcuni percorsi siano hardcoded o derivati. Sarà importante renderli configurabili o rilevarli in modo affidabile. [`electron/main/index.ts`](electron/main/index.ts:1) usa `settingsStore.get('gamePath')`.
    *   Il percorso `Documents/InZOI/User/Mods/` è standard, ma `app.getPath('documents')` di Electron può essere usato per trovarlo dinamicamente.

## 8. Fasi di Sviluppo Suggerite

1.  **Fase 1: Backend - Strutture Dati e Identificazione Mod**
    *   Definire e implementare `ModType` enum e aggiornare `ModItemForStore` con `modType` e `managedFiles`.
    *   Modificare `handle-process-dropped-mods` per identificare correttamente i tipi di mod da [`inzoi.py`](inzoi.py:1) (DLLs, .glb, .dat files) e popolare le nuove strutture dati. In questa fase, la copia in staging è sufficiente.
    *   Testare rigorosamente l'identificazione e la creazione di `ModItemForStore`.
2.  **Fase 2: Backend - Abilitazione/Disabilitazione Mod**
    *   Modificare `handle-enable-mod` e `handle-disable-mod` per utilizzare `modType` e `managedFiles` per copiare/rimuovere file dai percorsi di installazione corretti.
    *   Implementare la creazione dinamica delle directory di destinazione.
    *   Testare l'attivazione/disattivazione per ogni tipo di mod supportato.
3.  **Fase 3: Backend - Scansione e Sincronizzazione**
    *   Riscrivere `scanDirectoryForPaks` in `scanFileSystemForMods` per scansionare tutti i percorsi rilevanti.
    *   Implementare la logica di associazione dei file trovati ai `ModItemForStore`.
    *   Aggiornare `synchronizeModStatesLogic` per funzionare con tutti i tipi di mod.
4.  **Fase 4: Frontend - Visualizzazione e Interazione**
    *   Aggiornare le interfacce TypeScript del frontend.
    *   Modificare i componenti React per visualizzare informazioni sui nuovi tipi di mod.
    *   Assicurarsi che le azioni utente (abilita, disabilita, ordina) funzionino correttamente e che l'ordinamento sia condizionale.
5.  **Fase 5: Test End-to-End e Rifinitura**
    *   Testare l'intero flusso per vari scenari di mod.
    *   Aggiungere gestione degli errori e feedback utente migliorati.
    *   Considerare il nuovo IPC handler `handle-validate-mod`.

## 9. Considerazioni Aggiuntive

*   **Installazione di ReShade/ModEnabler**: Il piano attuale si concentra sulla gestione dei file *una volta che l'utente li fornisce*. L'installazione automatica di ReShade o ModEnabler se non presenti è una funzionalità separata e più complessa (richiederebbe il download, l'esecuzione di installer, o la gestione di versioni). Può essere considerata per una fase successiva.
*   **"Virtual Mods"**: Il concetto di "virtual mod" di Mod Organizer 2 (che usa un file system virtuale) è significativamente più complesso e probabilmente fuori scopo per questa fase di estensione, data la scelta di usare la copia diretta dei file. Il sistema `managedFiles` è un passo verso una gestione più granulare, ma non una virtualizzazione completa.
*   **Dipendenze Esterne**: Assicurarsi che `electron-store` e altre dipendenze siano aggiornate.
*   **Logging**: Migliorare il logging nel processo main per facilitare il debug.

Questo piano fornisce una roadmap dettagliata. Ogni fase richiederà un'attenta implementazione e test.