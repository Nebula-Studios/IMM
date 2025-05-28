import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  FC,
  // DragEvent, // Rimosso perché useremo dnd-kit per il drag tra colonne
} from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter, // Modificato da closestCorners
  useSensor,
  useSensors,
  DragOverlay, // Per un feedback di trascinamento migliore
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import ModList from '../mod-management/ModList.tsx';
import ModCard, { ModItem } from '../mod-management/ModCard.tsx'; // Importa ModCard per DragOverlay
import ModDropzone, { StagedModInfo } from '../mod-management/ModDropzone.tsx';
import { toast } from 'sonner';
import { ArrowUpDown } from 'lucide-react'; // Importa l'icona
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip.tsx'; // Importa i componenti Tooltip

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

  // Stato per dnd-kit
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null); // Per DragOverlay

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
          const stagingDirectoryName = modToEnable.path.split(/[\\/]/).slice(-2, -1)[0];
          const result = await window.electronAPI.enableMod(
            modToEnable.path, // Path del .pak nello staging
            stagingDirectoryName // Nome della cartella nello staging (senza .pak)
          );
          if (result.success && result.newPath) {
            const enabledModItem: ModItem = {
              ...modToEnable,
              activePath: result.newPath, // Salva il percorso attivo nella directory ~mods
            };
            setEnabledMods((prev) => [...prev, enabledModItem]);
            setDisabledMods((prev) => prev.filter((mod) => mod.id !== modId));
            toast.success(
              `Mod "${modToEnable.name}" enabled via context menu. Active path: ${result.newPath}`
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
          `[ContextMenu] Disabling mod: ${modToDisable.name} (activePath: ${modToDisable.activePath})`
        );
        try {
          if (!modToDisable.activePath) {
            toast.error(`Mod "${modToDisable.name}" does not have an active path. Cannot disable properly.`);
            console.error(`[ContextMenu] Mod "${modToDisable.name}" (ID: ${modId}) is missing activePath.`);
            return;
          }

          const stagingDirectoryName = modToDisable.path.split(/[\\/]/).slice(-2, -1)[0];
          console.log(
            `[ContextMenu] Extracted stagingDirectoryName for disable: ${stagingDirectoryName}`
          );

          const disableResult = await window.electronAPI.disableMod(stagingDirectoryName);

          if (disableResult.success) {
            toast.success(
              `Mod "${modToDisable.name}" directory removed from game folder.`
            );

            const { activePath, ...restOfModToDisable } = modToDisable;
            setDisabledMods((prev) => [...prev, restOfModToDisable]);

            const remainingEnabledMods = enabledMods.filter((mod) => mod.id !== modId);

            if (remainingEnabledMods.length > 0) {
              console.log('[ContextMenu] Calling handleEnabledModOrderChange to re-evaluate order and names after disabling a mod.');
              await handleEnabledModOrderChange([...remainingEnabledMods], `Disable mod ${modToDisable.name} and reorder/rename`);
            } else {
              setEnabledMods([]);
              console.log('[ContextMenu] No enabled mods left after disabling. List cleared.');
              // L'useEffect su [disabledMods, enabledMods] dovrebbe salvare le liste.
            }
            // Il toast di successo per la disabilitazione e la potenziale rinumerazione
            // è gestito da disableResult e da handleEnabledModOrderChange.
          } else {
            toast.error(
              `Failed to disable mod "${modToDisable.name}" (remove directory): ${disableResult.error}`
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

  // Rimosso handleReorderEnabledMod perché il riordino è gestito da dnd-kit e handleEnabledModOrderChange

  const handleEnabledModOrderChange = async (newOrderedMods: ModItem[], operationDebugInfo?: string) => {
    console.log(`[handleEnabledModOrderChange] Called. Operation: ${operationDebugInfo || 'N/A'}. New order preview:`, newOrderedMods.map(m => m.id));

    // Aggiornamento ottimistico dell'UI
    setEnabledMods(newOrderedMods);

    // Verifica che tutti i mod abbiano activePath prima di inviare al backend
    const allModsHaveActivePath = newOrderedMods.every(mod => mod.activePath && mod.activePath.trim() !== '');
    if (!allModsHaveActivePath) {
      toast.error(
        'Error: Some enabled mods are missing their active path. Cannot update order on backend.'
      );
      console.error(
        'Error: Some enabled mods are missing activePath before sending to backend for order update.',
        newOrderedMods
      );
      // Considerare se ripristinare l'ordine precedente o gestire diversamente.
      // Per ora, l'UI rimane aggiornata ottimisticamente ma il backend non verrà chiamato.
      return;
    }

    try {
      const result = await window.electronAPI.updateModOrder(newOrderedMods);
      if (result.success && result.updatedMods) {
        toast.success('Mod order updated successfully on backend.');
        // Sincronizza lo stato con i dati aggiornati dal backend (che includono activePath corretti)
        setEnabledMods(result.updatedMods);
      } else {
        toast.error(`Failed to update mod order on backend: ${result.error || 'Unknown error'}`);
        console.error('Failed to update mod order on backend:', result.error);
        // Se il backend fallisce, potremmo voler ripristinare l'ordine precedente
        // Per farlo, avremmo bisogno di conservare lo stato `enabledMods` prima dell'aggiornamento ottimistico.
        // Per semplicità, per ora non lo facciamo, ma è una considerazione per la robustezza.
        // Esempio: setEnabledMods(previousEnabledModsState);
      }
    } catch (error: any) {
      toast.error(`Error calling updateModOrder IPC: ${error.message}`);
      console.error('IPC error updating mod order:', error);
      // Anche qui, considerare il ripristino dello stato precedente.
    }
  };
  // --- END Context Menu Action Handlers ---

  // --- DND KIT SENSORS ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      // Opzionale: configurare coordinate per la tastiera se necessario
      // coordinateGetter: sortableKeyboardCoordinates, // Se si usa sortableKeyboardCoordinates, importarlo da @dnd-kit/sortable
    }),
  );

  // --- DND KIT DRAG HANDLERS ---
  const handleDragStart = (event: { active: { id: UniqueIdentifier } }) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) {
      console.log('[DND] Drag ended but no "over" target. Active ID was:', active.id);
      return;
    }

    const activeModId = active.id as string;
    const rawOverId = over.id as string; // ID della colonna droppable o di un altro mod
    const overData = over.data.current;

    console.log(`[DND] --- DragEnd Event ---`);
    console.log(`[DND] Active ID (active.id): ${activeModId}`);
    console.log(`[DND] Over ID (over.id): ${rawOverId}`);
    console.log(`[DND] Over Data (over.data.current):`, overData);

    const activeMod = [...enabledMods, ...disabledMods].find(mod => mod.id === activeModId);
    if (!activeMod) {
      console.error(`[DND] CRITICAL: Active mod with id ${activeModId} not found in any list!`);
      return;
    }
    console.log(`[DND] Active Mod Found:`, activeMod);

    const sourceColumnType = enabledMods.some(mod => mod.id === activeModId) ? 'enabled' : 'disabled';
    const finalTargetContainerId = overData?.sortable?.containerId || rawOverId; // ID della colonna o del contenitore sortable

    console.log(`[DND] Source Column Type: ${sourceColumnType}`);
    console.log(`[DND] Final Target Container ID: ${finalTargetContainerId}`);


    // Nuova logica per gestire riordino e spostamento
    if (sourceColumnType === 'enabled') {
      // Il mod proviene dalla colonna ABILITATI
      const isOverAnEnabledMod = enabledMods.some(mod => mod.id === rawOverId);

      if (isOverAnEnabledMod && activeModId !== rawOverId) {
        // CASO 1A: Riordino all'interno di enabledMods (drop su un altro mod abilitato)
        console.log(`[DND Logic] Case 1A: Reorder within enabled. Active: ${activeModId}, Over: ${rawOverId}`);
        const oldIndex = enabledMods.findIndex((mod) => mod.id === activeModId);
        const newIndex = enabledMods.findIndex((mod) => mod.id === rawOverId);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrderedMods = arrayMove(enabledMods, oldIndex, newIndex);
          await handleEnabledModOrderChange(newOrderedMods, `Reorder ${activeModId} from ${oldIndex} to ${newIndex}`);
        } else {
          console.error(`[DND Logic] Case 1A Error: Indices not found. Old: ${oldIndex}, New: ${newIndex}`);
        }
      } else if (rawOverId === 'enabled-mods-column' && activeModId !== rawOverId) {
        // CASO 1B: Riordino all'interno di enabledMods (drop sull'area della colonna abilitata -> sposta alla fine)
        // (activeModId !== rawOverId è una sicurezza, ma rawOverId qui è l'ID della colonna)
        console.log(`[DND Logic] Case 1B: Move to end of enabled. Active: ${activeModId}, Over: ${rawOverId}`);
        const oldIndex = enabledMods.findIndex((mod) => mod.id === activeModId);
        if (oldIndex !== -1) {
          const modToMove = enabledMods[oldIndex];
          const tempOrderedMods = enabledMods.filter((_, index) => index !== oldIndex);
          const newOrderedMods = [...tempOrderedMods, modToMove];
          await handleEnabledModOrderChange(newOrderedMods, `Move ${activeModId} to end of enabled list`);
        } else {
          console.error(`[DND Logic] Case 1B Error: oldIndex not found for ${activeModId}`);
        }
      } else if (finalTargetContainerId === 'disabled-mods-column') {
        // CASO 1C: Spostamento da enabledMods a disabledMods
        console.log(`[DND Logic] Case 1C: Move from enabled to disabled. Active: ${activeModId}, Target: ${finalTargetContainerId}`);
        await handleToggleEnableMod(activeModId, 'enabled');
      } else {
        console.log(`[DND Logic] Unhandled drop from 'enabled'. Active: ${activeModId}, RawOver: ${rawOverId}, FinalTarget: ${finalTargetContainerId}, IsOverEnabledMod: ${isOverAnEnabledMod}`);
      }
    } else if (sourceColumnType === 'disabled') {
      // Il mod proviene dalla colonna DISABILITATI
      if (finalTargetContainerId === 'enabled-mods-column') {
        // CASO 2A: Spostamento da disabledMods a enabledMods
        console.log(`[DND Logic] Case 2A: Move from disabled to enabled. Active: ${activeModId}, Target: ${finalTargetContainerId}`);
        await handleToggleEnableMod(activeModId, 'disabled');
      } else if (rawOverId === 'disabled-mods-column' && activeModId !== rawOverId) {
        // CASO 2B: Riordino (o drop su se stesso) all'interno di disabled (attualmente non supportato/necessario)
        // O drop sull'area della colonna disabilitata da cui proviene
        console.log(`[DND Logic] Case 2B: Mod from disabled dropped on disabled column/mod. Active: ${activeModId}, Over: ${rawOverId}. No action.`);
      }
      else {
        console.log(`[DND Logic] Unhandled drop from 'disabled'. Active: ${activeModId}, RawOver: ${rawOverId}, FinalTarget: ${finalTargetContainerId}`);
      }
    } else {
      console.error(`[DND Logic] CRITICAL: Unhandled sourceColumnType: ${sourceColumnType}. Active: ${activeModId}`);
    }
  };


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

  // Event handlers per la colonna Disabled Mods (per il drop di *nuovi file*)
  // Questi rimangono per la funzionalità di ModDropzone, non per il drag tra colonne.
  const handleDragEnterDisabledColumnForFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
        setIsDraggingOverDisabledColumn(true); // Attiva l'overlay di ModDropzone
      }
    },
    []
  );

  const handleDragLeaveDisabledColumnForFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
      }
      setIsDraggingOverDisabledColumn(false); // Disattiva l'overlay di ModDropzone
    },
    []
  );

  const handleDropOnDisabledColumnForFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Questo evento è gestito da ModDropzone che è sovrapposto quando isDraggingOverDisabledColumn è true.
      // Se per qualche motivo il drop avviene qui e non su ModDropzone, preveniamo errori.
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOverDisabledColumn(false);
      console.log('[ModManagerLayout] Drop for new files on disabled column area.');
      // La logica effettiva è in ModDropzone.tsx e nel suo useEffect per 'drop'
    },
    []
  );

  const handleDragOverDisabledColumnForFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessario per permettere il drop di file
    event.stopPropagation();
     if (event.dataTransfer.types.includes('Files')) {
        // Opzionale: effetto visivo se necessario, ma ModDropzone lo gestisce
     } else {
        // Se non sono file, non è per ModDropzone, quindi non fare nulla qui per evitare conflitti con dnd-kit
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter} // Modificato da closestCorners
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex flex-col h-full text-white`}>
        <div className="flex flex-col flex-1 px-4 py-4 overflow-hidden">
          <div ref={containerRef} className="flex flex-1 h-full space-x-1">
            {/* Colonna Mod Disabilitati */}
            <div
              style={{ width: `${leftPanelWidth}%` }}
              className="h-full flex flex-col relative bg-neutral-900/60 p-3 md:p-4 rounded-lg shadow-lg border border-neutral-700"
              // Handler per il drop di *nuovi file* (ModDropzone)
              onDragEnter={handleDragEnterDisabledColumnForFileDrop}
              onDragOver={handleDragOverDisabledColumnForFileDrop} // Deve permettere il drag over per il drop di file
              onDragLeave={handleDragLeaveDisabledColumnForFileDrop}
              onDrop={handleDropOnDisabledColumnForFileDrop} // Gestito da ModDropzone quando overlay è attivo
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
                droppableId="disabled-mods-column" // ID per dnd-kit
                onToggleEnable={handleToggleEnableMod}
                onRename={handleRenameMod}
                onRemove={handleRemoveMod}
              />
            </div>

            {/* Dropzone Overlay per l'aggiunta di *nuovi file* */}
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
            className="h-full flex flex-col bg-neutral-900/90 p-3 md:p-4 rounded-lg border border-neutral-700"
            // Non sono necessari handler onDragOver/onDrop qui se ModList gestisce il drop
          >
            <div className="flex justify-between items-center mb-3 border-b border-neutral-700 pb-2">
              <h2 className="text-lg md:text-xl font-semibold text-slate-200 select-none">
                Enabled Mods
              </h2>
              <TooltipProvider>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toast.info('Sort functionality coming soon!')}
                      className="p-1.5 text-neutral-400 hover:text-neutral-100 transition-colors"
                      // Rimosso title attribute, ora gestito dal Tooltip
                    >
                      <ArrowUpDown className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sort Mods (Coming Soon)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="overflow-y-auto flex-grow pr-1 min-h-0">
              {' '}
              {/* Aggiunto min-h-0 */}
              <ModList
                title="Enabled Mods"
                mods={enabledMods}
                type="enabled"
                droppableId="enabled-mods-column" // ID per dnd-kit
                onToggleEnable={handleToggleEnableMod}
                onRename={handleRenameMod}
                onRemove={handleRemoveMod}
                onOrderChange={handleEnabledModOrderChange}
              />
            </div>
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeId ? (
          <ModCard
            mod={[...enabledMods, ...disabledMods].find(mod => mod.id === activeId) || { id: 'error', name: 'Error', path: '' }}
            type={enabledMods.some(mod => mod.id === activeId) ? 'enabled' : 'disabled'}
            // Queste prop non sono usate da ModCard in modalità overlay, ma sono richieste
            onToggleEnable={() => {}}
            onRename={() => {}}
            onRemove={() => {}}
          />
        ) : null}
      </DragOverlay>
      {/* Questo div non era chiuso */}
      </div>
    </DndContext>
  );
};

export default ModManagerLayout;
