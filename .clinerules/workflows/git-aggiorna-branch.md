# Workflow: Aggiorna Branch Locale (Fetch & Pull)

Questo workflow guida Cline nell'aggiornamento di un branch locale eseguendo `git fetch` e `git pull` per il progetto "Donna Futura Parrucchieri", tentando di automatizzare la selezione del branch.

## Passaggi del Workflow

1.  **Richiesta Nome Remoto:**
    ```xml
    <ask_followup_question>
    <question>Qual è il nome del repository remoto da cui fare fetch e pull? (Default: `origin`)</question>
    </ask_followup_question>
    ```
    *Salva la risposta come `remoteName`. Se l'utente non inserisce nulla, usa `origin`.*

2.  **Determinazione e Conferma Nome Branch:**
    *   **(Azione per Cline - Fase 1: Auto-rilevamento):**
        1.  Esegui `git rev-parse --abbrev-ref HEAD` per ottenere il branch corrente.
        2.  Salva l'output come `autoDetectedBranch`. Se il comando fallisce o restituisce "HEAD" (indicando uno stato detached), considera `autoDetectedBranch` come non disponibile.
        3.  *Questa è un'istruzione per Cline su come agire, non un comando letterale nel workflow eseguito direttamente dall'utente.*
    *   **(Fase 2: Interazione con l'utente):**
        ```xml
        <ask_followup_question>
        <question>{{if autoDetectedBranch}}Il branch corrente rilevato è `{{autoDetectedBranch}}`. Per aggiornare questo branch, premi Invio (o scrivi '{{autoDetectedBranch}}'). Altrimenti, specifica il nome del branch desiderato.{{else}}Non è stato possibile rilevare automaticamente il branch corrente. Specifica il nome del branch che vuoi aggiornare.{{/if}}</question>
        </ask_followup_question>
        ```
        *Salva la risposta dell'utente come `userInputBranchName`.*
    *   **(Azione per Cline - Fase 3: Determinazione finale di `branchName`):**
        *   Se `userInputBranchName` non è vuoto, allora `branchName = userInputBranchName`.
        *   Altrimenti (se `userInputBranchName` è vuoto), se `autoDetectedBranch` è disponibile e non è "HEAD", allora `branchName = autoDetectedBranch`.
        *   Se, dopo questi passaggi, `branchName` non è definito o è "HEAD", Cline deve informare l'utente che un nome di branch valido è necessario e terminare il workflow o chiedere di nuovo in modo esplicito. Per questo workflow, si assume che Cline gestirà questa eventualità prima di procedere ai comandi git.

3.  **Esecuzione `git fetch`:**
    *   *Assicurati che `remoteName` sia definito.*
    ```xml
    <ask_followup_question>
    <question>Sto per eseguire `git fetch {{remoteName}}`. Confermi?</question>
    <options>["Sì, procedi", "No, annulla"]</options>
    </ask_followup_question>
    ```
    *Se la risposta è "Sì, procedi":*
    ```xml
    <execute_command>
      <command>git fetch {{remoteName}}</command>
      <requires_approval>true</requires_approval>
    </execute_command>
    ```
    *Analizza l'output. Se errore, informa l'utente e chiedi se continuare con il pull.*

4.  **Esecuzione `git pull`:**
    *   *Assicurati che `remoteName` e `branchName` siano definiti e validi.*
    ```xml
    <ask_followup_question>
    <question>Sto per eseguire `git pull {{remoteName}} {{branchName}}`. Confermi?</question>
    <options>["Sì, procedi", "No, annulla"]</options>
    </ask_followup_question>
    ```
    *Se la risposta è "Sì, procedi":*
    ```xml
    <execute_command>
      <command>git pull {{remoteName}} {{branchName}}</command>
      <requires_approval>true</requires_approval>
    </execute_command>
    ```
    *Analizza l'output.*

5.  **Conferma Operazione:**
    *   *Comunica all'utente l'esito delle operazioni.*
    *   *Esempio (successo): "Il branch `{{branchName}}` è stato aggiornato con successo da `{{remoteName}}`."*
    *   *Esempio (fallimento/parziale): "Completato `git fetch`. Si è verificato un errore durante `git pull {{remoteName}} {{branchName}}`: [dettagli errore]." *

---
**Note per l'implementazione di Cline:**
- Cline deve implementare la logica di auto-rilevamento del branch e la determinazione finale di `branchName` come descritto nel Passaggio 2.
- Se `branchName` non può essere determinato in modo valido, il workflow non dovrebbe procedere all'esecuzione di `git pull`.
- Tutti i comandi Git che modificano lo stato del repository o interagiscono con il remoto richiedono `requires_approval: true`.
- Fornire un feedback chiaro basato sull'output dei comandi.
