# Workflow: Aggiungi, Committa e Push Modifiche (con Messaggio Autogenerato)

Questo workflow guida Cline nel processo di aggiunta delle modifiche all'area di staging, commit (con messaggio autogenerato o fornito) e push verso un repository remoto per il progetto "Donna Futura Parrucchieri".

## Prerequisiti

- Linee guida per i messaggi di commit: `.cursor/rules/clean-code-guidelines.mdc` (Conventional Commits).

## Passaggi del Workflow

1.  **Selezione File da Aggiungere allo Staging:**

    ```xml
    <ask_followup_question>
    <question>Come vuoi aggiungere i file all'area di staging?
    1. Tutti i file modificati e nuovi (`git add .`)
    2. Specifica i file (elencali o taggali nella prossima risposta)</question>
    <options>["Tutti i file (git add .)", "Specifica i file da aggiungere"]</options>
    </ask_followup_question>
    ```

    _Salva la risposta come `addFilesChoice`._

2.  **Esecuzione `git add`:**

    - _Se `addFilesChoice` è "Tutti i file (git add .)":_
      ```xml
      <execute_command>
        <command>git add .</command>
        <requires_approval>true</requires_approval>
      </execute_command>
      ```
    - _Se `addFilesChoice` è "Specifica i file da aggiungere":_
      ``xml
    <ask_followup_question>
    <question>Per favore, elenca o tagga i file e/o le directory che vuoi aggiungere allo staging (separati da spazi). Esempio: `src/components/Button.tsx src/utils/helpers.ts README.md`</question>
    </ask_followup_question>
    ``
      _Salva la risposta come `filesToAddString`._
      _Cline dovrà parsare `filesToAddString` per ottenere un elenco di file/directory._
      _Costruisci il comando: `git add {{parsedFilesList}}`._
      `xml
    <execute_command>
      <command>git add {{filesToAddString}}</command> <!-- Cline sostituirà {{filesToAddString}} con i file effettivi -->
      <requires_approval>true</requires_approval>
    </execute_command>
    `
      _Analizza l'output del comando `git add`. Se ci sono errori (es. file non trovati), informa l'utente._

3.  **Verifica Modifiche Staged (Post `git add`):**

    - Esegui `git status --porcelain` per verificare se ci sono modifiche staged dopo il `git add`.

    ```xml
    <execute_command>
      <command>git status --porcelain</command>
      <requires_approval>false</requires_approval>
    </execute_command>
    ```

    _Analizza l'output. Se nessuna riga inizia con 'M ', 'A ', 'D ', 'R ', 'C ' nella prima colonna (indicando modifiche staged), informa l'utente che nessun file è stato effettivamente aggiunto allo staging e termina il workflow o chiedi se vuole riprovare il `git add`._
    _Esempio: "Nessun file è stato aggiunto all'area di staging. Verifica i percorsi o lo stato dei file e riprova."_

