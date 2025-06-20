import Store from 'electron-store';

// Define a schema for the store
// Questa interfaccia deve corrispondere a quella usata nel renderer (src/components/mod-management/ModCard.tsx)
export interface ModItemForStore {
  id: string;
  name: string;
  path: string; // Percorso di staging del file .pak principale
  activePath?: string; // Percorso della cartella del mod nella directory ~mods del gioco (es. C:\...\~mods\000_NomeMod) O la directory ~mods stessa per i non-virtuali.
  numericPrefix?: string; // Prefisso numerico (es. "001") usato per i file del mod quando abilitato (solo per mod non virtuali)
  isNonVirtual?: boolean; // True se il mod è un insieme di file NNN_* nella root di ~mods, false/undefined se è una cartella NNN_ModName.
}

export interface StoreSchema {
  gameFolderPath?: string;
  modStagingPath?: string;
  savedDisabledMods?: ModItemForStore[]; // activePath non è rilevante per i mod disabilitati
  savedEnabledMods?: ModItemForStore[]; // activePath è rilevante qui
  theme?: 'light' | 'dark' | 'system';
}

// Initialize electron-store with the schema
export const store = new Store<StoreSchema>({
  schema: {
    gameFolderPath: {
      type: 'string',
    },
    modStagingPath: {
      type: 'string',
    },
    savedDisabledMods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          path: { type: 'string' },
          isNonVirtual: { type: ['boolean', 'null'], default: false }, // Aggiunto
          // activePath non è memorizzato per i mod disabilitati
        },
        required: ['id', 'name', 'path'],
      },
      default: [], // Default a un array vuoto
    },
    savedEnabledMods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          path: { type: 'string' },
          activePath: { type: ['string', 'null'] }, // Può essere undefined se non ancora determinato o se il mod è stato disabilitato
          numericPrefix: { type: ['string', 'null'] }, // Aggiunto per memorizzare il prefisso
          isNonVirtual: { type: ['boolean', 'null'], default: false }, // Aggiunto
        },
        required: ['id', 'name', 'path'], // activePath non è required, può essere aggiunto dinamicamente
      },
      default: [], // Default a un array vuoto
    },
    theme: {
      type: 'string',
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
  },
}); 