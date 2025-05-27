# Workflow: Deploy Build

## Obiettivo
Automatizzare il processo di build e deploy dell'applicazione Electron

## Trigger
- Quando è necessario creare una nuova release
- Dopo aver completato e testato nuove features

## Steps

### 1. Pre-build Checks
```bash
# Verifica che tutti i test passino
npm run test

# Verifica linting
npm run lint

# Verifica build development
npm run build
```

### 2. Version Bump
```bash
# Incrementa la versione (patch/minor/major)
npm version patch
# oppure
npm version minor
# oppure  
npm version major
```

### 3. Build Production
```bash
# Build per tutte le piattaforme
npm run build:win
npm run build:mac
npm run build:linux

# Oppure build specifica
npm run electron:build
```

### 4. Test Build
- Testare l'eseguibile generato
- Verificare che tutte le funzionalità funzionino
- Controllare l'auto-updater

### 5. Create Release
```bash
# Commit version bump
git add .
git commit -m "chore: bump version to X.X.X"

# Tag release
git tag vX.X.X

# Push con tags
git push origin main --tags
```

### 6. Distribute
- Caricare i file su GitHub Releases
- Aggiornare il server di distribuzione se presente
- Notificare gli utenti dell'update disponibile

## Note
- Assicurarsi che le chiavi di signing siano configurate
- Verificare che i certificati siano validi
- Testare su macchine pulite quando possibile
