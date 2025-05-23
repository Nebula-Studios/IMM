'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog.tsx';
import { Loader2 } from 'lucide-react';

// const MOD_ENABLER_NEXUS_URL = 'https://www.nexusmods.com/inzoi/mods/1'; // Non più usato direttamente qui

interface ModEnablerStatusNotifierProps {
  gameFolderPath: string | null | undefined;
}

export function ModEnablerStatusNotifier({
  gameFolderPath,
}: ModEnablerStatusNotifierProps) {
  const [isLoadingCheck, setIsLoadingCheck] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [statusChecked, setStatusChecked] = useState<boolean>(false);
  const [modEnablerError, setModEnablerError] = useState<string | null>(null);

  const checkStatus = useCallback(
    async (isRetry: boolean = false) => {
      // isLoadingCheck viene gestito dall'useEffect ora per il caricamento iniziale.
      // isInstalling gestisce il loader del pulsante.
      if (isRetry) {
        setIsInstalling(true);
      } else {
        // Se non è un retry, ma una chiamata diretta a checkStatus (es. dopo un'azione),
        // potremmo voler mostrare un loader se non è già attivo.
        // Per ora, l'useEffect gestisce il loader principale.
      }

      setModEnablerError(null);
      // Non nascondere il modale qui subito, ma dopo il check se tutto ok.

      try {
        if (!window.electronAPI) {
          throw new Error('electronAPI is not available on window object.');
        }

        // Non è più necessario leggere gameFolderPath qui, perché l'effetto lo controlla.
        // Ma se l'utente resetta il path e poi lo rimette, gameFolderPath nella prop cambierà
        // e l'effetto si riattiverà. La chiamata IPC qui è ancora necessaria per ottenere lo stato aggiornato.
        const currentStoredGameFolderPath =
          await window.electronAPI.getGameFolderPath();
        if (!currentStoredGameFolderPath) {
          // Questo caso dovrebbe essere gestito dall'useEffect basato sulla prop gameFolderPath.
          // Se siamo qui, significa che la prop gameFolderPath era valida ma ora lo store non lo è più,
          // il che è strano se l'effetto si basa sulla prop.
          console.warn(
            '[ModEnabler] checkStatus called but game folder path from store is now null/undefined.'
          );
          // Resettiamo lo stato per sicurezza, l'useEffect dovrebbe riallineare.
          setStatusChecked(false);
          setShowInstallModal(false);
          setIsLoadingCheck(false);
          setIsInstalling(false);
          return;
        }

        if (isRetry) {
          console.info(
            '[ModEnabler] Re-checking Mod Enabler status after install attempt...'
          );
        } else {
          console.info('[ModEnabler] Performing Mod Enabler check...');
        }

        const status = await window.electronAPI.checkModEnablerStatus();
        console.info('[ModEnabler] Mod Enabler Status:', status);

        if (status && status.checked) {
          setStatusChecked(true); // Imposta solo dopo un check IPC andato a buon fine
          if (status.dsoundExists && status.bitfixFolderExists) {
            setShowInstallModal(false); // Chiudi il modale se era aperto
            if (isRetry) {
              toast.success('Mod Enabler Installed!', {
                description: 'The InZOI Mod Enabler is now active.',
              });
            }
          } else {
            setModEnablerError(
              status.dsoundExists === false &&
                status.bitfixFolderExists === false
                ? 'Both dsound.dll and the bitfix folder are missing.'
                : status.dsoundExists === false
                  ? 'The dsound.dll file is missing.'
                  : 'The bitfix folder is missing or incomplete.'
            );
            setShowInstallModal(true);
          }
        } else if (status && !status.checked && status.error) {
          setStatusChecked(true); // Check IPC fatto, anche se con errore applicativo
          setModEnablerError(
            status.error || 'Could not complete Mod Enabler verification.'
          );
          setShowInstallModal(true);
        } else {
          // Non impostare statusChecked a true se l'IPC fallisce in modo imprevisto
          // Lascia che un tentativo successivo (se la logica lo permette) lo faccia.
          throw new Error('Invalid Mod Enabler status received from IPC.');
        }
      } catch (error: any) {
        console.error(
          '[ModEnabler] Failed to check Mod Enabler status (exception in checkStatus):',
          error
        );
        setModEnablerError(
          `Could not verify Mod Enabler status: ${error?.message || 'Unknown error'}`
        );
        // Non mostrare il modale qui per errori di sistema, ma un toast.
        // Lascia statusChecked com'era, così l'useEffect potrebbe riprovare se le condizioni cambiano.
        toast.error('Critical Mod Enabler Check Error', {
          description: `Could not verify Mod Enabler status: ${error?.message || 'Unknown error'}`,
        });
      } finally {
        // isLoadingCheck viene gestito principalmente dall'useEffect ora.
        // Se questa funzione è chiamata direttamente e non dall'effetto,
        // potremmo aver bisogno di un setIsLoadingCheck(false) qui, ma con cautela.
        // Per ora, l'effetto lo gestisce.
        setIsInstalling(false);
      }
    },
    [] // Rimuovo statusChecked dalle dipendenze, gestito da useEffect
  );

  useEffect(() => {
    if (gameFolderPath && !statusChecked) {
      console.log(
        '[ModEnabler] useEffect: gameFolderPath valid and status not checked. Initializing check.'
      );
      setIsLoadingCheck(true); // Mostra il loader a schermo intero
      const timerId = setTimeout(() => {
        checkStatus(false).finally(() => {
          setIsLoadingCheck(false); // Nascondi il loader dopo il check, indipendentemente dal risultato
        });
      }, 50); // Breve ritardo per UI update
      return () => clearTimeout(timerId);
    } else if (!gameFolderPath) {
      console.log(
        '[ModEnabler] useEffect: gameFolderPath is null/undefined. Resetting state.'
      );
      // Se il percorso del gioco viene rimosso o non è mai stato impostato
      setStatusChecked(false); // Permetti un nuovo check se il path viene impostato
      setShowInstallModal(false);
      setModEnablerError(null);
      setIsLoadingCheck(false); // Assicurati che il loader sia spento
    } else if (gameFolderPath && statusChecked) {
      console.log(
        '[ModEnabler] useEffect: gameFolderPath valid and status already checked. No action.'
      );
      setIsLoadingCheck(false); // Assicurati che il loader sia spento se era rimasto attivo
    }
  }, [gameFolderPath, statusChecked, checkStatus]);

  const handleInstallModEnabler = async () => {
    setIsInstalling(true);
    setModEnablerError(null);
    try {
      if (!window.electronAPI || !window.electronAPI.installModEnabler) {
        throw new Error('installModEnabler API is not available.');
      }
      const result = await window.electronAPI.installModEnabler();
      if (result.success) {
        // Non nascondere il modale o mostrare toast qui.
        // Lascia che checkStatus (chiamato dopo) aggiorni la UI.
        // Set statusChecked a false per forzare un re-check completo da useEffect
        // Oppure chiama direttamente checkStatus(true) e gestisci isLoadingCheck
        // Scegliamo di chiamare checkStatus(true) e lasciare che gestisca isInstalling
        await checkStatus(true);
      } else {
        setModEnablerError(
          result.error || 'An unknown error occurred during installation.'
        );
        // Lascia il modale aperto per mostrare l'errore
      }
    } catch (error: any) {
      console.error('[ModEnabler] Error installing Mod Enabler:', error);
      setModEnablerError(
        `Installation failed: ${error?.message || 'Unknown error'}`
      );
    } finally {
      setIsInstalling(false); // Già gestito da checkStatus se chiamato, ma ridondanza non nuoce
    }
  };

  if (isLoadingCheck && !showInstallModal) {
    // Mostra loader solo se il modale non è già visibile
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-neutral-900/90 backdrop-blur-sm">
        <Loader2 className="h-12 w-12 animate-spin text-blue-400 mb-6" />
        <p className="text-slate-200 text-xl font-medium">
          Verifying InZOI Mod Support...
        </p>
        <p className="text-slate-400 text-sm">Please wait a moment.</p>
      </div>
    );
  }

  if (showInstallModal) {
    return (
      <Dialog
        open={showInstallModal}
        onOpenChange={(openState: boolean) => {
          // Rinominato 'open' per chiarezza
          if (!openState) {
            setShowInstallModal(false);
            // Se l'utente chiude il modale manualmente, non consideriamo lo stato 'checked'
            // a meno che il mod enabler non sia effettivamente installato.
            // Per ora, chiudendolo non cambia statusChecked.
            // Se vogliamo che alla chiusura si tenti un recheck silenzioso:
            // if (!statusChecked) checkStatus(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-neutral-850 border-neutral-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-2xl text-orange-400">
              Mod Support Required
            </DialogTitle>
            <DialogDescription className="text-neutral-400 pt-2">
              The InZOI Mod Enabler is necessary to use mods with the game. It
              appears to be missing or not correctly installed in your game
              folder.
              {modEnablerError && (
                <p className="text-red-400 mt-2">Details: {modEnablerError}</p>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-neutral-300">
              Click the button below to automatically install the Mod Enabler
              files (dsound.dll and the 'bitfix' folder) into the correct game
              directory.
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              type="button"
              onClick={handleInstallModEnabler}
              disabled={isInstalling}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                  Installing...
                </>
              ) : (
                'Install Mod Enabler'
              )}
            </Button>
            {/* Potremmo aggiungere un pulsante "Chiudi" o "Ricordamelo più tardi" qui */}
            <Button
              variant="outline"
              onClick={() => setShowInstallModal(false)}
              disabled={isInstalling}
              className="w-full sm:w-auto mt-2 sm:mt-0 border-neutral-600 hover:bg-neutral-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null; // Non renderizzare nulla se tutto è a posto o il check non è attivo
}
