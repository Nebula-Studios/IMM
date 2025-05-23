import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  FC,
  DragEvent,
} from 'react';
import ModList from '../mod-management/ModList.tsx';
import { ModItem } from '../mod-management/ModCard.tsx';
import ModDropzone, { StagedModInfo } from '../mod-management/ModDropzone.tsx';
import { toast } from 'sonner';

/**
 * @file ModManagerLayout.tsx
 * @description Component provides the main UI structure for the mod manager,
 * featuring two columns for disabled and enabled mods.
 * The "Disabled Mods" column includes an integrated dropzone.
 */

interface ModManagerLayoutProps {
  // Props will be defined here in the future as needed
}

const ModManagerLayout: FC<ModManagerLayoutProps> = (props) => {
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stato per le liste di mod
  const [disabledMods, setDisabledMods] = useState<ModItem[]>([]);
  const [enabledMods, setEnabledMods] = useState<ModItem[]>([]);

  // Ref per tracciare se il caricamento iniziale è avvenuto
  const initialLoadDone = useRef(false);

  // NUOVO STATO per tracciare il drag sulla colonna dei mod disabilitati
  const [isDraggingOverDisabledColumn, setIsDraggingOverDisabledColumn] =
    useState(false);
  // NUOVO STATO per tracciare il drag sulla colonna dei mod abilitati
  const [isDraggingOverEnabledColumn, setIsDraggingOverEnabledColumn] =
    useState(false);

  // --- Context Menu Action Handlers ---
  const handleToggleEnableMod = async (
    modId: string,
    currentType: 'enabled' | 'disabled'
  ) => {
    if (currentType === 'disabled') {
      // Logic to enable (move from disabled to enabled)
      const modToEnable = disabledMods.find((mod) => mod.id === modId);
      if (modToEnable) {
        console.log(
          `[ContextMenu] Enabling mod: ${modToEnable.name} (path: ${modToEnable.path})`
        );
        try {
          const result = await window.electronAPI.enableMod(
            modToEnable.path,
            modToEnable.name
          );
          if (result.success) {
            setEnabledMods((prev) => [...prev, modToEnable]);
            setDisabledMods((prev) => prev.filter((mod) => mod.id !== modId));
            toast.success(
              `Mod "${modToEnable.name}" enabled via context menu.`
            );
          } else {
            toast.error(
              `Failed to enable mod "${modToEnable.name}": ${result.error}`
            );
          }
        } catch (error: any) {
          toast.error(
            `Error enabling mod "${modToEnable.name}": ${error.message}`
          );
        }
      }
    } else {
      // Logic to disable (move from enabled to disabled)
      const modToDisable = enabledMods.find((mod) => mod.id === modId);
      if (modToDisable) {
        console.log(
          `[ContextMenu] Disabling mod: ${modToDisable.name} (path: ${modToDisable.path})`
        );
        try {
          // La funzione disableMod si aspetta il nome base del mod (es. MyMod) non MyMod.pak
          const fileName =
            modToDisable.path.split(/[\\/]/).pop() || modToDisable.name;
          const baseName = fileName.replace(/\.pak$/, '');
          const result = await window.electronAPI.disableMod(baseName);

          if (result.success) {
            setDisabledMods((prev) => [...prev, modToDisable]);
            setEnabledMods((prev) => prev.filter((mod) => mod.id !== modId));
            toast.success(
              `Mod "${modToDisable.name}" disabled via context menu.`
            );
          } else {
            toast.error(
              `Failed to disable mod "${modToDisable.name}": ${result.error}`
            );
          }
        } catch (error: any) {
          toast.error(
            `Error disabling mod "${modToDisable.name}": ${error.message}`
          );
        }
      }
    }
  };

  const handleRenameMod = (modId: string, currentName: string) => {
    console.log(
      `[ContextMenu] Rename requested for mod: ${currentName} (ID: ${modId})`
    );
    toast.info(
      `Rename functionality for "${currentName}" is not yet implemented.`,
      {
        description:
          'This feature will be available in a future update (Phase 2.4).',
      }
    );
    // TODO: Implement rename logic (Phase 2.4)
    // - Show a dialog to get new name
    // - Call an IPC handler to rename files on disk (staging)
    // - Update mod item in state (disabledMods/enabledMods)
    // - Potentially re-save lists
  };

  const handleRemoveMod = (modId: string, modName: string) => {
    console.log(
      `[ContextMenu] Remove requested for mod: ${modName} (ID: ${modId})`
    );
    toast.info(
      `Remove functionality for "${modName}" is not yet implemented.`,
      {
        description:
          'This feature will be available in a future update (Phase 2.5).',
      }
    );
    // TODO: Implement remove logic (Phase 2.5)
    // - Confirm with user
    // - Call an IPC handler to delete files from staging directory
    // - Remove mod item from state (disabledMods/enabledMods)
    // - Potentially re-save lists
  };
  // --- END Context Menu Action Handlers ---

  // Callback per ModDropzone: ora riceve StagedModInfo[] dal backend via ModDropzone
  const handleModsProcessedAndStagedCallback = useCallback(
    (stagedMods: StagedModInfo[]) => {
      console.log(
        '[ModManagerLayout] Staged mod info received from ModDropzone:',
        stagedMods
      );
      setIsDraggingOverDisabledColumn(false); // Resetta lo stato di dragging dopo il drop

      const newMods: ModItem[] = stagedMods
        // Filtra per assicurarsi che pakPath esista (dovrebbe sempre esserci se success è true da processDroppedMods)
        .filter((modInfo) => modInfo.pakPath && modInfo.pakPath.trim() !== '')
        .map((modInfo) => ({
          id: modInfo.pakPath, // USA IL PATH NELLA STAGING COME ID
          name: modInfo.name, // Nome base del mod (es. MyMod)
          path: modInfo.pakPath, // USA IL PATH NELLA STAGING COME PATH PRINCIPALE DEL MOD
          // originalPath: modInfo.originalPath, // Potremmo salvarlo se utile per debug o future features
        }));

      if (newMods.length > 0) {
        setDisabledMods((prevDisabledMods) => {
          const currentIds = new Set(prevDisabledMods.map((mod) => mod.id));
          // Filtra per evitare di aggiungere duplicati se per qualche motivo la callback viene chiamata più volte
          // con gli stessi mod (anche se ModDropzone dovrebbe prevenire chiamate multiple per lo stesso drop)
          const trulyNewMods = newMods.filter(
            (newMod) => !currentIds.has(newMod.id)
          );
          if (trulyNewMods.length > 0) {
            // Non mostriamo un toast qui perché ModDropzone lo fa già in modo più granulare
            // toast.success(`${trulyNewMods.length} new mod(s) added to the list.`);
            return [...prevDisabledMods, ...trulyNewMods];
          }
          return prevDisabledMods;
        });
      }
    },
    []
  );

  const existingModPaths = React.useMemo(() => {
    const disabledPaths = disabledMods
      .map((mod) => mod.path)
      .filter((path) => path) as string[];
    const enabledPaths = enabledMods
      .map((mod) => mod.path)
      .filter((path) => path) as string[];
    return [...disabledPaths, ...enabledPaths];
  }, [disabledMods, enabledMods]);

  // Event handlers per la colonna Disabled Mods
  const handleDragEnterDisabled = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      // Verifica che l'elemento trascinato sia un file (o un gruppo di files)
      if (e.dataTransfer.types.includes('Files')) {
        setIsDraggingOverDisabledColumn(true);
      }
    },
    []
  );

  const handleDragLeaveDisabled = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      // Controlla se il mouse sta lasciando verso un figlio della dropzone (non vogliamo chiuderla in quel caso)
      // Questo può essere complicato. Un approccio più semplice è affidarsi a onDrop o a un timeout.
      // Per ora, un drag leave diretto sull'area principale la nasconde.
      // Se il target dell'evento non è più dentro l'area del disabled panel
      if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
      }
      setIsDraggingOverDisabledColumn(false);
    },
    []
  );

  const handleDragOverAnyColumn = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessario per permettere il drop
    // Potremmo voler dare un feedback visivo qui, ad esempio cambiando il bordo della colonna
  };

  const handleDropOnEnabledColumn = async (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setIsDraggingOverEnabledColumn(false); // Resetta feedback visivo
    const modId = event.dataTransfer.getData('text/plain');
    const modToEnable = disabledMods.find((mod) => mod.id === modId);

    if (modToEnable) {
      console.log(
        `Enabling mod: ${modToEnable.name} (path: ${modToEnable.path})`
      );
      try {
        const result = await window.electronAPI.enableMod(
          modToEnable.path,
          modToEnable.name
        );
        if (result.success) {
          setEnabledMods((prev) => [...prev, modToEnable]);
          setDisabledMods((prev) => prev.filter((mod) => mod.id !== modId));
          toast.success(`Mod "${modToEnable.name}" enabled successfully.`);
        } else {
          toast.error(
            `Failed to enable mod "${modToEnable.name}": ${result.error}`
          );
        }
      } catch (error: any) {
        console.error('Error calling enableMod:', error);
        toast.error(
          `Error enabling mod "${modToEnable.name}": ${error.message}`
        );
      }
    }
  };

  const handleDropOnDisabledColumn = async (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setIsDraggingOverDisabledColumn(false); // Resetta feedback visivo

    const modId = event.dataTransfer.getData('text/plain');
    const modToDisable = enabledMods.find((mod) => mod.id === modId);

    if (modToDisable) {
      console.log(`Disabling mod: ${modToDisable.name}`);
      try {
        const result = await window.electronAPI.disableMod(modToDisable.name);
        if (result.success) {
          setDisabledMods((prev) => [...prev, modToDisable]);
          setEnabledMods((prev) => prev.filter((mod) => mod.id !== modId));
          toast.success(`Mod "${modToDisable.name}" disabled successfully.`);
        } else {
          toast.error(
            `Failed to disable mod "${modToDisable.name}": ${result.error}`
          );
        }
      } catch (error: any) {
        console.error('Error calling disableMod:', error);
        toast.error(
          `Error disabling mod "${modToDisable.name}": ${error.message}`
        );
      }
    } else if (event.dataTransfer.types.includes('Files')) {
      console.log(
        'File drop detected on disabled column, ModDropzone should handle it.'
      );
      // La logica di ModDropzone (attraverso l'overlay) gestirà l'aggiunta di nuovi file.
      // L'overlay appare a causa di handleDragEnterDisabled e isDraggingOverDisabledColumn.
      // handleModsProcessedAndStagedCallback (chiamato da ModDropzone) resetterà isDraggingOverDisabledColumn.
    }
  };

  // Gestione del ridimensionamento (invariata)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      let newLeftWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;
      const minWidth = 30;
      const maxWidth = 70;
      newLeftWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth));
      setLeftPanelWidth(newLeftWidth);
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Caricamento iniziale delle liste di mod
  useEffect(() => {
    const loadAndSyncData = async () => {
      initialLoadDone.current = false; // Resetta prima di iniziare il caricamento
      try {
        console.log(
          '[ModManagerLayout] Attempting to synchronize mod states from backend...'
        );
        // Chiama il nuovo handler IPC per la sincronizzazione completa
        const syncResult = await window.electronAPI.syncModStates();

        if (syncResult.success) {
          const finalDisabledMods = syncResult.disabledMods || [];
          const finalEnabledMods = syncResult.enabledMods || [];

          setDisabledMods(finalDisabledMods);
          setEnabledMods(finalEnabledMods);

          toast.info('Mod status synchronized with storage and file system.', {
            duration: 2500,
          });
          console.log(
            `[ModManagerLayout] Synchronization successful. Final lists - Disabled: ${finalDisabledMods.length}, Enabled: ${finalEnabledMods.length}`
          );
        } else {
          toast.error(`Failed to synchronize mod states: ${syncResult.error}`);
          console.error(
            '[ModManagerLayout] Failed to synchronize mod states:',
            syncResult.error
          );
          setDisabledMods([]); // Resetta in caso di errore di sincronizzazione
          setEnabledMods([]);
        }
      } catch (error: any) {
        toast.error(
          `Critical error during mod state synchronization: ${error.message}`
        );
        console.error(
          '[ModManagerLayout] Critical error during mod state synchronization:',
          error
        );
        setDisabledMods([]); // Resetta in caso di errore critico
        setEnabledMods([]);
      }
      initialLoadDone.current = true;
    };

    loadAndSyncData();
  }, []); // Esegui solo al montaggio del componente

  // Salvataggio delle liste di mod nello store quando cambiano
  useEffect(() => {
    // Non salvare prima che il caricamento iniziale sia completato
    // o se entrambe le liste sono vuote (potrebbe essere lo stato iniziale prima del caricamento)
    if (!initialLoadDone.current) {
      return;
    }

    // Opzionale: Non salvare se entrambe le liste sono ancora vuote dopo il tentativo di caricamento.
    // Questo previene di sovrascrivere uno store potenzialmente valido con liste vuote se il caricamento fallisce
    // ma initialLoadDone.current diventa true. Tuttavia, il caricamento di default restituisce [] in caso di errore.
    // if (disabledMods.length === 0 && enabledMods.length === 0 && !initialLoadDone.current) {
    //   return;
    // }

    const saveLists = async () => {
      try {
        console.log(
          `[ModManagerLayout] Attempting to save mod lists. Disabled: ${disabledMods.length}, Enabled: ${enabledMods.length}`
        );
        const result = await window.electronAPI.saveModLists({
          disabledMods,
          enabledMods,
        });
        if (result.success) {
          console.log('[ModManagerLayout] Mod lists saved successfully.');
          // Potremmo mostrare un toast qui, ma potrebbe essere troppo frequente.
          // toast.success('Mod lists saved!', { duration: 2000 });
        } else {
          toast.error(`Failed to save mod lists: ${result.error}`);
          console.error(
            '[ModManagerLayout] Failed to save mod lists:',
            result.error
          );
        }
      } catch (error: any) {
        toast.error(`Error saving mod lists: ${error.message}`);
        console.error('[ModManagerLayout] Error saving mod lists:', error);
      }
    };
    // Un debounce qui sarebbe ideale per evitare chiamate troppo frequenti
    saveLists();
  }, [disabledMods, enabledMods]); // Esegui quando le liste cambiano

  return (
    <div className={`flex flex-col h-full text-white`}>
      <div className="flex flex-col flex-1 px-4 py-4 overflow-hidden">
        <div ref={containerRef} className="flex flex-1 h-full space-x-1">
          {/* Colonna Mod Disabilitati - ora con gestione drag & drop */}
          <div
            style={{ width: `${leftPanelWidth}%` }}
            className="h-full flex flex-col relative bg-neutral-900/60 p-3 md:p-4 rounded-lg shadow-lg border border-neutral-700" // Aggiunto relative e stili base
            onDragEnter={handleDragEnterDisabled}
            onDragOver={handleDragOverAnyColumn} // MODIFICATO per usare il gestore generico
            onDragLeave={handleDragLeaveDisabled}
            onDrop={handleDropOnDisabledColumn} // MODIFICATO per nuova logica
          >
            <h2 className="text-lg md:text-xl font-semibold mb-3 text-slate-200 border-b border-neutral-700 pb-2 select-none">
              Disabled Mods
            </h2>
            <div className="overflow-y-auto flex-grow pr-1 min-h-0">
              {' '}
              {/* Aggiunto min-h-0 per flexbox */}
              <ModList
                title="Disabled Mods"
                mods={disabledMods}
                type="disabled"
                onToggleEnable={handleToggleEnableMod}
                onRename={handleRenameMod}
                onRemove={handleRemoveMod}
              />
            </div>

            {/* Dropzone Overlay per l'aggiunta di nuovi mod */}
            {isDraggingOverDisabledColumn && (
              <div
                className="absolute inset-0 bg-neutral-900/70 flex items-center justify-center z-10"
                onDragLeave={(e) => {
                  // Simile a handleDragLeaveDisabled, per evitare che scompaia se ci si muove su elementi figli dell'overlay
                  if (e.currentTarget.contains(e.relatedTarget as Node)) {
                    return;
                  }
                  setIsDraggingOverDisabledColumn(false);
                }}
              >
                <ModDropzone
                  onModsProcessedAndStaged={
                    handleModsProcessedAndStagedCallback
                  }
                  // existingModPaths={existingModPaths} // Non più necessario
                />
              </div>
            )}
          </div>

          {/* Resizer */}
          <div
            className="w-4 cursor-col-resize flex items-center justify-center group h-full select-none"
            onMouseDown={handleMouseDown}
          >
            <div className="w-1.5 h-5/6 bg-neutral-700 group-hover:bg-neutral-300 transition-colors duration-150 rounded-full" />
          </div>

          {/* Colonna Mod Abilitati */}
          <div
            style={{ width: `${100 - leftPanelWidth}%` }}
            className="h-full flex flex-col bg-neutral-900/90 p-3 md:p-4 rounded-lg border border-neutral-700" // Stili base
            onDragOver={handleDragOverAnyColumn} // NUOVO
            onDrop={handleDropOnEnabledColumn} // NUOVO
          >
            <h2 className="text-lg md:text-xl font-semibold mb-3 text-slate-200 border-b border-neutral-700 pb-2 select-none">
              Enabled Mods
            </h2>
            <div className="overflow-y-auto flex-grow pr-1 min-h-0">
              {' '}
              {/* Aggiunto min-h-0 */}
              <ModList
                title="Enabled Mods"
                mods={enabledMods}
                type="enabled"
                onToggleEnable={handleToggleEnableMod}
                onRename={handleRenameMod}
                onRemove={handleRemoveMod}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModManagerLayout;
