import {
  getProfiles,
  getActiveProfileId,
  isAutoSaveEnabled,
  updateProfileStoreState,
  getProfileStoreState,
} from '../store/profileStore.js';
import type { ModItem } from '../components/mod-management/ModCard.js'; // Corretto il percorso
import type { ModProfile, ModProfileConfig } from '../types/profiles.js'; // ProfileStoreState non è più usata direttamente qui
// import { promises as fs } from 'fs'; // Rimosso: useremo IPC
// import path from 'path'; // Rimosso: useremo IPC per i percorsi base e path.join solo se necessario localmente
// import { app } from 'electron'; // Rimosso: useremo IPC

// path.join è ancora utile per costruire segmenti di percorso nel renderer,
// ma il percorso base (userDataPath) verrà dal main.
// Funzione di utilità per generare ID semplici (da sostituire con una soluzione più robusta se necessario)
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Servizio per la gestione dei profili dei mod.
 */
export class ProfileService {
  private profilesDir: string | null = null; // Inizializzato a null, verrà impostato asincronamente
  private profilesFilePath: string | null = null; // Inizializzato a null

  constructor() {
    // L'inizializzazione dei percorsi ora è asincrona
    this.initializePathsAndProfiles().catch(err => {
      console.error('[ProfileService] Errore durante l\'inizializzazione dei percorsi e dei profili:', err);
    });
  }

  private async initializePathsAndProfiles(): Promise<void> {
    console.log('[ProfileService] Inizializzazione percorsi e profili persistenti...');
    try {
      const result = await window.electronAPI.getProfilePaths();
      if (result.success && result.paths) {
        this.profilesDir = result.paths.profilesDir;
        this.profilesFilePath = result.paths.profilesFilePath;
        console.log(`[ProfileService] Percorsi inizializzati: profilesDir=${this.profilesDir}, profilesFilePath=${this.profilesFilePath}`);

        const loadedData = await this.loadProfilesFromFile();
        if (loadedData) {
          console.log(`[ProfileService] Caricati ${loadedData.profiles.length} profili e impostazione autoSave: ${loadedData.autoSaveEnabled}.`);
          // Popola lo store con i profili caricati
          const profilesWithDateObjects = loadedData.profiles.map(p => ({
            ...p,
            createdAt: new Date(p.createdAt),
            lastUsed: new Date(p.lastUsed),
          }));
          updateProfileStoreState({
            ...getProfileStoreState(),
            profiles: profilesWithDateObjects,
            autoSaveEnabled: loadedData.autoSaveEnabled,
          });
        } else {
          console.log('[ProfileService] Nessun dato trovato nel file profiles.json o errore durante il caricamento. Lo store userà i valori di default.');
          // Assicura che autoSaveEnabled sia inizializzato a false se il file non esiste o è corrotto
          updateProfileStoreState({ ...getProfileStoreState(), autoSaveEnabled: false });
        }
      } else {
        console.error('[ProfileService] Impossibile ottenere userDataPath dal processo main:', result.error);
        // Gestire il caso in cui non si possa ottenere userDataPath (es. mostrare un errore all'utente)
      }
    } catch (error) {
      console.error('[ProfileService] Errore critico durante initializePathsAndProfiles:', error);
    }
  }


  // initializePersistedProfiles è stato rinominato e integrato in initializePathsAndProfiles
  // private async initializePersistedProfiles(): Promise<void> {
  //   console.log('[ProfileService] Inizializzazione profili persistenti...');
  //   const loadedProfiles = await this.loadProfilesFromFile();
  //   if (loadedProfiles) {
  //     console.log(`[ProfileService] Caricati ${loadedProfiles.length} profili dal file.`);
      // Popola lo store con i profili caricati
      // Assicurati che le date siano oggetti Date validi
      // const profilesWithDateObjects = loadedProfiles.map(p => ({
      //   ...p,
      //   createdAt: new Date(p.createdAt),
      //   lastUsed: new Date(p.lastUsed),
      // }));
      // updateProfileStoreState({ ...getProfileStoreState(), profiles: profilesWithDateObjects });
    // } else {
      // console.log('[ProfileService] Nessun profilo trovato nel file o errore durante il caricamento. Lo store userà i valori di default (se presenti).');
      // // Opzionale: creare un profilo "Default" se non ne esistono
      // // if (getProfiles().length === 0) {
      // //   await this.createProfile('Default', 'Profilo generato automaticamente', true);
      // // }
    // }
  // La parentesi graffa qui sopra (riga 95 originale) è stata rimossa perché era la chiusura del metodo commentato
  // initializePersistedProfiles e interrompeva la struttura della classe.

