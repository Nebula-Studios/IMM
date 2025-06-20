import React, { useState, useCallback, useRef, useEffect, FC } from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';

import ModList from '../mod-management/ModList.tsx';
import ModCard from '../mod-management/ModCard.tsx';
import { ModItem } from '../../types/common.ts';
import { StagedModInfo } from '../../types/common.ts';
import { profileService } from '../../services/profileService.ts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Button } from '../ui/button.tsx';
import { Label } from '../ui/label.tsx';

interface ModManagerLayoutProps {
  exposeRefreshFunction?: (refreshFn: () => Promise<void>) => void;
}

const SUPPORTED_EXTENSIONS_TEXT = '.pak, .zip, .rar, .7z';

const ModManagerLayout: FC<ModManagerLayoutProps> = ({
  exposeRefreshFunction,
}) => {
  const { t } = useTranslation();

  // DND between lists state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // Mod lists state
  const [disabledMods, setDisabledMods] = useState<ModItem[]>([]);
  const [enabledMods, setEnabledMods] = useState<ModItem[]>([]);

  // Rename dialog state
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [modToRename, setModToRename] = useState<ModItem | null>(null);
  const [newModName, setNewModName] = useState('');

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [modToDelete, setModToDelete] = useState<ModItem | null>(null);

  // Loading state
  const initialLoadDone = useRef(false);

  // Callback for file dropzone
  const handleModsProcessedAndStagedCallback = useCallback(
    (stagedMods: StagedModInfo[]) => {
      console.log('[ModManagerLayout] Staged mod info received:', stagedMods);

      const newMods: ModItem[] = stagedMods
        .filter((modInfo) => modInfo.pakPath && modInfo.pakPath.trim() !== '')
        .map((modInfo) => ({
          id: modInfo.pakPath,
          name: modInfo.name,
          path: modInfo.pakPath,
          author: modInfo.author,
          version: modInfo.version,
        }));

      if (newMods.length > 0) {
        setDisabledMods((prevDisabledMods) => {
          const currentIds = new Set(prevDisabledMods.map((mod) => mod.id));
          const trulyNewMods = newMods.filter(
            (newMod) => !currentIds.has(newMod.id)
          );
          if (trulyNewMods.length > 0) {
            return [...prevDisabledMods, ...trulyNewMods];
          }
          return prevDisabledMods;
        });
      }
    },
    []
  );

  // Dropzone logic for new files
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      console.log('Dropzone onDrop triggered', {
        acceptedFilesCount: acceptedFiles.length,
      });

      if (acceptedFiles.length === 0) {
        toast.info('No supported files were dropped.');
        return;
      }

      // Use the preload function to get paths securely for each file.
      const filePaths = acceptedFiles
        .map((file) => window.electronAPI.getPathForFile(file))
        .filter((path): path is string => !!path); // Filter out null/undefined paths

      if (filePaths.length === 0) {
        toast.error(
          'Could not determine the path for any of the dropped files.',
          {
            description:
              'If the files are on a network drive, please move them to a local disk and try again.',
          }
        );
        return;
      }

      try {
        const result =
          await window.electronAPI.processDroppedModPaths(filePaths);

        // Handle successful mods
        if (result.success && result.mods && result.mods.length > 0) {
          const modCount = result.mods.length;
          toast.success(
            `${modCount} mod(s) processed and staged successfully!`
          );
          handleModsProcessedAndStagedCallback(result.mods);
        }

        // Handle failed mods
        if (result.failedMods && result.failedMods.length > 0) {
          result.failedMods.forEach((failure) => {
            toast.error(`Failed to process mod: ${failure.name}`, {
              description: failure.reason,
              duration: 10000,
            });
          });
        }

        // Handle general backend error
        if (!result.success && result.error) {
          toast.error('Failed to process mods.', {
            description: result.error,
          });
        }
      } catch (error: any) {
        const errorMessage =
          error.message || 'An unknown communication error occurred.';
        toast.error('Error sending mods to backend.', {
          description: errorMessage,
        });
      }
    },
    [handleModsProcessedAndStagedCallback]
  );

  const getFilesFromEvent = useCallback(async (event: any) => {
    // This function is the key to getting reliable file paths in Electron.
    // It intercepts the raw drop event and extracts the files from dataTransfer.
    const items = event.dataTransfer.items;
    const files: File[] = [];

    if (items && items.length) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = item.webkitGetAsEntry();
        if (entry) {
          // Using a Promise-based approach to handle webkitGetAsEntry's async nature
          const file = await new Promise<File | null>((resolve) => {
            if (entry.isFile) {
              (entry as FileSystemFileEntry).file(
                (f) => resolve(f),
                () => resolve(null)
              );
            } else {
              resolve(null); // Ignore directories for now
            }
          });
          if (file) {
            files.push(file);
          }
        }
      }
    }
    return files;
  }, []);

  const {
    getRootProps: getDropzoneRootProps,
    getInputProps: getDropzoneInputProps,
    isDragActive: isFileDragActive,
  } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    getFilesFromEvent,
  });

  // Layout and DND logic
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const enableMod = async (modToEnable: ModItem) => {
    console.log(
      `[ContextMenu] Enabling mod: ${modToEnable.name} (path: ${modToEnable.path})`
    );

    try {
      // Pass the correct, sanitized mod name directly. Do not recalculate from path.
      const result = await window.electronAPI.enableMod(
        modToEnable.path,
        modToEnable.name
      );

      if (result.success && result.activePath) {
        const enabledModItem: ModItem = {
          ...modToEnable,
          activePath: result.activePath,
          numericPrefix: result.numericPrefix,
        };

        setEnabledMods((prev) => [...prev, enabledModItem]);
        setDisabledMods((prev) =>
          prev.filter((mod) => mod.id !== modToEnable.id)
        );
        toast.success(
          `Mod "${modToEnable.name}" enabled via context menu. Active path: ${result.activePath}`
        );
        await profileService.updateActiveProfileModConfigurationIfNeeded();
      } else {
        toast.error(
          `Failed to enable mod "${modToEnable.name}": ${result.error}`
        );
      }
    } catch (error: any) {
      toast.error(`Error enabling mod "${modToEnable.name}": ${error.message}`);
    }
  };

  const disableMod = async (modToDisable: ModItem) => {
    console.log(
      `[ContextMenu] Disabling mod: ${modToDisable.name} (activePath: ${modToDisable.activePath})`
    );

    try {
      if (!modToDisable.activePath) {
        toast.error(
          `Mod "${modToDisable.name}" does not have an active path. Cannot disable properly.`
        );
        console.error(
          `[ContextMenu] Mod "${modToDisable.name}" is missing activePath.`
        );
        return;
      }

      const disableResult = await window.electronAPI.disableMod(modToDisable);

      if (disableResult.success) {
        toast.success(
          `Mod "${modToDisable.name}" directory removed from game folder.`
        );

        const { activePath, ...restOfModToDisable } = modToDisable;
        setDisabledMods((prev) => [...prev, restOfModToDisable]);

        const remainingEnabledMods = enabledMods.filter(
          (mod) => mod.id !== modToDisable.id
        );

        if (remainingEnabledMods.length > 0) {
          console.log(
            '[ContextMenu] Calling handleEnabledModOrderChange to re-evaluate order and names after disabling a mod.'
          );
          await handleEnabledModOrderChange(
            [...remainingEnabledMods],
            `Disable mod ${modToDisable.name} and reorder/rename`
          );
        } else {
          setEnabledMods([]);
          console.log(
            '[ContextMenu] No enabled mods left after disabling. List cleared.'
          );
          await profileService.updateActiveProfileModConfigurationIfNeeded();
        }
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
  };

  const handleToggleEnableMod = async (
    modId: string,
    currentType: 'enabled' | 'disabled'
  ) => {
    if (currentType === 'disabled') {
      const modToEnable = disabledMods.find((mod) => mod.id === modId);
      if (modToEnable) {
        await enableMod(modToEnable);
      }
    } else {
      const modToDisable = enabledMods.find((mod) => mod.id === modId);
      if (modToDisable) {
        await disableMod(modToDisable);
      }
    }
  };

  const handleRenameMod = (modId: string, currentName: string) => {
    const mod = [...disabledMods, ...enabledMods].find((m) => m.id === modId);
    if (mod) {
      setModToRename(mod);
      setNewModName(currentName);
      setIsRenameDialogOpen(true);
    } else {
      toast.error(`Mod with ID "${modId}" not found for renaming.`);
    }
  };

  const resetRenameDialog = () => {
    setIsRenameDialogOpen(false);
    setModToRename(null);
    setNewModName('');
  };

  const submitRenameMod = async () => {
    if (!modToRename || !newModName.trim()) {
      toast.error('Mod or new name is invalid.');
      return;
    }

    const oldModPath = modToRename.path;
    const oldName = modToRename.name;
    const trimmedNewName = newModName.trim();

    if (oldName === trimmedNewName) {
      toast.info('New name is the same as the current name. No changes made.');
      resetRenameDialog();
      return;
    }

    try {
      console.log(
        `[Rename] Attempting to rename mod "${oldName}" (Path: ${oldModPath}) to "${trimmedNewName}"`
      );

      let modWasEnabled = false;
      if (enabledMods.some((m) => m.id === modToRename.id)) {
        modWasEnabled = true;
        console.log(
          `[Rename] Mod "${oldName}" is enabled. Attempting to disable it first.`
        );

        try {
          const disableResult =
            await window.electronAPI.disableMod(modToRename);
          if (disableResult.success) {
            toast.info(
              `Mod "${oldName}" was active and has been disabled from game folder.`
            );
            console.log(
              `[Rename] Successfully disabled mod "${oldName}" from game folder.`
            );
          } else {
            toast.info(
              `[Rename] Failed to disable active mod "${oldName}" from game folder: ${disableResult.error}. Proceeding with staging rename.`
            );
            console.warn(
              `[Rename] Failed to disable mod "${oldName}" from game folder: ${disableResult.error}`
            );
          }
        } catch (disableError: any) {
          toast.error(
            `[Rename] Error disabling active mod "${oldName}": ${disableError.message}. Proceeding with staging rename.`
          );
          console.error(
            `[Rename] Error disabling mod "${oldName}":`,
            disableError
          );
        }
      }

      const result = await window.electronAPI.renameModStagingDirectory(
        oldModPath,
        trimmedNewName
      );

      if (result.success && result.newModPath && result.newModName) {
        const updatedModItem: ModItem = {
          ...modToRename,
          id: result.newModPath,
          name: result.newModName,
          path: result.newModPath,
          activePath: undefined,
        };

        if (modWasEnabled) {
          setEnabledMods((prev) =>
            prev.filter(
              (m) => m.id !== modToRename.id && m.id !== updatedModItem.id
            )
          );
          setDisabledMods((prev) => [
            ...prev.filter(
              (m) => m.id !== modToRename.id && m.id !== updatedModItem.id
            ),
            updatedModItem,
          ]);
          toast.success(
            `Mod "${oldName}" renamed to "${result.newModName}" and moved to disabled mods.`
          );
        } else {
          setDisabledMods((prev) =>
            prev.map((m) => (m.id === modToRename.id ? updatedModItem : m))
          );
          toast.success(`Mod "${oldName}" renamed to "${result.newModName}".`);
        }

        console.log(
          '[Rename] Mod renamed successfully in state:',
          updatedModItem
        );
        await profileService.updateActiveProfileModConfigurationIfNeeded();
      } else {
        toast.error(
          `Failed to rename mod in staging: ${result.error || 'Unknown error'}`
        );
      }
    } catch (error: any) {
      toast.error(`Error renaming mod: ${error.message}`);
      console.error('[Rename] Error:', error);
    }

    resetRenameDialog();
  };

  const handleRemoveMod = (modId: string, modName: string) => {
    const mod =
      enabledMods.find((m) => m.id === modId) ||
      disabledMods.find((m) => m.id === modId);
    if (mod) {
      setModToDelete(mod);
      setIsDeleteDialogOpen(true);
    } else {
      toast.error(`Could not find mod to delete.`);
    }
  };

  const confirmDeleteMod = async () => {
    if (!modToDelete) return;

    try {
      const result = await window.electronAPI.deleteMod(modToDelete);

      if (result.success) {
        toast.success(`Mod "${modToDelete.name}" was successfully deleted.`);
        // Optimistically remove from state
        setEnabledMods((prev) => prev.filter((m) => m.id !== modToDelete.id));
        setDisabledMods((prev) => prev.filter((m) => m.id !== modToDelete.id));
        await profileService.updateActiveProfileModConfigurationIfNeeded();
      } else {
        toast.error(`Failed to delete mod: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`An error occurred while deleting the mod: ${error.message}`);
    } finally {
      setIsDeleteDialogOpen(false);
      setModToDelete(null);
    }
  };

  const handleEnabledModOrderChange = async (
    newOrderedMods: ModItem[],
    operationDebugInfo?: string
  ) => {
    console.log(
      `[handleEnabledModOrderChange] Called. Operation: ${operationDebugInfo || 'N/A'}. New order preview:`,
      newOrderedMods.map((m) => m.id)
    );

    setEnabledMods(newOrderedMods);

    const allModsHaveActivePath = newOrderedMods.every(
      (mod) => mod.activePath && mod.activePath.trim() !== ''
    );
    if (!allModsHaveActivePath) {
      toast.error(
        'Error: Some enabled mods are missing their active path. Cannot update order on backend.'
      );
      console.error(
        'Error: Some enabled mods are missing activePath before sending to backend for order update.',
        newOrderedMods
      );
      return;
    }

    try {
      const result = await window.electronAPI.updateModOrder(newOrderedMods);
      if (result.success && result.updatedMods) {
        toast.success('Mod order updated successfully on backend.');
        setEnabledMods(result.updatedMods);
        await profileService.updateActiveProfileModConfigurationIfNeeded();
      } else {
        toast.error(
          `Failed to update mod order on backend: ${result.error || 'Unknown error'}`
        );
        console.error('Failed to update mod order on backend:', result.error);
      }
    } catch (error: any) {
      toast.error(`Error calling updateModOrder IPC: ${error.message}`);
      console.error('IPC error updating mod order:', error);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: { active: { id: UniqueIdentifier } }) => {
    setActiveId(event.active.id);
    document.body.style.cursor = 'grabbing';
  };

  const handleReorderWithinEnabled = async (
    activeModId: string,
    rawOverId: string
  ) => {
    const isOverAnEnabledMod = enabledMods.some((mod) => mod.id === rawOverId);

    if (isOverAnEnabledMod && activeModId !== rawOverId) {
      console.log(
        `[DND Logic] Case 1A: Reorder within enabled. Active: ${activeModId}, Over: ${rawOverId}`
      );
      const oldIndex = enabledMods.findIndex((mod) => mod.id === activeModId);
      const newIndex = enabledMods.findIndex((mod) => mod.id === rawOverId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrderedMods = arrayMove(enabledMods, oldIndex, newIndex);
        await handleEnabledModOrderChange(
          newOrderedMods,
          `Reorder ${activeModId} from ${oldIndex} to ${newIndex}`
        );
      } else {
        console.error(
          `[DND Logic] Case 1A Error: Indices not found. Old: ${oldIndex}, New: ${newIndex}`
        );
      }
    } else if (
      rawOverId === 'enabled-mods-column' &&
      activeModId !== rawOverId
    ) {
      console.log(
        `[DND Logic] Case 1B: Move to end of enabled. Active: ${activeModId}, Over: ${rawOverId}`
      );
      const oldIndex = enabledMods.findIndex((mod) => mod.id === activeModId);

      if (oldIndex !== -1) {
        const modToMove = enabledMods[oldIndex];
        const tempOrderedMods = enabledMods.filter(
          (_, index) => index !== oldIndex
        );
        const newOrderedMods = [...tempOrderedMods, modToMove];
        await handleEnabledModOrderChange(
          newOrderedMods,
          `Move ${activeModId} to end of enabled list`
        );
      } else {
        console.error(
          `[DND Logic] Case 1B Error: oldIndex not found for ${activeModId}`
        );
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    document.body.style.cursor = '';

    const { active, over } = event;

    if (!over) {
      console.log(
        '[DND] Drag ended but no "over" target. Active ID was:',
        active.id
      );
      const draggedElement = document.querySelector(`[data-id="${active.id}"]`);
      if (draggedElement) {
        draggedElement.classList.add('animate-pulse');
        setTimeout(() => draggedElement.classList.remove('animate-pulse'), 300);
      }
      return;
    }

    const activeModId = active.id as string;
    const rawOverId = over.id as string;
    const overData = over.data.current;

    console.log(`[DND] --- DragEnd Event ---`);
    console.log(`[DND] Active ID: ${activeModId}, Over ID: ${rawOverId}`);

    const activeMod = [...enabledMods, ...disabledMods].find(
      (mod) => mod.id === activeModId
    );
    if (!activeMod) {
      console.error(
        `[DND] CRITICAL: Active mod with id ${activeModId} not found in any list!`
      );
      return;
    }

    const sourceColumnType = enabledMods.some((mod) => mod.id === activeModId)
      ? 'enabled'
      : 'disabled';
    const finalTargetContainerId = overData?.sortable?.containerId || rawOverId;

    console.log(
      `[DND] Source Column Type: ${sourceColumnType}, Target: ${finalTargetContainerId}`
    );

    if (sourceColumnType === 'enabled') {
      if (finalTargetContainerId === 'disabled-mods-column') {
        console.log(
          `[DND Logic] Move from enabled to disabled. Active: ${activeModId}`
        );
        await handleToggleEnableMod(activeModId, 'enabled');
      } else {
        await handleReorderWithinEnabled(activeModId, rawOverId);
      }
    } else if (sourceColumnType === 'disabled') {
      if (finalTargetContainerId === 'enabled-mods-column') {
        console.log(
          `[DND Logic] Move from disabled to enabled. Active: ${activeModId}`
        );
        await handleToggleEnableMod(activeModId, 'disabled');
      }
    }

    setTimeout(() => {
      const targetElement = document.querySelector(
        `[data-id="${activeModId}"]`
      );
      if (targetElement) {
        targetElement.classList.add('mod-card-drop-animation');
        setTimeout(
          () => targetElement.classList.remove('mod-card-drop-animation'),
          400
        );
      }
    }, 100);
  };

  const getDragOverlayMod = () => {
    const mod = [...enabledMods, ...disabledMods].find(
      (mod) => mod.id === activeId
    );
    return mod || { id: 'error', name: 'Error', path: '' };
  };

  const getDragOverlayType = () => {
    return enabledMods.some((mod) => mod.id === activeId)
      ? 'enabled'
      : 'disabled';
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

  // Funzione per caricare e sincronizzare i dati dei mod
  const loadAndSyncData = useCallback(async () => {
    initialLoadDone.current = false; // Resetta prima di iniziare il caricamento
    // Mostra un toast per indicare che l'aggiornamento è iniziato
    const toastId = toast.loading(t('toast.refreshingModList'));
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

        toast.success(t('toast.modListRefreshedSuccess'), {
          id: toastId,
          duration: 2500,
        });
        console.log(
          `[ModManagerLayout] Synchronization successful. Final lists - Disabled: ${finalDisabledMods.length}, Enabled: ${finalEnabledMods.length}`
        );
      } else {
        toast.error(
          t('toast.modListRefreshedError', { error: syncResult.error }),
          {
            id: toastId,
          }
        );
        console.error(
          '[ModManagerLayout] Failed to synchronize mod states:',
          syncResult.error
        );
        setDisabledMods([]); // Resetta in caso di errore di sincronizzazione
        setEnabledMods([]);
      }
    } catch (error: any) {
      toast.error(
        t('toast.modListRefreshCriticalError', { errorMessage: error.message }),
        {
          id: toastId,
        }
      );
      console.error(
        '[ModManagerLayout] Critical error during mod list refresh:',
        error
      );
      setDisabledMods([]); // Resetta in caso di errore critico
      setEnabledMods([]);
    }
    initialLoadDone.current = true;
  }, [t]); // useCallback con dipendenze vuote, la funzione è stabile

  // Caricamento iniziale delle liste di mod
  useEffect(() => {
    loadAndSyncData();
  }, [loadAndSyncData]); // Esegui al montaggio e se loadAndSyncData cambia (improbabile con useCallback e [])

  // Esporre la funzione di refresh al genitore
  useEffect(() => {
    if (exposeRefreshFunction) {
      exposeRefreshFunction(loadAndSyncData);
    }
  }, [exposeRefreshFunction, loadAndSyncData]);

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
            {/* Colonna Mod Disabilitati - Ora è anche la Dropzone */}
            <div
              {...getDropzoneRootProps()}
              style={{ width: `${leftPanelWidth}%` }}
              className="h-full flex flex-col relative bg-neutral-900/60 p-3 md:p-4 rounded-lg shadow-inner"
            >
              <input {...getDropzoneInputProps()} />

              {/* Overlay per il trascinamento di file esterni */}
              {isFileDragActive && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-green-900/80 backdrop-blur-sm rounded-xl border-2 border-dashed border-green-400">
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-green-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4 4H7z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 11v6m0 0l-3-3m3 3l3-3"
                      />
                    </svg>
                    <h3 className="mt-2 text-lg font-medium text-slate-50">
                      {t('modManager.dropFilesTitle')}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {t('modManager.dropFilesSubtitle', {
                        extensions: SUPPORTED_EXTENSIONS_TEXT,
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* Header */}
              <h2 className="text-lg md:text-xl font-semibold mb-3 text-slate-200 border-b border-neutral-700 pb-2 select-none">
                {t('modManager.disabledModsTitle')}
              </h2>

              <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                <ModList
                  title={t('modManager.disabledModsTitle')}
                  mods={disabledMods}
                  type="disabled"
                  droppableId="disabled-mods"
                  onToggleEnable={handleToggleEnableMod}
                  onRename={handleRenameMod}
                  onRemove={handleRemoveMod}
                />
              </div>
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
                  {t('modManager.enabledModsTitle')}
                </h2>
              </div>
              <div className="overflow-y-auto flex-grow pr-1 min-h-0">
                {' '}
                {/* Aggiunto min-h-0 */}
                <ModList
                  title={t('modManager.enabledModsTitle')}
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
        <DragOverlay
          dropAnimation={{
            duration: 400,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {activeId ? (
            <div className="transform rotate-3 scale-105 shadow-2xl shadow-sky-500/30">
              <ModCard
                mod={getDragOverlayMod()}
                type={getDragOverlayType()}
                onToggleEnable={() => {}}
                onRename={() => {}}
                onRemove={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
        {/* Dialog per rinominare il mod */}
        {modToRename && (
          <Dialog
            open={isRenameDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setModToRename(null);
                setNewModName('');
              }
              setIsRenameDialogOpen(open);
            }}
          >
            <DialogContent className="sm:max-w-[425px] bg-neutral-800 border-neutral-700 text-slate-100">
              <DialogHeader>
                <DialogTitle className="text-slate-50">
                  {t('modManager.renameDialog.title')}
                </DialogTitle>
                <DialogDescription className="text-neutral-400">
                  {t('modManager.renameDialog.description', {
                    modName: modToRename.name,
                  })}
                  <br />
                  {t('modManager.renameDialog.descriptionDetails')}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label
                    htmlFor="mod-new-name"
                    className="text-right text-neutral-300"
                  >
                    {t('modManager.renameDialog.newNameLabel')}
                  </Label>
                  <Input
                    id="mod-new-name"
                    value={newModName}
                    onChange={(e) => setNewModName(e.target.value)}
                    className="col-span-3 bg-neutral-700 border-neutral-600 text-slate-100 focus:ring-sky-500"
                    placeholder={t(
                      'modManager.renameDialog.newNamePlaceholder'
                    )}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-slate-100 border-neutral-600 hover:bg-neutral-700"
                  >
                    {t('common.cancel')}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={submitRenameMod}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {t('common.rename')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('modManager.deleteDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('modManager.deleteDialog.description', {
                  modName: modToDelete?.name || '',
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                color="neutral"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                color="danger"
                variant="default"
                onClick={confirmDeleteMod}
              >
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
};

export default ModManagerLayout;
