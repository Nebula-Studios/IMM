import React from 'react';
import { useDroppable, UniqueIdentifier } from '@dnd-kit/core';
import {
  // arrayMove, // Non più necessario qui, gestito in ModManagerLayout
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import ModCard, { ModItem } from './ModCard.tsx';

/**
 * @file ModList.tsx
 * @description Component to display a list of mods, using ModCard for each item.
 * It also displays a title for the list (e.g., "Enabled Mods" or "Disabled Mods").
 * Enabled mods can be reordered via drag and drop.
 */

interface ModListProps {
  title: string;
  mods: ModItem[];
  type: 'enabled' | 'disabled';
  droppableId: UniqueIdentifier; // ID per useDroppable
  onToggleEnable: (modId: string, currentType: 'enabled' | 'disabled') => void;
  onRename: (modId: string, currentName: string) => void;
  onRemove: (modId: string, modName: string) => void;
  onOrderChange?: (orderedMods: ModItem[]) => void;
}

/**
 * ModList component displays a list of mods under a given title.
 *
 * @param {ModListProps} props - The props for the component.
 * @returns {JSX.Element} The rendered list of mods.
 */
const ModList: React.FC<ModListProps> = ({
  title,
  mods,
  type,
  droppableId,
  onToggleEnable,
  onRename,
  onRemove,
  onOrderChange,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
  });

  const modIds = mods.map((mod) => mod.id);

  // Stile per evidenziare la dropzone quando un elemento è sopra
  const dropzoneStyle: React.CSSProperties = {
    // backgroundColor: isOver ? 'rgba(0, 255, 0, 0.1)' : undefined, // Esempio di feedback visivo
    border: isOver ? '2px dashed #22c55e' : '2px dashed transparent', // green-500
    borderRadius: '0.375rem', // rounded-md
    padding: '2px', // Spazio per il bordo senza spostare il contenuto
    minHeight: mods.length === 0 ? '80px' : undefined, // Altezza minima se vuota per facilitare il drop
    transition: 'border-color 0.2s ease-in-out',
  };


  const listContent = (
    <div className="max-h-96 overflow-y-auto pr-2"> {/* Contenitore scrollabile interno */}
      {mods.map((mod) => (
        <ModCard
          key={mod.id}
          mod={mod}
          type={type}
          onToggleEnable={onToggleEnable}
          onRename={onRename}
          onRemove={onRemove}
        />
      ))}
      {mods.length === 0 && (
         <div className="flex items-center justify-center h-full min-h-[60px]">
            <p className="text-sm text-neutral-500 italic">
              Drag mods here to {type === 'enabled' ? 'enable' : 'disable'}
            </p>
         </div>
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef} // Riferimento per useDroppable
      style={dropzoneStyle} // Applica lo stile dinamico
      className="p-1 flex-1 flex flex-col" // Aggiunto flex flex-col per far crescere listContent
    >
      {type === 'enabled' && onOrderChange ? (
        // Solo la lista abilitata è un SortableContext per il riordino interno
        <SortableContext items={modIds} strategy={verticalListSortingStrategy}>
          {listContent}
        </SortableContext>
      ) : (
        // La lista disabilitata è solo una Droppable zone, non Sortable
        listContent
      )}
    </div>
  );
};

export default ModList;