  private async loadProfilesFromFile(): Promise<{ profiles: ModProfile[], autoSaveEnabled: boolean } | null> {
    if (!this.profilesFilePath) {
      console.warn('[ProfileService] profilesFilePath non ancora inizializzato. Impossibile caricare i dati.');
      return null;
    }
    console.log(`[ProfileService] Tentativo di caricare i dati da: ${this.profilesFilePath}`);
    try {
      const accessResult = await window.electronAPI.profilesAccess(this.profilesFilePath);
      if (!accessResult.success) {
        console.error('[ProfileService] Errore IPC durante profilesAccess:', accessResult.error);
        return null;
      }
      if (!accessResult.exists) {
        console.log('[ProfileService] File profiles.json non trovato. Normale se è il primo avvio.');
        return null;
      }

      const readResult = await window.electronAPI.profilesReadFile(this.profilesFilePath);
      if (!readResult.success || typeof readResult.content !== 'string') {
        console.error('[ProfileService] Errore IPC durante profilesReadFile o contenuto non valido:', readResult.error);
        return null;
      }

      const fileData = JSON.parse(readResult.content) as { profiles: ModProfile[], autoSaveEnabled?: boolean };
      
      // Gestione retrocompatibilità: se il file contiene solo l'array di profili
      if (Array.isArray(fileData)) {
        console.warn('[ProfileService] Trovato vecchio formato di profiles.json (solo array). autoSaveEnabled sarà impostato a false.');
        const profiles = fileData.map(profile => ({
          ...profile,
          createdAt: new Date(profile.createdAt),
          lastUsed: new Date(profile.lastUsed),
        }));
        return { profiles, autoSaveEnabled: false };
      }
      
      // Nuovo formato: { profiles: [], autoSaveEnabled: true/false }
      const profiles = (fileData.profiles || []).map(profile => ({
        ...profile,
        createdAt: new Date(profile.createdAt),
        lastUsed: new Date(profile.lastUsed),
      }));
      const autoSaveEnabled = typeof fileData.autoSaveEnabled === 'boolean' ? fileData.autoSaveEnabled : false;

      console.log('[ProfileService] Dati letti con successo dal file profiles.json.');
      return { profiles, autoSaveEnabled };
    } catch (error) {
      console.error('[ProfileService] Errore durante la lettura o il parsing del file profiles.json:', error);
      return null;
    }
  }

  private async saveProfilesToFile(): Promise<void> {
    if (!this.profilesDir || !this.profilesFilePath) {
      console.warn('[ProfileService] profilesDir o profilesFilePath non ancora inizializzati. Impossibile salvare i profili.');
      return;
    }
    const profilesToSave = getProfiles(); // Prende i profili dallo store
    const autoSaveSetting = isAutoSaveEnabled(); // Prende l'impostazione autoSave dallo store
    
    const dataToSave = {
      profiles: profilesToSave,
      autoSaveEnabled: autoSaveSetting,
    };

    console.log(`[ProfileService] Tentativo di salvare ${dataToSave.profiles.length} profili e autoSave=${dataToSave.autoSaveEnabled} su: ${this.profilesFilePath}`);
    try {
      const mkdirResult = await window.electronAPI.profilesMkdir(this.profilesDir);
      if (!mkdirResult.success) {
        console.error('[ProfileService] Errore IPC durante profilesMkdir:', mkdirResult.error);
        // Non interrompere, tentare comunque la scrittura.
      }

      const jsonContent = JSON.stringify(dataToSave, null, 2);
      const writeResult = await window.electronAPI.profilesWriteFile(this.profilesFilePath, jsonContent);

      if (writeResult.success) {
        console.log('[ProfileService] Dati (profili e autoSave) salvati con successo su file.');
      } else {
        console.error('[ProfileService] Errore IPC durante profilesWriteFile:', writeResult.error);
      }
    } catch (error) {
      console.error('[ProfileService] Errore durante il salvataggio dei dati su file:', error);
    }
  }


  /**
   * Crea un nuovo profilo mod.
   * @param name Il nome del profilo.
   * @param description Una descrizione opzionale del profilo.
   * @returns Una Promise che si risolve con il profilo mod creato.
   */
  public async createProfile(name: string, description?: string, isAutoGenerated = false): Promise<ModProfile> {
    console.log(`[ProfileService] Tentativo di creare il profilo: ${name}`);

    // Ottieni la configurazione corrente dei mod
    let currentModConfig: ModProfileConfig;
    try {
      currentModConfig = await this.getCurrentModConfiguration();
      console.log('[ProfileService] Configurazione mod corrente ottenuta:', currentModConfig);
    } catch (error) {
      console.error('[ProfileService] Errore nell\'ottenere la configurazione mod corrente durante la creazione del profilo:', error);
      // Fallback a una configurazione vuota o gestisci l'errore come preferito
      currentModConfig = { enabledMods: [], modOrder: [], settings: {} };
    }

    const newProfile: ModProfile = {
      id: generateId(),
      name,
      description: description || '',
      createdAt: new Date(),
      lastUsed: new Date(),
      modConfiguration: currentModConfig,
      isActive: false, // Un nuovo profilo non è attivo di default
      isAutoGenerated,
    };
    console.log('[ProfileService] Nuovo profilo creato (in memoria):', newProfile);

    // Salva il profilo nello store
    const currentState = getProfileStoreState();
    const updatedProfiles = [...currentState.profiles, newProfile];
    updateProfileStoreState({ ...currentState, profiles: updatedProfiles });
    console.log(`[ProfileService] Profilo "${name}" salvato nello store.`);

    await this.saveProfilesToFile(); // Salva su file dopo l'aggiornamento dello store
    return newProfile;
  }

