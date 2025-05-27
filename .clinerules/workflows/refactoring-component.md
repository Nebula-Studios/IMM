# Workflow: Refactoring Component

## Obiettivo
Guidare il processo di refactoring di componenti React per migliorare leggibilità, manutenibilità e performance

## Trigger
- Componente troppo complesso (>200 righe)
- Componente con troppe responsabilità
- Codice duplicato tra componenti
- Performance issues identificate

## Steps

### 1. Analisi del Componente
```typescript
// Identificare:
// - Numero di responsabilità
// - Numero di props
// - Complessità ciclomatica
// - Dipendenze esterne
// - Stato interno
```

### 2. Pianificazione del Refactoring
- [ ] Identificare responsabilità singole
- [ ] Pianificare suddivisione in sub-componenti
- [ ] Identificare custom hooks estraibili
- [ ] Valutare ottimizzazioni (memo, useMemo, useCallback)

### 3. Backup e Testing
```bash
# Creare branch di refactoring
git checkout -b refactor/component-name

# Assicurarsi che i test esistenti passino
npm run test -- ComponentName
```

### 4. Estrazione di Custom Hooks
```typescript
// Estrarre logica di stato in custom hooks
const useComponentLogic = () => {
  // Logica di stato e side effects
  return { state, actions };
};
```

### 5. Suddivisione in Sub-componenti
```typescript
// Creare componenti più piccoli e focalizzati
const ComponentHeader = ({ title, actions }) => { };
const ComponentBody = ({ data, onUpdate }) => { };
const ComponentFooter = ({ onSave, onCancel }) => { };
```

### 6. Ottimizzazione Performance
```typescript
// Applicare React.memo dove appropriato
const OptimizedComponent = React.memo(Component);

// Memoizzare computazioni costose
const expensiveValue = useMemo(() => 
  heavyComputation(data), [data]
);

// Memoizzare callbacks
const handleClick = useCallback((id) => 
  onClick(id), [onClick]
);
```

### 7. Aggiornamento Tipi TypeScript
```typescript
// Definire interfacce chiare e specifiche
interface ComponentProps {
  data: ComponentData;
  onUpdate: (data: ComponentData) => void;
  loading?: boolean;
}
```

### 8. Testing Post-Refactoring
```bash
# Eseguire tutti i test
npm run test

# Test E2E se applicabile
npm run test:e2e

# Verifica manuale dell'UI
npm run dev
```

### 9. Documentation Update
- Aggiornare commenti JSDoc
- Aggiornare README se necessario
- Documentare nuovi hooks o pattern utilizzati

### 10. Code Review
- Creare PR con descrizione dettagliata delle modifiche
- Richiedere review focalizzata su performance e maintainability
- Verificare che non ci siano breaking changes

## Checklist Finale
- [ ] Componente sotto le 150 righe
- [ ] Responsabilità unica e chiara
- [ ] Props interface ben definita
- [ ] Custom hooks estratti dove appropriato
- [ ] Performance ottimizzate
- [ ] Test aggiornati e funzionanti
- [ ] Documentazione aggiornata
- [ ] Code review completata

## Anti-patterns da Evitare
- Non creare troppi sub-componenti piccoli
- Non over-memoizzare (React.memo su tutto)
- Non estrarre hooks per logica troppo semplice
- Non modificare API pubblica senza necessità