4.  **Analisi Modifiche Staged e Generazione Proposta Messaggio di Commit:**

    - **Azione per Cline (IA):**
      1.  Esegui `git diff --staged --name-status` per ottenere un elenco dei file modificati e il tipo di modifica.
          _Salva l'output come `nameStatusOutput`._
      2.  Genera un file di patch con le modifiche staged:
          ```xml
          <execute_command>
            <command>git diff --staged --patch > .git/cline_staged_diff.patch</command>
            <requires_approval>false</requires_approval> <!-- Output is to a file, not stdout, so direct approval might not be needed here. Approval for the commit itself is later. -->
          </execute_command>
          ```
      3.  Leggi il contenuto del file di patch:
          ```xml
          <read_file>
            <path>.git/cline_staged_diff.patch</path>
          </read_file>
          ```
          _Salva il contenuto come `stagedDiffContent`._
      4.  Elimina il file di patch temporaneo (assicurati che il comando di eliminazione sia appropriato per l'ambiente di esecuzione, es. `rm` o `del`):
          ```xml
          <execute_command>
            <command>rm .git/cline_staged_diff.patch</command> <!-- Su Windows, potrebbe essere 'del .git\\cline_staged_diff.patch' se 'rm' non è disponibile -->
            <requires_approval>false</requires_approval> <!-- Deleting a temp file, low risk. -->
          </execute_command>
          ```
      5.  Analizza `nameStatusOutput` e `stagedDiffContent` insieme alle linee guida in `.cursor/rules/clean-code-guidelines.mdc` (sezione "Messaggi di Commit").
      6.  Determina il `tipo` più appropriato (feat, fix, chore, docs, refactor, ecc.).
      7.  Determina uno `scope` (opzionale) basato sui percorsi dei file modificati.
      8.  Genera una `descrizione` breve e imperativa.
      9.  Genera un `corpo` (opzionale) se le modifiche sono complesse.
      10. Genera un `footer` (opzionale) per BREAKING CHANGES o per chiudere issue.
      11. Componi il messaggio di commit completo (`{{commitType}}({{commitScope}}): {{commitDescription}}\n\n{{commitBody}}\n\n{{commitFooter}}`).
    - _Salva il messaggio generato come `generatedCommitMessage`._

5.  **Conferma o Modifica Messaggio di Commit Generato:**
    ```xml
    <ask_followup_question>
    <question>Ho analizzato le modifiche staged e ho generato il seguente messaggio di commit:
    ```

---

## {{generatedCommitMessage}}

Vuoi usare questo messaggio, modificarlo, o fornire il tuo?</question>
<options>["Sì, usa questo messaggio", "Voglio modificare questo messaggio", "Voglio scrivere un messaggio da zero", "Annulla commit"]</options>
</ask_followup_question>
```    *Salva la risposta come`commitMessageChoice`.*
    *Se "Annulla commit", termina il workflow.*
    *Se "Sì, usa questo messaggio", `finalCommitMessage = generatedCommitMessage`.\*

6.  **Gestione Modifica o Inserimento Manuale Messaggio (se necessario):**
    - _Se `commitMessageChoice` è "Voglio modificare questo messaggio":_
      ```xml
      <ask_followup_question>
      <question>Ecco il messaggio generato. Modificalo come preferisci e poi conferma:
      ```

---

{{generatedCommitMessage}}
---</question>
<input_type>textarea</input_type>
</ask_followup_question>
``         *Salva il messaggio modificato come `finalCommitMessage`.*
    *   *Se `commitMessageChoice` è "Voglio scrivere un messaggio da zero":*
        ``xml
<ask_followup_question>
<question>Per favore, scrivi il messaggio di commit completo, rispettando le Conventional Commits (tipo, scope opzionale, descrizione, corpo opzionale, footer opzionale):</question>
<input_type>textarea</input_type>
</ask_followup_question>
```        *Salva il messaggio inserito come`finalCommitMessage`.\*

7.  **Esecuzione `git commit`:**

    - _Assicurati che `finalCommitMessage` sia definito._

    ```xml
    <execute_command>
      <command>echo "{{finalCommitMessage}}" | git commit -F -</command>
      <requires_approval>true</requires_approval>
    </execute_command>
    ```

    _Analizza l'output. Se errore, informa l'utente e chiedi se continuare con il push._

8.  **Richiesta Push:**

    - _Se il commit ha avuto successo:_

    ```xml
    <ask_followup_question>
    <question>Commit creato con successo. Vuoi eseguire `git push` ora?</question>
    <options>["Sì, esegui push", "No, non ora"]</options>
    </ask_followup_question>
    ```

    _Salva la risposta come `pushChoice`._

9.  **Esecuzione `git push` (se richiesto):**

    - _Se `pushChoice` è "Sì, esegui push":_

    ```xml
    <execute_command>
      <command>git push</command>
      <requires_approval>true</requires_approval>
    </execute_command>
    ```

    _Analizza l'output._

10. **Conferma Operazione Finale:**
    - _Comunica all'utente l'esito delle operazioni._
    - _Esempio: "File aggiunti. Commit creato. Push completato con successo."_

---

**Note per l'implementazione di Cline:**

- Cline deve interpretare correttamente i file forniti dall'utente quando si sceglie "Specifica i file".
- Il Passaggio 4 (generazione messaggio) è cruciale e richiede l'IA di Cline.
- L'uso di `echo "messaggio" | git commit -F -` è raccomandato.
- Rispettare `requires_approval: true` per tutti i comandi Git che modificano lo stato o interagiscono con il remoto.