  /**
   * Carica un profilo mod esistente, applicando la sua configurazione.
:start_line:206
-------
   * @param profileId L'ID del profilo da caricare.
   * @returns Una Promise che si risolve con un oggetto indicante il successo e gli eventuali mod mancanti.
   * @throws Errore se il profilo non viene trovato.
   */
  public async loadProfile(profileId: string): Promise<{ success: boolean; missingMods?: string[] }> {
    console.log(`[ProfileService] Tentativo di caricare il profilo con ID: ${profileId}`);
    const profiles = getProfiles();
    const profileToLoad = profiles.find((p: ModProfile) => p.id === profileId);

    if (!profileToLoad) {
      console.error(`[ProfileService] Profilo con ID "${profileId}" non trovato.`);
      throw new Error(`Profilo con ID "${profileId}" non trovato.`);
    }

    console.log('[ProfileService] Profilo trovato:', profileToLoad);

    // Recupera i mod installati
    const modListsResult = await window.electronAPI.loadModLists();
    if (!modListsResult.success || !modListsResult.enabledMods || !modListsResult.disabledMods) {
      console.error('[ProfileService] Impossibile caricare gli elenchi dei mod correnti durante il caricamento del profilo:', modListsResult.error);
      return { success: false, missingMods: [] };
    }
    const installedMods = [...modListsResult.enabledMods, ...modListsResult.disabledMods];
    const installedModIds = installedMods.map(mod => mod.id);

    // Confronta i mod del profilo con quelli installati
    const missingMods: string[] = [];
    if (profileToLoad.modConfiguration.enabledMods) {
      for (const enabledModId of profileToLoad.modConfiguration.enabledMods) {
        if (!installedModIds.includes(enabledModId)) {
          const modDetails = profileToLoad.modConfiguration.modOrder
            .map(id => profileToLoad.modConfiguration.settings?.[id]?.name || id)
            .find(nameOrId => nameOrId === enabledModId);
          missingMods.push(modDetails || enabledModId);
        }
      }
    }

    if (missingMods.length > 0) {
      console.warn(`[ProfileService] Mod mancanti durante il caricamento del profilo "${profileToLoad.name}":`, missingMods);
      // NON ritornare qui l'errore di mod mancanti subito.
      // Lasciamo che applyProfileConfiguration tenti di sistemare le cose.
      // L'avviso di mod mancanti dovrebbe avvenire solo se, DOPO applyProfileConfiguration,
      // un mod richiesto dal profilo non è ATTIVO.
      // Per ora, continuiamo e lasciamo che applyProfileConfiguration faccia il suo corso.
      // La logica di controllo dei mod mancanti andrà rivista dopo la correzione di applyProfileConfiguration.
    }

    // Applica la configurazione del profilo caricato
    try {
      // Passiamo anche gli installedModIds e il profileToLoad.name per un logging migliore in caso di problemi
      await this.applyProfileConfiguration(profileToLoad.modConfiguration, installedModIds, profileToLoad.name);
    } catch (error) {
        console.error(`[ProfileService] Errore durante l'applicazione della configurazione del profilo "${profileToLoad.name}":`, error);
        return { success: false, missingMods: [] }; // Indica fallimento se applyProfileConfiguration fallisce
    }
    
    // DOPO aver applicato la configurazione, riverifichiamo i mod mancanti basandoci sullo stato ATTUALE.
    // Questa è una modifica importante alla logica.
    const finalModListsResult = await window.electronAPI.loadModLists();
    if (!finalModListsResult.success || !finalModListsResult.enabledMods) {
        console.error('[ProfileService] Impossibile ricaricare gli elenchi dei mod dopo aver applicato il profilo:', finalModListsResult.error);
        // Potremmo voler gestire questo come un errore, ma per ora logghiamo e continuiamo
    } else {
        const finalEnabledModIds = finalModListsResult.enabledMods.map(mod => mod.id);
        const stillMissingMods: string[] = [];
        if (profileToLoad.modConfiguration.enabledMods) {
            for (const requestedModId of profileToLoad.modConfiguration.enabledMods) {
                if (!finalEnabledModIds.includes(requestedModId)) {
                    const modDetails = profileToLoad.modConfiguration.modOrder
                        .map(id => profileToLoad.modConfiguration.settings?.[id]?.name || id)
                        .find(nameOrId => nameOrId === requestedModId);
                    stillMissingMods.push(modDetails || requestedModId);
                }
            }
        }
        if (stillMissingMods.length > 0) {
            console.warn(`[ProfileService] Mod ANCORA mancanti DOPO aver applicato il profilo "${profileToLoad.name}":`, stillMissingMods);
            return { success: false, missingMods: stillMissingMods }; // Ora restituiamo l'errore se ci sono mod mancanti
        }
    }


    // Aggiorna activeProfileId nello store
    const currentState = getProfileStoreState();
    updateProfileStoreState({ ...currentState, activeProfileId: profileId });
    console.log(`[ProfileService] Profilo attivo impostato su: ${profileId}`);

    // Aggiorna lastUsed nel profilo e salva le modifiche allo store
    const updatedProfiles = profiles.map((p: ModProfile) =>
      p.id === profileId ? { ...p, lastUsed: new Date() } : p
    );
    updateProfileStoreState({ ...currentState, profiles: updatedProfiles, activeProfileId: profileId });
    console.log(`[ProfileService] Data "lastUsed" per il profilo "${profileToLoad.name}" aggiornata.`);

    await this.saveProfilesToFile(); // Salva su file dopo l'aggiornamento dello store
    return { success: true };
  }

