# [FEATURE] Supporto Archivi ZIP per Mod

## 📋 Descrizione
Implementare il supporto per l'importazione di mod tramite file ZIP, con estrazione automatica e gestione dei file contenuti (.pak, .ucas, .utoc).

## 🎯 Obiettivo
Semplificare l'installazione di mod per gli utenti, permettendo di trascinare direttamente file ZIP scaricati da siti come Nexus Mods senza dover estrarre manualmente i contenuti.

## 💡 Soluzione Proposta

### Funzionalità Core
- Rilevamento automatico file ZIP nel drag & drop
- Estrazione in directory temporanea
- Analisi contenuto per identificare file mod validi
- Importazione automatica file .pak (e associati)
- Pulizia automatica file temporanei

### Strutture ZIP Supportate
```
mod.zip
├── mod_name.pak
├── mod_name.ucas  
└── mod_name.utoc

oppure

mod.zip
└── subfolder/
    ├── mod_name.pak
    ├── mod_name.ucas
    └── mod_name.utoc
```

## 🔧 Implementazione Suggerita

### 1. Servizio di Estrazione ZIP
```typescript
interface ZipExtractionService {
  extractZip(zipPath: string): Promise<ExtractedModFiles>;
  validateZipContents(extractedPath: string): Promise<ModFile[]>;
  cleanupTempFiles(tempPath: string): Promise<void>;
}

interface ExtractedModFiles {
  tempPath: string;
  modFiles: ModFile[];
  isValid: boolean;
  errors?: string[];
}

interface ModFile {
  pakFile: string;
  ucasFile?: string;
  utocFile?: string;
  modName: string;
}
```

### 2. Estensione ModDropzone
```typescript
// In ModDropzone.tsx
const handleFilesDrop = async (files: File[]) => {
  for (const file of files) {
    if (file.name.endsWith('.zip')) {
      await handleZipFile(file);
    } else if (file.name.endsWith('.pak')) {
      await handlePakFile(file);
    }
  }
};

const handleZipFile = async (zipFile: File) => {
  try {
    setIsProcessing(true);
    
    // 1. Salva ZIP in temp
    const tempZipPath = await saveFileToTemp(zipFile);
    
    // 2. Estrai contenuto
    const extracted = await zipService.extractZip(tempZipPath);
    
    if (!extracted.isValid) {
      throw new Error(`ZIP non valido: ${extracted.errors?.join(', ')}`);
    }
    
    // 3. Importa mod trovati
    for (const modFile of extracted.modFiles) {
      await importModFromExtracted(modFile, extracted.tempPath);
    }
    
    // 4. Cleanup
    await zipService.cleanupTempFiles(extracted.tempPath);
    
  } catch (error) {
    showError(`Errore durante importazione ZIP: ${error.message}`);
  } finally {
    setIsProcessing(false);
  }
};
```

### 3. Validazione Contenuto ZIP
```typescript
const validateZipContents = async (extractedPath: string): Promise<ModFile[]> => {
  const modFiles: ModFile[] = [];
  
  // Cerca ricorsivamente file .pak
  const pakFiles = await findFilesRecursive(extractedPath, '.pak');
  
  for (const pakFile of pakFiles) {
    const baseName = path.basename(pakFile, '.pak');
    const dir = path.dirname(pakFile);
    
    const modFile: ModFile = {
      pakFile,
      modName: baseName,
      ucasFile: await findAssociatedFile(dir, baseName, '.ucas'),
      utocFile: await findAssociatedFile(dir, baseName, '.utoc')
    };
    
    modFiles.push(modFile);
  }
  
  return modFiles;
};
```

## 📝 Criteri di Accettazione

- [ ] L'utente può trascinare file ZIP nella dropzone
- [ ] ZIP vengono estratti automaticamente in directory temporanea
- [ ] File .pak vengono identificati anche in sottocartelle
- [ ] File associati (.ucas, .utoc) vengono collegati correttamente
- [ ] Gestione di ZIP con multipli mod
- [ ] Feedback visivo durante estrazione (progress bar)
- [ ] Gestione errori per ZIP corrotti o senza mod
- [ ] Pulizia automatica file temporanei
- [ ] Supporto per strutture di cartelle complesse

## 🔗 Dipendenze
- Issue: Aggiunta Mod (File PAK) - già implementato
- Componenti: ModDropzone
- Libreria: JSZip o node-stream-zip per estrazione
- Electron: fs, path per file system operations

## 📊 Priorità
- [x] **Media** - Quality of life importante per UX

## 🧪 Test

### Test Funzionali
1. Creare ZIP con singolo mod (.pak + .ucas + .utoc)
2. Trascinare nella dropzone
3. Verificare estrazione e importazione corretta
4. Verificare pulizia file temporanei

### Test Strutture ZIP
```
Test Cases:
1. ZIP con mod in root
2. ZIP con mod in sottocartella
3. ZIP con multipli mod
4. ZIP con file extra (readme, immagini)
5. ZIP corrotto
6. ZIP senza file .pak
7. ZIP con nomi file con caratteri speciali
```

### Test Automazione
```typescript
describe('ZipModImport', () => {
  beforeEach(() => {
    // Setup temp directory e mock files
  });
  
  it('should extract and import mod from valid ZIP', async () => {
    const zipFile = createMockZipFile();
    const result = await zipService.extractZip(zipFile.path);
    
    expect(result.isValid).toBe(true);
    expect(result.modFiles).toHaveLength(1);
    expect(result.modFiles[0].pakFile).toBeDefined();
  });
  
  it('should handle nested folder structures', async () => {
    // Test implementation
  });
  
  it('should cleanup temp files after processing', async () => {
    // Test implementation
  });
});
```

## 💻 Esempio UI Enhancement

```tsx
// In ModDropzone.tsx - Enhanced drop feedback
<DropzoneContainer 
  onDrop={handleFilesDrop}
  accept={{ 
    'application/zip': ['.zip'],
    'application/octet-stream': ['.pak']
  }}
>
  {isProcessing && (
    <ProcessingOverlay>
      <Spinner />
      <p>Estrazione ZIP in corso...</p>
      {progress && <ProgressBar value={progress} />}
    </ProcessingOverlay>
  )}
  
  <DropzoneContent>
    <Upload className="w-16 h-16 text-muted-foreground" />
    <h3>Trascina qui i tuoi mod</h3>
    <p className="text-sm text-muted-foreground">
      Supportati: file .pak e archivi .zip
    </p>
  </DropzoneContent>
</DropzoneContainer>
```

## ⚠️ Considerazioni Tecniche

### Sicurezza
- Validazione path per prevenire directory traversal
- Limite dimensione file ZIP (es. 500MB)
- Scansione antivirus opzionale per file estratti
- Sandboxing directory di estrazione

### Performance
- Estrazione asincrona con progress reporting
- Limite numero file per ZIP
- Cleanup automatico su crash/errore
- Memory management per ZIP grandi

### UX
- Preview contenuto ZIP prima dell'importazione
- Opzione per selezionare quali mod importare da ZIP multipli
- Drag & drop feedback specifico per tipo file
- Notifiche dettagliate su successo/errore

### File System
```typescript
// Struttura directory temporanea
temp/
├── extraction_[timestamp]/
│   ├── mod1.pak
│   ├── mod1.ucas
│   └── mod1.utoc
└── zip_cache/
    └── uploaded_zips/
```

## 📚 Dipendenze NPM da Aggiungere
```json
{
  "dependencies": {
    "jszip": "^3.10.1",
    "mime-types": "^2.1.35"
  },
  "devDependencies": {
    "@types/mime-types": "^2.1.1"
  }
}
