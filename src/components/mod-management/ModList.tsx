import React from 'react';
import { useTranslation } from 'react-i18next'; // Aggiunto per i18next
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
  const { t } = useTranslation();
  const { setNodeRef, isOver, active } = useDroppable({
    id: droppableId,
  });

  const modIds = mods.map((mod) => mod.id);

  // Determina se un elemento viene trascinato verso questa dropzone
  const isDraggedOver = isOver && active;
  const isDraggedFromDifferentContainer = isDraggedOver &&
    (type === 'enabled' ? !mods.some(mod => mod.id === active?.id) :
     !mods.some(mod => mod.id === active?.id));

  // Stile dinamico migliorato per la dropzone
  const getDropzoneClasses = () => {
    let classes = 'p-1 flex-1 flex flex-col transition-all duration-300 ease-out';
    
    if (isDraggedOver) {
      classes += ' dropzone-active transform scale-[1.01]';
    }
    
    if (isDraggedFromDifferentContainer) {
      classes += ' ring-2 ring-green-500/50 ring-opacity-75';
    }
    
    return classes;
  };

  const dropzoneStyle: React.CSSProperties = {
    borderRadius: '0.375rem',
    padding: '2px',
    minHeight: mods.length === 0 ? '80px' : undefined,
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };


  const listContent = (
    <div className={`max-h-96 overflow-y-auto pr-2 space-y-2 mod-list-container transition-all duration-300
                    ${isDraggedOver ? 'space-y-3' : ''}`}>
      {mods.map((mod, index) => (
        <div
          key={mod.id}
          className={`drop-target-indicator transition-all duration-300
                     ${isDraggedOver && index === mods.length - 1 ? 'active mb-4' : ''}`}
        >
          <ModCard
            mod={mod}
            type={type}
            onToggleEnable={onToggleEnable}
            onRename={onRename}
            onRemove={onRemove}
          />
        </div>
      ))}
      {mods.length === 0 && (
         <div className={`flex items-center justify-center h-full min-h-[80px] rounded-xl
                        backdrop-blur-sm transition-all duration-300 ease-out
                        ${isDraggedOver
                          ? 'border-2 border-dashed border-green-500/70 bg-green-900/20 scale-105'
                          : 'border-2 border-dashed border-neutral-600/50 bg-neutral-800/30'}`}>
            <div className="text-center">
              <p className={`text-sm italic font-medium transition-colors duration-300
                           ${isDraggedOver ? 'text-green-300' : 'text-neutral-400'}`}>
                {type === 'enabled' ? t('modList.dragToEnable') : t('modList.dragToDisable')}
              </p>
              {isDraggedOver && (
                <p className="text-xs text-green-400 mt-1 animate-pulse">
                  {type === 'enabled' ? '🎯 Rilascia per abilitare' : '⏸️ Rilascia per disabilitare'}
                </p>
              )}
            </div>
         </div>
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={dropzoneStyle}
      className={getDropzoneClasses()}
    >
      {type === 'enabled' && onOrderChange ? (
        <SortableContext items={modIds} strategy={verticalListSortingStrategy}>
          {listContent}
        </SortableContext>
      ) : (
        listContent
      )}
    </div>
  );
};

export default ModList;