  /**
   * Elimina un profilo mod.
   * @param profileId L'ID del profilo da eliminare.
   * @returns Una Promise che si risolve quando il profilo è stato eliminato.
   * @throws Errore se il profilo non viene trovato.
   */
  public async deleteProfile(profileId: string): Promise<void> {
    console.log(`[ProfileService] Tentativo di eliminare il profilo con ID: ${profileId}`);
    const currentState = getProfileStoreState();
    const profileToDelete = currentState.profiles.find((p) => p.id === profileId);

    if (!profileToDelete) {
      console.error(`[ProfileService] Profilo con ID "${profileId}" non trovato per l'eliminazione.`);
      throw new Error(`Profilo con ID "${profileId}" non trovato.`);
    }

    if (profileToDelete.name === 'Default' && profileToDelete.isAutoGenerated) {
        console.warn(`[ProfileService] Il profilo "Default" non può essere eliminato.`);
        return;
    }


    const updatedProfiles = currentState.profiles.filter((p) => p.id !== profileId);
    let newActiveProfileId = currentState.activeProfileId;

    if (currentState.activeProfileId === profileId) {
      console.log(`[ProfileService] Il profilo eliminato ("${profileToDelete.name}") era quello attivo. Impostazione activeProfileId a null.`);
      newActiveProfileId = null;
    }

    updateProfileStoreState({
      ...currentState,
      profiles: updatedProfiles,
      activeProfileId: newActiveProfileId,
    });

    console.log(`[ProfileService] Profilo "${profileToDelete.name}" (ID: ${profileId}) eliminato dallo store.`);
    await this.saveProfilesToFile();
  }


