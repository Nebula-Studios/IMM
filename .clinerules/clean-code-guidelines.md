# Linee Guida per il Clean Code

Queste regole definiscono gli standard di codifica per mantenere il codice pulito, leggibile e manutenibile nel nostro progetto basato su Next.js 15, React 19, shadcn/ui, Supabase e Clerk.

## Struttura e Componenti

- Tutti i componenti React riutilizzabili devono essere collocati nella directory [components/](mdc:components).
- I componenti specifici di una "route" o "feature" possono risiedere all'interno delle rispettive cartelle in `app/`.

## Documentazione (JSDoc)

- **Ogni funzione esportata** (specialmente Server Actions in [app/actions.ts](mdc:app/actions.ts) e funzioni di utilità) DEVE avere un commento JSDoc che ne spieghi lo scopo, i parametri (`@param`) e il valore di ritorno (`@returns`).
- I componenti React dovrebbero avere un JSDoc che ne descriva lo scopo e le `props` principali.

Esempio:

```typescript
/**
 * Aggiorna i metadati pubblici dell'utente corrente.
 * @param metadata Oggetto contenente i metadati pubblici da aggiornare.
 * @returns Un oggetto con stato di successo e messaggio o errore.
 */
export async function updateUserPublicMetadata(metadata: Record<string, any>) {
  // ... implementazione ...
}
```

## Convenzioni di Nomenclatura

- Usa nomi **chiari, descrittivi e prevedibili** per variabili, funzioni, classi e componenti.
- **Variabili e Funzioni:** usa `camelCase` (es: `userName`, `fetchData`).
- **Componenti React e Classi:** usa `PascalCase` (es: `UserProfileCard`, `AuthService`).
- **Costanti:** usa `UPPER_SNAKE_CASE` (es: `MAX_USERS`, `API_ENDPOINT`).
- Evita abbreviazioni non standard o nomi troppo generici (es: `data`, `val`, `func`).

## Messaggi di Commit

- Segui le [Convenzioni sui Messaggi di Commit](mdc:https:/www.conventionalcommits.org).
- Il formato base è: `<tipo>(<scope>): <descrizione>`.
  - **Tipi comuni:** `feat`, `fix`, `build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`.
  - **Scope (opzionale):** indica la parte del codice interessata (es: `auth`, `ui`, `api`, `metadata`).

Esempi:

```
feat(auth): add password reset functionality
fix(ui): correct button alignment on mobile
refactor(api): improve data fetching logic for user profiles
docs: update README with setup instructions
```

## Principi Generali

- **DRY (Don't Repeat Yourself):** Evita la duplicazione del codice. Estrai logica comune in funzioni o componenti riutilizzabili.
- **KISS (Keep It Simple, Stupid):** Preferisci soluzioni semplici e dirette a quelle complesse.
- **Single Responsibility Principle (SRP):** Ogni funzione, componente o modulo dovrebbe avere una sola responsabilità ben definita.

## Gestione di Interfacce e Type

- **File Separati:** Crea file `.d.ts` dedicati per le dichiarazioni di tipo complesse o riutilizzabili.
- **Collocazione:**
  - Tipi specifici di un componente dovrebbero essere dichiarati nello stesso file del componente.
  - Tipi condivisi tra più componenti devono essere collocati in `types/` o in sottocartelle tematiche (es. `types/auth/`).
  - Per modelli di dati principali del dominio, creare file dedicati (es. `types/user.ts`).
- **Convenzioni di Nomenclatura:**
  - Interfacce: usa `PascalCase` con prefisso `I` (es: `IUserProfile`).
  - Type: usa `PascalCase` senza prefissi (es: `UserProfile`).
  - Per props dei componenti, suffisso `Props` (es: `UserCardProps`).
- **Export/Import:**
  - Esporta i tipi esplicitamente: `export type UserData = {...}`.
  - Raggruppa le esportazioni di tipi correlati: `export type { UserData, UserPreferences }`.
- **Documentazione:**
  - Documenta i tipi complessi con JSDoc, spiegando proprietà non ovvie.
  - Per le API, documenta tutti i parametri e i valori di ritorno.
- **Evita `any`:**
  - Usa `unknown` invece di `any` quando il tipo è veramente sconosciuto.
  - Definisci interfacce esplicite anche per dati esterni (es. risposte API).
- **Zod per la Validazione:**
  - Utilizza Zod per validare i dati e generare tipi automaticamente per le richieste server.
  - Mantieni coerenza tra schemi Zod e tipi TypeScript.

## Immagini Placeholder con placehold.co

Utilizzare `placehold.co` per le immagini di prova e placeholder per mantenere coerenza visiva durante lo sviluppo. Questo approccio è già visibile in componenti come `ServiceCard.tsx` e nella configurazione del sito `config/site.ts`.

**Struttura URL e Opzioni:**

L'URL base è `https://placehold.co/`. Puoi personalizzarlo come segue:

-   **Dimensioni:** Specificare come `{larghezza}x{altezza}` (es. `600x400`).
    -   Esempio: `https://placehold.co/600x400`
-   **Colori:** Aggiungere `/{coloreSfondo}/{coloreTesto}` dopo le dimensioni (es. `E2E8F0/A0AEC0` per sfondo grigio chiaro e testo grigio scuro). I colori sono codici esadecimali (senza `#`). Se omessi, verranno usati colori di default.
    -   Esempio: `https://placehold.co/300x200.png/000000/FFFFFF` (sfondo nero, testo bianco)
-   **Formato Immagine:** Puoi specificare `.png`, `.jpg`, `.webp` (es. `600x400.png`). Se omesso, di default è `.png`.
-   **Testo:** Aggiungere `?text={IlTuoTesto}` alla fine dell'URL.
    -   Se il testo contiene spazi o caratteri speciali, deve essere codificato (URL encoded). In JavaScript, utilizzare `encodeURIComponent()`.
    -   Esempio con testo semplice: `https://placehold.co/400x200.png?text=Anteprima`
    -   Esempio con testo, colori e formato: `https://placehold.co/500x300/E2E8F0/A0AEC0.png?text=Donna+Futura`
        (Nota: `+` è una codifica comune per lo spazio negli URL, `encodeURIComponent('Donna Futura')` produce `Donna%20Futura`)

2.  **Utilizzo Strumenti MCP (Model Context Protocol):**
  *   **GitHub:** Utilizzare `use_mcp_tool` con `server_name: "GitHub"`. I parametri principali da utilizzare sono:
    *   Owner: `Nebula-Studios`
    *   Repo: `IMM`




