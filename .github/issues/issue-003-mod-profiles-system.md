# [FEATURE] Sistema di Profili per Mod

## 📋 Descrizione
Implementare un sistema di profili che permetta agli utenti di salvare diverse configurazioni di mod (combinazioni di mod abilitati/disabilitati) e passare rapidamente tra di esse.

## 🎯 Obiettivo
Permettere agli utenti di gestire multiple configurazioni di mod per diversi scenari di gioco (es. "Gameplay", "Estetico", "Sperimentale") senza dover manualmente abilitare/disabilitare mod ogni volta.

## 💡 Soluzione Proposta

### Funzionalità Core
- Creazione/Eliminazione profili personalizzati
- Salvataggio stato attuale mod come profilo
- Caricamento rapido profili esistenti
- Gestione conflitti durante switch profili
- Backup automatico configurazione corrente

### Interface Utente
- Dropdown "Profili" nella barra superiore
- Dialog per gestione profili (crea, rinomina, elimina)
- Indicatore profilo attivo
- Quick actions per switch rapido

## 🔧 Implementazione Suggerita

### 1. Data Model per Profili
```typescript
interface ModProfile {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  lastUsed: Date;
  modConfiguration: ModProfileConfig;
  isActive: boolean;
}

interface ModProfileConfig {
  enabledMods: string[]; // Array di mod IDs
  modOrder: string[];    // Ordine di caricamento
  settings?: Record<string, any>; // Future: per mod settings
}

interface ProfileStore {
  profiles: ModProfile[];
  activeProfile: string | null;
  autoSaveEnabled: boolean;
}
```

### 2. Servizio di Gestione Profili
```typescript
class ProfileService {
  async createProfile(name: string, description?: string): Promise<ModProfile> {
    const currentConfig = await this.getCurrentModConfiguration();
    
    const profile: ModProfile = {
      id: generateId(),
      name,
      description,
      createdAt: new Date(),
      lastUsed: new Date(),
      modConfiguration: currentConfig,
      isActive: false
    };
    
    await this.saveProfile(profile);
    return profile;
  }
  
  async loadProfile(profileId: string): Promise<void> {
    const profile = await this.getProfile(profileId);
    if (!profile) throw new Error('Profilo non trovato');
    
    // 1. Backup configurazione corrente se auto-save attivo
    if (this.autoSaveEnabled) {
      await this.autoSaveCurrentProfile();
    }
    
    // 2. Applica configurazione profilo
    await this.applyProfileConfiguration(profile.modConfiguration);
    
    // 3. Aggiorna stato profilo
    await this.setActiveProfile(profileId);
    
    // 4. Aggiorna lastUsed
    profile.lastUsed = new Date();
    await this.saveProfile(profile);
  }
  
  private async applyProfileConfiguration(config: ModProfileConfig): Promise<void> {
    // 1. Disabilita tutti i mod correnti
    await this.disableAllMods();
    
    // 2. Abilita mod del profilo nell'ordine specificato
    for (const modId of config.enabledMods) {
      await this.enableMod(modId);
    }
    
    // 3. Applica ordine di caricamento
    await this.applyModOrder(config.modOrder);
  }
}
```

### 3. UI Components

#### ProfileSelector Component
```typescript
interface ProfileSelectorProps {
  profiles: ModProfile[];
  activeProfile: ModProfile | null;
  onProfileChange: (profileId: string) => void;
  onManageProfiles: () => void;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  activeProfile,
  onProfileChange,
  onManageProfiles
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" className="min-w-[200px]">
        <User className="mr-2 h-4 w-4" />
        {activeProfile?.name || 'Nessun profilo'}
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    
    <DropdownMenuContent>
      {profiles.map(profile => (
        <DropdownMenuItem
          key={profile.id}
          onClick={() => onProfileChange(profile.id)}
          className={profile.isActive ? 'bg-accent' : ''}
        >
          <div className="flex flex-col">
            <span className="font-medium">{profile.name}</span>
            {profile.description && (
              <span className="text-xs text-muted-foreground">
                {profile.description}
              </span>
            )}
          </div>
          {profile.isActive && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
      ))}
      
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onManageProfiles}>
        <Settings className="mr-2 h-4 w-4" />
        Gestisci Profili
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
```

