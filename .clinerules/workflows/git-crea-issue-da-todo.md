# Workflow: Crea Issue GitHub da Commento TODO/FIXME

Questo workflow aiuta Cline a trovare commenti `// TODO:` o `// FIXME:` nel codice sorgente del progetto "Donna Futura Parrucchieri" e a facilitare la creazione di una issue GitHub corrispondente nel repository `Nebula-Studios/pulse`.

## Prerequisiti
- L'MCP Server per GitHub deve essere connesso e configurato.
- Repository GitHub: `owner: "Nebula-Studios"`, `repo: "pulse"`.

## Passaggi del Workflow

1.  **Ricerca Commenti TODO/FIXME:**
    *   *Utilizza lo strumento `search_files` per cercare pattern `// TODO:|// FIXME:` nei file sorgente (es. `.ts`, `.tsx`).*
    ```xml
    <search_files>
      <path>./</path> <!-- Cerca nell'intera root del progetto -->
      <regex>//\s*(TODO|FIXME):?\s*(.*)</regex>
      <file_pattern>*.{ts,tsx,js,jsx}</file_pattern> <!-- Estensioni file da includere -->
    </search_files>
    ```
    *Salva i risultati (elenco di match, con file, riga e testo del commento) come `foundTodos`.*
    *Se `foundTodos` è vuoto, informa l'utente e termina il workflow.*
    *Esempio: "Non ho trovato commenti TODO o FIXME nel progetto."*

2.  **Selezione TODO da Trasformare in Issue:**
    *   *Presenta i `foundTodos` all'utente in un formato leggibile (es. numerato).*
    *   *Esempio di presentazione:*
        ```
        Ho trovato i seguenti commenti TODO/FIXME:
        1. File: app/(main)/page.tsx, Riga: 25, Testo: // TODO: Implementare la logica di caricamento dati
        2. File: components/ui/button.tsx, Riga: 10, Testo: // FIXME: Gestire il caso disabled
        ...
        ```
    ```xml
    <ask_followup_question>
    <question>Ho trovato i seguenti commenti TODO/FIXME:
    {{#each foundTodos}}
    {{@index + 1}}. File: {{this.file}}, Riga: {{this.line}}, Testo: {{this.text}}
    {{/each}}
    Quale di questi vuoi trasformare in una issue GitHub? Inserisci il numero corrispondente, o "nessuno" per annullare.</question>
    </ask_followup_question>
    ```
    *Salva la scelta come `selectedTodoIndex`. Se "nessuno" o non valido, termina.*
    *Estrai il `selectedTodo` da `foundTodos` usando `selectedTodoIndex`.*

3.  **Richiesta Titolo Issue GitHub:**
    *   *Precompila il titolo con il testo del `selectedTodo.text`.*
    ```xml
    <ask_followup_question>
    <question>Quale titolo vuoi dare alla issue GitHub? (Default: "{{selectedTodo.text}}")</question>
    </ask_followup_question>
    ```
    *Salva la risposta come `issueTitle`. Se l'utente non inserisce nulla, usa `selectedTodo.text`.*

4.  **Richiesta Corpo/Descrizione Issue (opzionale):**
    ```xml
    <ask_followup_question>
    <question>Vuoi aggiungere una descrizione più dettagliata alla issue? Includi il riferimento al file e alla riga: `Riferimento: {{selectedTodo.file}}#L{{selectedTodo.line}}`. Se non vuoi aggiungere altro, lascia vuoto.</question>
    </ask_followup_question>
    ```
    *Salva la risposta come `issueBodyInput`. Costruisci `issueBody` concatenando il riferimento e `issueBodyInput`.*
    *`issueBody = "Riferimento nel codice: `{{selectedTodo.file}}#L{{selectedTodo.line}}`\n\n{{issueBodyInput}}"`*

5.  **Richiesta Etichette (opzionale):**
    ```xml
    <ask_followup_question>
    <question>Vuoi aggiungere delle etichette (labels) alla issue? Inserisci una lista separata da virgole (es. `bug, frontend, high-priority`). Lascia vuoto per nessuna etichetta.</question>
    </ask_followup_question>
    ```
    *Salva la risposta come `labelsInput`. Converte in array: `issueLabels = labelsInput ? labelsInput.split(',').map(l => l.trim()) : []`.*

6.  **Richiesta Assegnatari (opzionale):**
    ```xml
    <ask_followup_question>
    <question>Vuoi assegnare la issue a qualcuno? Inserisci i nomi utente GitHub separati da virgole. Lascia vuoto per non assegnare.</question>
    </ask_followup_question>
    ```
    *Salva la risposta come `assigneesInput`. Converte in array: `issueAssignees = assigneesInput ? assigneesInput.split(',').map(a => a.trim()) : []`.*

7.  **Creazione Issue GitHub:**
    *   *Utilizza lo strumento MCP GitHub `create_issue`.*
    ```xml
    <use_mcp_tool>
      <server_name>GitHub</server_name>
      <tool_name>create_issue</tool_name>
      <arguments>
        {
          "owner": "Nebula-Studios",
          "repo": "pulse",
          "title": "{{issueTitle}}",
          "body": "{{issueBody}}",
          "labels": "{{issueLabels}}", // Assicurati che sia un array di stringhe
          "assignees": "{{issueAssignees}}" // Assicurati che sia un array di stringhe
        }
      </arguments>
    </use_mcp_tool>
    ```
    *Salva il risultato (URL della issue creata o errore) come `createIssueResult`.*

8.  **Conferma Creazione Issue e Richiesta Rimozione Commento:**
    *   *Se la creazione è avvenuta con successo:*
        "Issue creata con successo: {{createIssueResult.html_url}}"
    ```xml
    <ask_followup_question>
    <question>L'issue GitHub è stata creata: {{createIssueResult.html_url}}. Vuoi che rimuova il commento `{{selectedTodo.text}}` dal file `{{selectedTodo.file}}` (riga {{selectedTodo.line}})?</question>
    <options>["Sì, rimuovi il commento", "No, lascia il commento"]</options>
    </ask_followup_question>
    ```
    *Salva la risposta come `removeCommentChoice`.*
    *   *Se la creazione fallisce:*
        "Errore durante la creazione dell'issue: {{createIssueResult.errorDetails}}"
        *Termina il workflow.*

9.  **Rimozione Commento TODO/FIXME (se richiesto):**
    *   *Se `removeCommentChoice` è "Sì, rimuovi il commento":*
    ```xml
    <replace_in_file>
      <path>{{selectedTodo.file}}</path>
      <diff>
      <<<<<<< SEARCH
{{selectedTodo.originalLineContent}} // La riga esatta contenente il commento TODO
=======
// La riga viene rimossa o commentata diversamente, es. con un link alla issue
// Issue: {{createIssueResult.html_url}}
>>>>>>> REPLACE
      </diff>
    </replace_in_file>
    ```
    *Informa l'utente: "Il commento TODO è stato rimosso/aggiornato in `{{selectedTodo.file}}`."*

---
**Note per l'implementazione di Cline:**
- La regex per `search_files` cattura il tipo (TODO/FIXME) e il testo del commento.
- La presentazione dei TODO trovati dovrebbe essere chiara per permettere una facile selezione.
- La gestione degli input opzionali (body, labels, assignees) deve essere robusta.
- Il `replace_in_file` per rimuovere il commento deve essere preciso per evitare modifiche indesiderate. Potrebbe essere più sicuro sostituire la riga con un commento che linka alla issue creata.
- `selectedTodo.originalLineContent` dovrebbe contenere l'intera riga di testo originale dove il TODO è stato trovato per il `SEARCH` block.
