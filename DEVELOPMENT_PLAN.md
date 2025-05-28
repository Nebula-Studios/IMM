# Piano di Sviluppo InZOI Mod Manager

Questo documento traccia il piano di sviluppo per l'applicazione InZOI Mod Manager. Verrà aggiornato man mano che le funzionalità vengono implementate.

## Fase 1: Setup Iniziale e Funzionalità Core

- [x] **1.1. Setup Ambiente Electron e Struttura Progetto:**

  - [x] Verificare che la struttura base di Electron (main, preload, renderer) sia correttamente configurata.
  - [x] Impostare le utility di base (logging, gestione errori).
  - [x] Integrare TypeScript e linter/formatter come da `clean-code-guidelines.mdc` (principi generali).

  - _Priorità: Altissima_
  - _Dipendenze: Nessuna_

- [x] **1.2. Primo Avvio e Selezione Cartella di Gioco:**

  - [x] Implementata la logica per richiedere all'utente di selezionare la cartella di gioco di InZOI al primo avvio (tramite modale `GameFolderSetup`).
  - [x] Salvataggio del percorso persistente tramite `electron-store`.
  - [x] Aggiunto controllo per verificare che la cartella selezionata si chiami "inzoi" (case-insensitive).
  - [x] Implementata funzionalità di sviluppo per resettare la cartella salvata.

  - _Priorità: Altissima_
  - _Dipendenze: Fase 1.1_

- [x] **1.3. Configurazione Supporto Mod (InZOI Mod Enabler):**

  - [x] Ricercare informazioni su "InZOI Mod Enabler di FrancisLouis" per capire quali file sono necessari e come installarli.
  - [x] Implementare la logica per verificare se i file di supporto sono presenti.
  - [x] Se non presenti, offrire all'utente di installarli (potrebbe richiedere il download e la copia di file specifici nella cartella di gioco).

  - _Priorità: Altissima_
  - _Dipendenze: Fase 1.2_

- [x] **1.4. Interfaccia Utente di Base (UI):**

  - [x] Progettare e implementare la UI principale con le due colonne: "Mod Disabilitati" (sinistra) e "Mod Abilitati" (destra).
  - [x] Creare componenti UI riutilizzabili per visualizzare i mod (nome, stato).
  - [x] Implementare drag and drop per aggiungere mod.

  - _Priorità: Alta_
  - _Dipendenze: Fase 1.1_

- [ ] **1.5. Aggiunta Mod (File PAK):**

  - [x] Implementare la logica per selezionare file `.pak` tramite il drag & drop.
  - [x] Logica per copiare/spostare i file `.pak` in una cartella gestita dall'applicazione (es. una sottocartella `mods_staging` o simile).
  - [x] Rilevamento e gestione automatica dei file `.ucas` e `.utoc` associati al `.pak`.
  - [x] Visualizzare i mod aggiunti nella colonna "Mod Disabilitati".

  - _Priorità: Alta_
  - _Dipendenze: Fase 1.4_

- [x] **1.6. Abilitazione/Disabilitazione Mod:**

  - [x] Implementare la logica per spostare un mod tra la colonna "Disabilitati" e "Abilitati" (drag & drop e/o pulsante).
  - [x] Quando un mod viene abilitato:

    - [x] Spostare/copiare il file `.pak` (e i suoi `.ucas`/`.utoc`) in una sottocartella numerata (es. `000_NomeMod/NomeMod.pak`) nella cartella dei mod del gioco (`~mods`). - [x] La numerazione si applica alla sottocartella per l'ordine di caricamento.

  - [x] Quando un mod viene disabilitato:

    - [x] Rimuovere il file `.pak` (e associati) dalla cartella dei mod del gioco.

  - _Priorità: Alta_
  - _Dipendenze: Fase 1.5_

## Fase 2: Funzionalità Avanzate e Miglioramenti

- [x] **2.1. Gestione Ordine di Caricamento:**

  - [x] Implementare l'interfaccia per l'icona "Ordina" (Sort).
  - [x] Permettere all'utente di riordinare i mod nella colonna "Abilitati".
  - [x] Aggiornare la numerazione dei file mod nella cartella di gioco in base al nuovo ordine.

  - _Priorità: Medio-Alta_
  - _Dipendenze: Fase 1.6_

- [x] **2.2. Supporto Archivi (ZIP, RAR, 7z):**

  - [x] Implementare la logica per gestire l'aggiunta di file `.zip`, `.rar`, `.7z`.
  - [x] Estrarre il contenuto dell'archivio (che dovrebbe contenere file `.pak` e potenzialmente `.ucas`/`.utoc`).
  - [x] Processare i file estratti come nella Fase 1.5.

  - _Priorità: Media_
  - _Dipendenze: Fase 1.5_

- [ ] **2.3. Rilevamento Automatico dei Mod Esistenti:**

  - [x] All'avvio (dopo la selezione della cartella), scansionare la cartella dei mod del gioco per identificare mod già presenti.
  - [ ] Cercare di associare questi mod a quelli conosciuti dall'applicazione o aggiungerli come nuovi mod.

  - _Priorità: Media_
  - _Dipendenze: Fase 1.2, Fase 1.6_

- [x] **2.4. Funzionalità Aggiuntive (Come da "Consigli e Trucchi"):**

  - [x] **Rinominare Mod:** Implementare il click destro per rinominare un mod.
  - [x] **Pulsante Aggiorna:** Implementare un pulsante per forzare una nuova scansione della cartella dei mod.
  - [x] **Opzioni Tema:** Implementare un selettore per tema chiaro/scuro.

  - _Priorità: Medio-Bassa_
  - _Dipendenze: Fase 1.4, Fase 1.6_

- [ ] **2.5. Download Dinamico Mod Enabler (Opzionale):**

  - [ ] Valutare e implementare il download automatico/aggiornamento dell'InZOI Mod Enabler tramite API di Nexus Mods.
  - [ ] Gestire autenticazione API (chiave utente o registrazione app).
  - [ ] Implementare logica di download ed estrazione.

  - _Priorità: Media (da valutare post Fase 1)_
  - _Dipendenze: Fase 1.3, Connessione Internet_

## Fase 3: Finalizzazione e Distribuzione

- [ ] **3.1. Localizzazione:**

  - [ ] Predisporre l'app per la localizzazione (es. usando `i18next`).
  - [ ] Aggiungere le traduzioni per Inglese e Italiano.

  - _Priorità: Media_
  - _Dipendenze: UI completata_

- [ ] **3.2. Test Approfonditi:**

  - [ ] Testare tutte le funzionalità su diverse configurazioni.
  - [ ] Testare con vari mod e scenari di conflitto.

  - _Priorità: Alta_
  - _Dipendenze: Tutte le fasi precedenti_

- [ ] **3.3. Build e Packaging:**

  - [ ] Configurare `electron-builder` per creare eseguibili.
  - [ ] Creare icone e metadati per l'applicazione.

  - _Priorità: Alta_
  - _Dipendenze: Fase 3.2_

## Considerazioni Generali (da `clean-code-guidelines.mdc`)

- [ ] Scrivere JSDoc per funzioni esportate e componenti React.
- [ ] Seguire convenzioni di nomenclatura: `camelCase` per funzioni/variabili, `PascalCase` per componenti/classi.
- [ ] Usare Conventional Commits per i messaggi di commit.
- [ ] Applicare i principi DRY (Don't Repeat Yourself), KISS (Keep It Simple, Stupid), e SRP (Single Responsibility Principle).
- [ ] Definire tipi TypeScript chiari per i dati dei mod, configurazioni, ecc.