#### ProfileManagement Dialog
```typescript
const ProfileManagementDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const [profiles, setProfiles] = useState<ModProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestione Profili Mod</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Crea nuovo profilo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Crea Nuovo Profilo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome profilo..."
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                />
                <Button onClick={handleCreateProfile}>
                  <Plus className="h-4 w-4" />
                  Crea
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Lista profili esistenti */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profili Esistenti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profiles.map(profile => (
                  <ProfileListItem
                    key={profile.id}
                    profile={profile}
                    onLoad={() => handleLoadProfile(profile.id)}
                    onDelete={() => handleDeleteProfile(profile.id)}
                    onRename={(newName) => handleRenameProfile(profile.id, newName)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

## 📝 Criteri di Accettazione

- [ ] L'utente può creare profili salvando la configurazione mod corrente
- [ ] L'utente può caricare profili esistenti
- [ ] Il cambio profilo abilita/disabilita automaticamente i mod corretti
- [ ] L'ordine di caricamento mod viene preservato per profilo
- [ ] L'utente può rinominare/eliminare profili
- [ ] Indicatore visivo del profilo attivo
- [ ] Auto-save opzionale della configurazione corrente
- [ ] Gestione conflitti durante switch profili
- [ ] Export/Import profili per condivisione

## 🔗 Dipendenze
- Issue: Abilitazione/Disabilitazione Mod (già implementato)
- Issue: Gestione Ordine di Caricamento Mod (#001)
- Componenti: ModList, MenuBar
- Store: Nuovo ProfileStore

## 📊 Priorità
- [x] **Media** - Funzionalità per utenti che usano molti mod

## 🧪 Test

### Test Funzionali
1. Creare profilo "Test" con 3 mod abilitati
2. Disabilitare tutti i mod
3. Caricare profilo "Test"
4. Verificare che i 3 mod siano nuovamente abilitati

### Test Edge Cases
```
Test Cases:
1. Caricamento profilo con mod mancanti
2. Profilo con mod rinominati/spostati
3. Switch rapido tra profili multipli
4. Eliminazione profilo attivo
5. Profilo con ordine mod personalizzato
6. Auto-save durante cambio profilo
```

### Test Automazione
```typescript
describe('ModProfiles', () => {
  it('should create profile with current mod configuration', async () => {
    // Setup: abilita alcuni mod
    await enableMod('mod1');
    await enableMod('mod2');
    
    // Crea profilo
    const profile = await profileService.createProfile('Test Profile');
    
    expect(profile.modConfiguration.enabledMods).toContain('mod1');
    expect(profile.modConfiguration.enabledMods).toContain('mod2');
  });
  
  it('should load profile and apply configuration', async () => {
    // Test implementation
  });
  
  it('should handle missing mods gracefully', async () => {
    // Test implementation
  });
});
```

## 💻 Integration nel Layout

```tsx
// In MenuBar.tsx
<div className="flex items-center gap-4">
  <ProfileSelector
    profiles={profiles}
    activeProfile={activeProfile}
    onProfileChange={handleProfileChange}
    onManageProfiles={() => setShowProfileDialog(true)}
  />
  
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleSaveCurrentAsProfile()}
    title="Salva configurazione corrente come profilo"
  >
    <Save className="h-4 w-4" />
  </Button>
</div>
```

## ⚠️ Considerazioni Tecniche

### Data Persistence
```typescript
// Struttura file profili
profiles/
├── profiles.json           // Metadata profili
├── default.profile.json    // Profilo predefinito
├── gameplay.profile.json   // Profilo custom
└── backup/                 // Backup automatici
    ├── auto_save_[timestamp].profile.json
    └── pre_switch_backup.profile.json
```

### Performance
- Lazy loading profili non attivi
- Batch operations per abilitazione multipla mod
- Debounce auto-save per evitare salvataggi frequenti
- Cache configurazioni per switch rapidi

### UX
- Conferma prima di sovrascrivere profili
- Preview mod che verranno modificati prima del caricamento
- Progress indicator per operazioni lunghe
- Undo/Redo per switch profili accidentali

### Error Handling
```typescript
// Gestione mod mancanti
interface ProfileLoadResult {
  success: boolean;
  missingMods: string[];
  errors: string[];
  partialLoad: boolean;
}

const handleMissingMods = async (missingMods: string[]): Promise<void> => {
  // Mostra dialog con opzioni:
  // 1. Ignora mod mancanti
  // 2. Aggiorna profilo rimuovendo mod mancanti  
  // 3. Annulla caricamento
};
```

## 📈 Future Enhancements
- Condivisione profili via QR code/link
- Profili cloud con sync multi-device
- Template profili predefiniti dalla community
- Statistiche utilizzo profili
- Profili con mod settings specifici