  /**
   * Applica la configurazione dei mod di un profilo.
   * @param config La configurazione dei mod da applicare.
   * @param initialInstalledModIds (Opzionale) Elenco degli ID dei mod installati prima dell'applicazione.
   * @param profileName (Opzionale) Nome del profilo per un logging migliore.
   */
  private async applyProfileConfiguration(
    config: ModProfileConfig,
    initialInstalledModIds?: string[], // Aggiunto per riferimento, se necessario
    profileName?: string // Aggiunto per logging
  ): Promise<void> {
    const logPrefix = profileName ? `[ProfileService applyProfileConfiguration for "${profileName}"]` : '[ProfileService applyProfileConfiguration]';
    console.log(`${logPrefix} Inizio. Config da applicare:`, config);
    let success = true;

    try {
      // 1. Ottenere lo stato attuale dei mod (prima della disattivazione)
      const initialModListsResult = await window.electronAPI.loadModLists();
      if (!initialModListsResult.success || !initialModListsResult.enabledMods || !initialModListsResult.disabledMods) {
        console.error(`${logPrefix} Impossibile caricare gli elenchi dei mod correnti (iniziale):`, initialModListsResult.error);
        throw new Error('Impossibile caricare gli elenchi dei mod correnti per applicare la configurazione.');
      }
      const currentEnabledModsBeforeDisable = initialModListsResult.enabledMods;
      const allKnownModsAtStart = [...currentEnabledModsBeforeDisable, ...initialModListsResult.disabledMods];
      console.log(`${logPrefix} Mod attualmente abilitati (prima della disattivazione):`, currentEnabledModsBeforeDisable.map(m => m.id));
      
      // 2. Disabilitare tutti i mod attualmente attivi
      console.log(`${logPrefix} Inizio disabilitazione dei mod attualmente attivi...`);
      if (currentEnabledModsBeforeDisable.length > 0) {
        for (const mod of currentEnabledModsBeforeDisable) {
          try {
            console.log(`${logPrefix} Tentativo di disabilitare il mod: ${mod.name} (ID: ${mod.id})`);
            const disableResult = await window.electronAPI.disableMod(mod.name);
            if (!disableResult.success) {
              console.warn(`${logPrefix} Impossibile disabilitare il mod ${mod.name}: ${disableResult.error}`);
            }
          } catch (e) {
            console.error(`${logPrefix} Errore IPC durante la disabilitazione del mod ${mod.name}:`, e);
          }
        }
      } else {
        console.log(`${logPrefix} Nessun mod attualmente abilitato da disabilitare.`);
      }
      console.log(`${logPrefix} Fine disabilitazione dei mod attualmente attivi.`);

      // 3. Abilitare i mod specificati nella configurazione del profilo
      console.log(`${logPrefix} Inizio abilitazione dei mod dal profilo...`);
      const enabledModItemsAfterEnable: ModItem[] = []; // Memorizziamo qui i ModItem aggiornati

      if (config.enabledMods && config.enabledMods.length > 0) {
        console.log(`${logPrefix} Mod da abilitare secondo il profilo:`, config.enabledMods);
        for (const modIdToEnable of config.enabledMods) {
          // Troviamo il mod in allKnownModsAtStart per ottenere il suo path originale
          const modToEnableDetails = allKnownModsAtStart.find(m => m.id === modIdToEnable);
          if (modToEnableDetails) {
            try {
              console.log(`${logPrefix} Tentativo di abilitare il mod: ${modToEnableDetails.name} (ID: ${modIdToEnable}), Path: ${modToEnableDetails.path}`);
              const enableResult = await window.electronAPI.enableMod(modToEnableDetails.path, modToEnableDetails.name);
              if (!enableResult.success) {
                console.warn(`${logPrefix} Impossibile abilitare il mod ${modToEnableDetails.name}: ${enableResult.error}`);
                success = false;
              } else {
                // Se enableMod restituisce il ModItem aggiornato con activePath, lo usiamo.
                // Altrimenti, dovremo fare una nuova chiamata a loadModLists dopo tutte le abilitazioni.
                // Per ora, assumiamo che enableResult possa contenere l'activePath o che lo recupereremo dopo.
                // Se enableResult.mod (o simile) contiene il ModItem aggiornato:
                // if (enableResult.mod) {
                //   enabledModItemsAfterEnable.push(enableResult.mod);
                // }
                // Per ora, non facciamo nulla qui, ricaricheremo dopo.
              }
            } catch (e) {
              console.error(`${logPrefix} Errore IPC durante l'abilitazione del mod ${modToEnableDetails.name}:`, e);
              success = false;
            }
          } else {
            console.warn(`${logPrefix} Mod con ID "${modIdToEnable}" specificato nel profilo ma non trovato tra i mod conosciuti all'inizio. Questo mod potrebbe essere effettivamente mancante.`);
            success = false;
          }
        }
      } else {
         console.log(`${logPrefix} Nessun mod da abilitare specificato nel profilo.`);
      }
      console.log(`${logPrefix} Fine abilitazione dei mod dal profilo.`);

      // Se l'abilitazione ha avuto problemi, potremmo voler uscire prima
      if (!success) {
        console.warn(`${logPrefix} Fallimento durante la fase di abilitazione dei mod. Interruzione dell'applicazione del profilo.`);
        throw new Error('Applicazione della configurazione del profilo fallita durante l\'abilitazione dei mod.');
      }

      // 4. Ricaricare gli elenchi dei mod per ottenere gli activePath aggiornati
      console.log(`${logPrefix} Ricaricamento degli elenchi dei mod dopo l'abilitazione per ottenere activePath...`);
      const finalModListsResultAfterEnable = await window.electronAPI.loadModLists();
      if (!finalModListsResultAfterEnable.success || !finalModListsResultAfterEnable.enabledMods) {
          console.error(`${logPrefix} Impossibile ricaricare gli elenchi dei mod dopo l'abilitazione:`, finalModListsResultAfterEnable.error);
          throw new Error('Impossibile ottenere lo stato aggiornato dei mod dopo l\'abilitazione.');
      }
      const actualEnabledModsWithActivePath = finalModListsResultAfterEnable.enabledMods;
      console.log(`${logPrefix} Mod effettivamente abilitati con activePath:`, actualEnabledModsWithActivePath.map(m => ({id: m.id, name: m.name, activePath: m.activePath })));


      // 5. Applicare l'ordine dei mod utilizzando i ModItem aggiornati
      console.log(`${logPrefix} Inizio applicazione dell'ordine dei mod...`);
      if (config.modOrder && config.modOrder.length > 0) {
        console.log(`${logPrefix} Ordine mod richiesto dal profilo:`, config.modOrder);
        
        const orderedModItemsForUpdate: ModItem[] = config.modOrder
          .map(modId => {
            const mod = actualEnabledModsWithActivePath.find(m => m.id === modId);
            if (!mod) {
              console.warn(`${logPrefix} Mod con ID ${modId} (dall'ordine del profilo) non trovato tra i mod ATTUALMENTE ABILITATI con activePath. Impossibile includerlo nell'ordinamento.`);
            } else if (!mod.activePath) {
              console.warn(`${logPrefix} Mod ${mod.name} (ID: ${mod.id}) è abilitato ma manca di activePath. Impossibile includerlo nell'ordinamento corretto.`);
            }
            return mod;
          })
          .filter(mod => mod && mod.activePath) as ModItem[]; // Filtra quelli non trovati o senza activePath

        console.log(`${logPrefix} Mod Items ordinati pronti per IPC (filtrati, con activePath):`, orderedModItemsForUpdate.map(m => ({id: m.id, name: m.name, activePath: m.activePath })));

        if (orderedModItemsForUpdate.length !== config.modOrder.length) {
            console.warn(`${logPrefix} Alcuni mod specificati in modOrder non sono stati trovati tra i mod attualmente abilitati con activePath o mancavano di activePath. L'ordine potrebbe essere incompleto o non applicato per tutti.`);
             // Non impostare success = false qui necessariamente, l'ordine potrebbe essere parzialmente applicato.
             // L'importante è che updateModOrder riceva solo mod validi.
        }

        if (orderedModItemsForUpdate.length > 0) {
            try {
                console.log(`${logPrefix} Chiamata a window.electronAPI.updateModOrder con ${orderedModItemsForUpdate.length} items.`);
                const orderResult = await window.electronAPI.updateModOrder(orderedModItemsForUpdate);
                if (!orderResult.success) {
                    console.warn(`${logPrefix} Impossibile applicare l'ordine dei mod: ${orderResult.error}`);
                    success = false;
                } else {
                    console.log(`${logPrefix} Ordine dei mod applicato con successo.`);
                }
            } catch (e) {
                console.error(`${logPrefix} Errore IPC durante l'applicazione dell'ordine dei mod:`, e);
                success = false;
            }
        } else {
            console.log(`${logPrefix} Nessun mod valido (con activePath) trovato per applicare l'ordine, anche se modOrder era specificato nel profilo.`);
            // Se config.modOrder aveva elementi ma orderedModItemsForUpdate è vuoto, potrebbe essere un problema.
            if (config.modOrder.length > 0) {
                console.warn(`${logPrefix} config.modOrder non era vuoto, ma nessun mod valido per l'ordinamento è stato trovato.`);
                // success = false; // Considera se questo debba essere un fallimento
            }
        }
      } else {
        console.log(`${logPrefix} Nessun ordine dei mod specificato nel profilo.`);
      }
      console.log(`${logPrefix} Fine applicazione dell'ordine dei mod.`);

      if (success) {
        console.log(`${logPrefix} Configurazione del profilo applicata con successo.`);
      } else {
        console.warn(`${logPrefix} Configurazione del profilo applicata con alcuni errori.`);
        throw new Error('Applicazione della configurazione del profilo fallita parzialmente.');
      }

    } catch (error) {
      console.error(`${logPrefix} Errore generale:`, error);
      throw error;
    }
  }

