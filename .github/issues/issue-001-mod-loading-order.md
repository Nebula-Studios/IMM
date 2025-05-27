# [FEATURE] Gestione Ordine di Caricamento Mod

## 📋 Descrizione
Implementare un sistema per gestire l'ordine di caricamento dei mod abilitati, permettendo agli utenti di riordinare i mod e aggiornare automaticamente la numerazione dei file nella cartella di gioco.

## 🎯 Obiettivo
Risolvere i conflitti tra mod e permettere agli utenti di ottimizzare l'ordine di caricamento per la migliore esperienza di gioco. I mod caricati per primi hanno priorità più bassa, quelli caricati dopo sovrascrivono le modifiche precedenti.

## 💡 Soluzione Proposta

### Interface Utente
- Aggiungere icona "Sort" nella colonna "Mod Abilitati"
- Implementare drag & drop per riordinamento mod nella lista
- Aggiungere frecce up/down per spostamento fine
- Mostrare numero ordine accanto a ogni mod

### Sistema di Numerazione
- Prefisso numerico ai file mod: `000_mod1.pak`, `001_mod2.pak`, etc.
- Aggiornamento automatico quando l'ordine cambia
- Gestione anche di file `.ucas` e `.utoc` associati

## 🔧 Implementazione Suggerita

### 1. Componente UI per Ordinamento
```typescript
// Nuovo componente ModOrderingControls
interface ModOrderingControlsProps {
  mods: EnabledMod[];
  onReorder: (newOrder: EnabledMod[]) => void;
}

// Drag & drop con react-beautiful-dnd o @dnd-kit/sortable
```

### 2. Logica di Rinumerazione
```typescript
// Servizio per gestire l'ordine dei file
class ModOrderingService {
  async reorderMods(mods: EnabledMod[], gameFolder: string): Promise<void> {
    // 1. Rinominare temporaneamente tutti i file
    // 2. Applicare nuova numerazione
    // 3. Aggiornare database locale
  }
  
  private generateFileName(index: number, originalName: string): string {
    const paddedIndex = index.toString().padStart(3, '0');
    return `${paddedIndex}_${originalName}`;
  }
}
```

### 3. State Management
```typescript
// Aggiungere al ModStore
interface ModState {
  enabledMods: EnabledMod[];
  modOrder: string[]; // Array di mod IDs in ordine
}

// Actions
- REORDER_MODS
- SET_MOD_ORDER
```

## 📝 Criteri di Accettazione

- [ ] L'utente può trascinare mod nella colonna "Abilitati" per riordinarli
- [ ] I file mod vengono rinumerati automaticamente (000_, 001_, etc.)
- [ ] L'ordine viene persistito e mantenuto tra sessioni
- [ ] Feedback visivo durante il drag & drop
- [ ] Gestione corretta di file associati (.ucas, .utoc)
- [ ] Non ci sono conflitti di nomi durante la rinumerazione
- [ ] Performance accettabile anche con molti mod (20+)

## 🔗 Dipendenze
- Issue: Abilitazione/Disabilitazione Mod (già implementato)
- Componenti: ModList, ModCard
- Store: ModStore per state management

## 📊 Priorità
- [x] **Medio-Alta** - Funzionalità importante per utenti avanzati

## 🧪 Test

### Test Funzionali
1. Abilitare 5+ mod
2. Riordinare tramite drag & drop
3. Verificare che i file vengano rinumerati correttamente
4. Riavviare app e verificare che l'ordine sia mantenuto

### Test Edge Cases
- Riordinamento con mod che hanno nomi lunghi/caratteri speciali
- Performance con 50+ mod
- Gestione errori durante rinominazione file
- Conflitti se file sono in uso dal gioco

### Test Automazione
```typescript
describe('ModOrdering', () => {
  it('should reorder mods and update file names', async () => {
    // Test implementation
  });
  
  it('should persist order between sessions', async () => {
    // Test implementation  
  });
});
```

## 💻 Esempio Implementazione UI

```tsx
<ModOrderingSection>
  <DragDropContext onDragEnd={handleDragEnd}>
    <Droppable droppableId="enabled-mods">
      {(provided) => (
        <div {...provided.droppableProps} ref={provided.innerRef}>
          {enabledMods.map((mod, index) => (
            <Draggable key={mod.id} draggableId={mod.id} index={index}>
              {(provided, snapshot) => (
                <ModOrderItem
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  mod={mod}
                  order={index}
                  isDragging={snapshot.isDragging}
                />
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  </DragDropContext>
</ModOrderingSection>
```

## ⚠️ Considerazioni Tecniche

### File System Safety
- Usare operazioni atomiche per rinominazione
- Backup temporaneo durante operazioni
- Rollback in caso di errori

### Performance
- Debounce per evitare rinominazioni eccessive
- Batch operations per mod multipli
- Progress indicator per operazioni lunghe

### UX
- Indicatori visivi chiari per l'ordine
- Feedback immediato durante drag
- Undo/Redo per errori dell'utente
