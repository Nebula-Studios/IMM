import React, { useState, useCallback, useRef, useEffect } from 'react';
import ModColumn from '@/components/ui/ModColumn.tsx'; // Assuming ModColumn will be created in ui

/**
 * @typedef {object} ModManagerLayoutProps
 * // Add any props if needed in the future
 */

interface ModManagerLayoutProps {
  // Props will be defined here in the future as needed
}

/**
 * ModManagerLayout component provides the main UI structure for the mod manager,
 * featuring two columns for disabled and enabled mods, and an add button.
 * @param {ModManagerLayoutProps} props The props for the component.
 * @returns {JSX.Element}
 */
const ModManagerLayout: React.FC<ModManagerLayoutProps> = (props) => {
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Larghezza iniziale in percentuale
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false); // Stato per feedback visivo

  // Placeholder data - this will eventually come from state or props
  const disabledMods = [{ id: '1', name: 'Example Mod A (Disabled)' }];
  const enabledMods = [{ id: '2', name: 'Example Mod B (Enabled)' }];

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    // e.preventDefault(); // Potrebbe essere utile per prevenire la selezione del testo
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
      const minWidth = 15;
      const maxWidth = 85;
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

  // Handler per il Drag & Drop
  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault(); // Necessario per permettere il drop
      event.stopPropagation();
      setIsDraggingOver(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingOver(false);
    },
    []
  );

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      console.log('Files dropped:', files);
      // Estrai e logga i percorsi dei file (se disponibili)
      // Nota: in Electron, potresti aver bisogno di accedere a `file.path` piuttosto che `file.name` per il percorso completo.
      const fileDetails = Array.from(files).map((file) => ({
        name: file.name,
        path: (file as any).path || 'N/A', // Electron espone .path
        type: file.type,
        size: file.size,
      }));
      console.log('File details:', fileDetails);
      alert(
        `${files.length} file(s) dropped! Check console for details. First file: ${files[0].name}`
      );
      // Qui, in futuro, aggiungeremo la logica per processare i file (es. filtrare i .pak)
      // e aggiungerli alla colonna "Mod Disabilitati"
    }
  }, []);

  return (
    <div
      className={`flex flex-col h-full bg-neutral-850 text-white rounded-xl shadow-2xl transition-all duration-200 ease-in-out ${isDraggingOver ? 'outline-2 outline-dashed outline-primary-500 outline-offset-[-4px]' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col flex-1 p-6 overflow-hidden">
        <div ref={containerRef} className="flex flex-1 h-full">
          <div style={{ width: `${leftPanelWidth}%` }} className="h-full">
            <ModColumn title="Disabled Mods" mods={disabledMods} />
          </div>

          <div
            className="w-4 cursor-col-resize flex items-center justify-center group h-full"
            onMouseDown={handleMouseDown}
          >
            <div className="w-1.5 h-5/6 bg-neutral-700 group-hover:bg-neutral-300 transition-colors duration-150 rounded-full" />
          </div>

          <div style={{ width: `${100 - leftPanelWidth}%` }} className="h-full">
            <ModColumn title="Enabled Mods" mods={enabledMods} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModManagerLayout;