  /**
   * Recupera la configurazione corrente dei mod dal sistema.
   * @returns Una Promise che si risolve con la configurazione dei mod corrente.
   * @throws Errore se non è possibile recuperare la configurazione.
   */
  private async getCurrentModConfiguration(): Promise<ModProfileConfig> {
    console.log('[ProfileService] Tentativo di ottenere la configurazione mod corrente...');
    try {
      const result = await window.electronAPI.loadModLists();
      if (result.success && result.enabledMods) {
        // L'ordine dei mod abilitati è generalmente quello in cui vengono caricati o come sono listati.
        // Se loadModLists non garantisce l'ordine di caricamento effettivo, questo potrebbe necessitare di aggiustamenti.
        const enabledModsIds = result.enabledMods.map(mod => mod.id);
        const config: ModProfileConfig = {
          enabledMods: enabledModsIds,
          modOrder: [...enabledModsIds], // Assume che l'ordine degli abilitati sia l'ordine di caricamento desiderato
          settings: {}, // Placeholder per future impostazioni specifiche dei mod
        };
        console.log('[ProfileService] Configurazione mod corrente recuperata:', config);
        return config;
      } else {
        console.error('[ProfileService] Impossibile ottenere la configurazione mod corrente da loadModLists:', result.error);
        throw new Error(`Impossibile ottenere la configurazione mod corrente: ${result.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      console.error('[ProfileService] Eccezione durante getCurrentModConfiguration:', error);
      throw error; // Rilancia l'errore per essere gestito dal chiamante
    }
  }

  /**
   * Rinomina un profilo mod esistente.
   * @param profileId L'ID del profilo da rinominare.
   * @param newName Il nuovo nome per il profilo.
   * @returns Una Promise che si risolve quando il profilo è stato rinominato.
   * @throws Errore se il profilo non viene trovato o se il nome è duplicato (opzionale).
   */
  public async renameProfile(profileId: string, newName: string): Promise<void> {
    console.log(`[ProfileService] Tentativo di rinominare il profilo con ID: ${profileId} in "${newName}"`);
    const currentState = getProfileStoreState();
    const profileIndex = currentState.profiles.findIndex((p) => p.id === profileId);

    if (profileIndex === -1) {
      console.error(`[ProfileService] Profilo con ID "${profileId}" non trovato per la rinomina.`);
      throw new Error(`Profilo con ID "${profileId}" non trovato.`);
    }

    // Opzionale: verifica se il nuovo nome è già in uso (se richiesto)
    // const isNameTaken = currentState.profiles.some(p => p.name === newName && p.id !== profileId);
    // if (isNameTaken) {
    //   console.warn(`[ProfileService] Il nome profilo "${newName}" è già in uso.`);
    //   throw new Error(`Il nome profilo "${newName}" è già in uso.`);
    // }

    const updatedProfiles = currentState.profiles.map((profile, index) => {
      if (index === profileIndex) {
        return { ...profile, name: newName, lastUsed: new Date() }; // Aggiorno anche lastUsed
      }
      return profile;
    });

    updateProfileStoreState({
      ...currentState,
      profiles: updatedProfiles,
    });

    console.log(`[ProfileService] Profilo ID: ${profileId} rinominato in "${newName}" nello store.`);
    await this.saveProfilesToFile();
  }

  /**
   * Recupera tutti i profili dallo store.
   * @returns Un array di ModProfile.
   */
  public getProfiles(): ModProfile[] {
    return getProfiles();
  }

  /**
   * Recupera l'ID del profilo attivo.
   * @returns L'ID del profilo attivo o null.
   */
  public getActiveProfileId(): string | null {
    return getActiveProfileId();
  }

  /**
   * Verifica se il salvataggio automatico è abilitato.
   * @returns True se il salvataggio automatico è abilitato, altrimenti false.
   */
  public isAutoSaveEnabled(): boolean {
    return isAutoSaveEnabled();
  }

  /**
   * Attiva o disattiva la funzione di auto-salvataggio.
   * @param enabled True per abilitare, false per disabilitare.
   */
  public async toggleAutoSave(enabled: boolean): Promise<void> {
    console.log(`[ProfileService] Tentativo di impostare autoSave a: ${enabled}`);
    const currentState = getProfileStoreState();
    updateProfileStoreState({ ...currentState, autoSaveEnabled: enabled });
    console.log(`[ProfileService] autoSaveEnabled impostato a ${enabled} nello store.`);
    await this.saveProfilesToFile(); // Persisti immediatamente la modifica
  }

  /**
   * Controlla se la configurazione dei mod del profilo attivo necessita di essere
   * aggiornata (se l'auto-salvataggio è abilitato) e la salva se necessario.
   */
  public async updateActiveProfileModConfigurationIfNeeded(): Promise<void> {
    if (!isAutoSaveEnabled()) {
      // console.log('[ProfileService] Auto-salvataggio non abilitato. Nessuna azione.');
      return;
    }

    const activeId = getActiveProfileId();
    if (!activeId) {
      // console.log('[ProfileService] Nessun profilo attivo. Nessuna azione per auto-salvataggio.');
      return;
    }

    console.log(`[ProfileService] Controllo auto-salvataggio per profilo attivo: ${activeId}`);
    const profiles = getProfiles();
    const activeProfile = profiles.find(p => p.id === activeId);

    if (!activeProfile) {
      console.warn(`[ProfileService] Profilo attivo con ID ${activeId} non trovato nello store durante l'auto-salvataggio.`);
      return;
    }

    try {
      const currentModConfig = await this.getCurrentModConfiguration();
      
      // Confronto profondo delle configurazioni (semplificato per ora, potrebbe necessitare di una libreria per deep-equal)
      // Per ora, confrontiamo le stringhe JSON. Non ideale per oggetti complessi ma sufficiente per ModProfileConfig.
      const currentConfigString = JSON.stringify(currentModConfig);
      const activeProfileConfigString = JSON.stringify(activeProfile.modConfiguration);

      if (currentConfigString !== activeProfileConfigString) {
        console.log('[ProfileService] Rilevata modifica alla configurazione dei mod. Auto-salvataggio in corso...');
        const updatedProfiles = profiles.map(p =>
          p.id === activeId
            ? { ...p, modConfiguration: currentModConfig, lastUsed: new Date() }
            : p
        );
        
        const currentState = getProfileStoreState();
        updateProfileStoreState({ ...currentState, profiles: updatedProfiles });
        
        await this.saveProfilesToFile();
        console.log(`[ProfileService] Profilo "${activeProfile.name}" auto-salvato con la nuova configurazione.`);
      } else {
        // console.log('[ProfileService] Nessuna modifica rilevata alla configurazione dei mod. Nessun auto-salvataggio necessario.');
      }
    } catch (error) {
      console.error('[ProfileService] Errore durante updateActiveProfileModConfigurationIfNeeded:', error);
    }
  }

  /**
   * Esporta un singolo profilo mod in formato JSON.
   * @param profileId L'ID del profilo da esportare.
   * @returns Una Promise che si risolve con un oggetto contenente il nome del file e il contenuto JSON, o null se il profilo non viene trovato.
   */
  public async exportProfile(profileId: string): Promise<{ fileName: string; content: string } | null> {
    console.log(`[ProfileService] Tentativo di esportare il profilo con ID: ${profileId}`);
    const profiles = this.getProfiles(); // Utilizza il metodo di istanza per coerenza
    const profileToExport = profiles.find((p) => p.id === profileId);

    if (!profileToExport) {
      console.warn(`[ProfileService] Profilo con ID "${profileId}" non trovato per l'esportazione.`);
      return null;
    }

    try {
      // Rimuoviamo isActive e isAutoGenerated per l'esportazione, se necessario,
      // o li includiamo se devono far parte del profilo esportato.
      // Per ora, esportiamo il profilo così com'è.
      const profileContent = JSON.stringify(profileToExport, null, 2);
      const sanitizedProfileName = profileToExport.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `profilo-${sanitizedProfileName}-${profileToExport.id.substring(0, 6)}.json`;

      console.log(`[ProfileService] Profilo "${profileToExport.name}" pronto per l'esportazione come "${fileName}".`);
      return { fileName, content: profileContent };
    } catch (error) {
      console.error(`[ProfileService] Errore durante la serializzazione del profilo "${profileToExport.name}" per l'esportazione:`, error);
      return null;
    }
  }

  /**
   * Importa un profilo mod da un oggetto ModProfile.
   * @param profileData L'oggetto ModProfile da importare (presumibilmente parsato da JSON).
   * @returns Una Promise che si risolve con il ModProfile importato e aggiunto, o un oggetto errore.
   */
  public async importProfile(profileData: ModProfile): Promise<ModProfile | { error: string }> {
    console.log('[ProfileService] Tentativo di importare un profilo:', profileData);

    // 1. Validazione di base
    if (!profileData || typeof profileData !== 'object') {
      return { error: 'Dati del profilo non validi o mancanti.' };
    }
    if (!profileData.name || typeof profileData.name !== 'string' || profileData.name.trim() === '') {
      return { error: 'Il nome del profilo è mancante o non valido.' };
    }
    if (!profileData.modConfiguration || typeof profileData.modConfiguration !== 'object') {
      return { error: 'La configurazione dei mod è mancante o non valida.' };
    }
    // Ulteriori validazioni su modConfiguration (enabledMods, modOrder) potrebbero essere aggiunte qui.
    // Ad esempio, verificare che enabledMods e modOrder siano array.
    if (!Array.isArray(profileData.modConfiguration.enabledMods)) {
        profileData.modConfiguration.enabledMods = []; // Default a vuoto se non è un array
    }
    if (!Array.isArray(profileData.modConfiguration.modOrder)) {
        profileData.modConfiguration.modOrder = []; // Default a vuoto se non è un array
    }


    // 2. Gestione conflitti (nome duplicato)
    const profiles = this.getProfiles();
    const existingProfileWithName = profiles.find(p => p.name.toLowerCase() === profileData.name.toLowerCase());
    if (existingProfileWithName) {
      console.warn(`[ProfileService] Un profilo con il nome "${profileData.name}" esiste già.`);
      return { error: `Un profilo con il nome "${profileData.name}" esiste già. Si prega di rinominare il profilo importato o quello esistente.` };
    }

    // 3. Creazione del nuovo profilo
    const newProfile: ModProfile = {
      ...profileData, // Prende i dati importati
      id: generateId(), // Genera un NUOVO ID univoco per evitare conflitti di ID
      createdAt: new Date(), // Imposta la data di creazione all'importazione
      lastUsed: new Date(), // Imposta l'ultimo utilizzo all'importazione
      isActive: false, // Un profilo importato non è attivo di default
      isAutoGenerated: false, // I profili importati non sono auto-generati
      // Assicurati che description sia una stringa
      description: typeof profileData.description === 'string' ? profileData.description : '',
    };

    console.log('[ProfileService] Nuovo profilo preparato per l\'importazione (con nuovo ID):', newProfile);

    // 4. Aggiunta allo store e salvataggio
    try {
      const currentState = getProfileStoreState();
      const updatedProfiles = [...currentState.profiles, newProfile];
      updateProfileStoreState({ ...currentState, profiles: updatedProfiles });
      console.log(`[ProfileService] Profilo importato "${newProfile.name}" aggiunto allo store.`);

      await this.saveProfilesToFile();
      return newProfile;
    } catch (error) {
      console.error('[ProfileService] Errore durante il salvataggio del profilo importato:', error);
      // Se saveProfilesToFile fallisce, potremmo voler fare un rollback dell'aggiunta allo store,
      // ma per ora restituiamo un errore generico.
      return { error: 'Errore durante il salvataggio del profilo importato nel sistema.' };
    }
  }
}

// Esporta una singola istanza del servizio per un facile utilizzo (pattern Singleton)
export const profileService = new ProfileService();