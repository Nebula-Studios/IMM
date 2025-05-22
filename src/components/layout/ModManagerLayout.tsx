import React, { useState, useCallback, useRef, useEffect, FC } from 'react';
import ModList from '../mod-management/ModList.tsx';
import { ModItem } from '../mod-management/ModCard.tsx';
import ModDropzone, { ProcessedFile } from '../mod-management/ModDropzone.tsx';
import { v4 as uuidv4 } from 'uuid';
import { FileWithPath } from 'react-dropzone';

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

  // NUOVO STATO per tracciare il drag sulla colonna dei mod disabilitati
  const [isDraggingOverDisabledColumn, setIsDraggingOverDisabledColumn] =
    useState(false);

  // Callback per ModDropzone
  const handleModsDropped = useCallback((droppedFiles: ProcessedFile[]) => {
    console.log('Files received in ModManagerLayout:', droppedFiles);
    setIsDraggingOverDisabledColumn(false); // Resetta lo stato di dragging dopo il drop

    const newMods: ModItem[] = droppedFiles
      .filter((file) => file.path && file.path.trim() !== '')
      .map((file) => ({
        id: file.path,
        name: file.name,
        path: file.path,
      }));

    setDisabledMods((prevDisabledMods) => {
      const currentIds = new Set(prevDisabledMods.map((mod) => mod.id));
      const trulyNewMods = newMods.filter(
        (newMod) => !currentIds.has(newMod.id)
      );
      return [...prevDisabledMods, ...trulyNewMods];
    });
  }, []);

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

  const handleDragOverDisabled = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); // Necessario per permettere il drop
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
        setIsDraggingOverDisabledColumn(true); // Mantieni attivo se si trascina sopra
      }
    },
    []
  );

  const handleDropOnDisabledColumn = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      // La logica di gestione dei file è in ModDropzone, che sarà sopra.
      // Qui resettiamo solo lo stato di visualizzazione della dropzone.
      // ModDropzone chiamerà handleModsDropped che farà un setIsDraggingOverDisabledColumn(false)
      // Ma per sicurezza lo facciamo anche qui in caso di drop "mancato" sulla dropzone interna
      setIsDraggingOverDisabledColumn(false);
    },
    []
  );

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

  return (
    <div className={`flex flex-col h-full text-white`}>
      <div className="flex flex-col flex-1 px-4 py-4 overflow-hidden">
        <div ref={containerRef} className="flex flex-1 h-full space-x-1">
          {/* Colonna Mod Disabilitati - ora con gestione drag & drop */}
          <div
            style={{ width: `${leftPanelWidth}%` }}
            className="h-full flex flex-col relative bg-neutral-900/60 p-3 md:p-4 rounded-lg shadow-lg border border-neutral-700" // Aggiunto relative e stili base
            onDragEnter={handleDragEnterDisabled}
            onDragOver={handleDragOverDisabled} // Deve essere gestito per permettere il drop
            onDragLeave={handleDragLeaveDisabled}
            onDrop={handleDropOnDisabledColumn} // Gestisce il drop sull'area, ModDropzone lo gestirà specificamente
          >
            <h2 className="text-lg md:text-xl font-semibold mb-3 text-slate-200 border-b border-neutral-700 pb-2 select-none">
              Disabled Mods
            </h2>
            <div className="overflow-y-auto flex-grow pr-1 min-h-0">
              {' '}
              {/* Aggiunto min-h-0 per flexbox */}
              <ModList title="Disabled Mods" mods={disabledMods} />
            </div>

            {/* ModDropzone Condizionale come Overlay */}
            {isDraggingOverDisabledColumn && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                <div className="w-full h-full p-2">
                  {' '}
                  {/* Contenitore per ModDropzone */}
                  <ModDropzone
                    onModsDropped={handleModsDropped}
                    existingModPaths={existingModPaths}
                  />
                </div>
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
          >
            <h2 className="text-lg md:text-xl font-semibold mb-3 text-slate-200 border-b border-neutral-700 pb-2 select-none">
              Enabled Mods
            </h2>
            <div className="overflow-y-auto flex-grow pr-1 min-h-0">
              {' '}
              {/* Aggiunto min-h-0 */}
              <ModList title="Enabled Mods" mods={enabledMods} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModManagerLayout;
