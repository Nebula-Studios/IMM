import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable, UniqueIdentifier } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import ModCard from './ModCard.tsx';
import { ModItem } from '../../types/common.ts';

interface ModListProps {
  title: string;
  mods: ModItem[];
  type: 'enabled' | 'disabled';
  droppableId: UniqueIdentifier;
  onToggleEnable: (modId: string, currentType: 'enabled' | 'disabled') => void;
  onRename: (modId: string, currentName: string) => void;
  onRemove: (modId: string, modName: string) => void;
  onOrderChange?: (orderedMods: ModItem[]) => void;
}

const EMPTY_LIST_MIN_HEIGHT = '80px';
const DROPZONE_BASE_CLASSES =
  'p-1 flex-1 flex flex-col transition-all duration-300 ease-out';
const DROPZONE_ACTIVE_CLASSES = 'dropzone-active transform scale-[1.01]';
const DROPZONE_DIFFERENT_CONTAINER_CLASSES =
  'ring-2 ring-green-500/50 ring-opacity-75';

const LIST_CONTAINER_CLASSES =
  'max-h-96 overflow-y-auto pr-2 space-y-2 mod-list-container transition-all duration-300';
const LIST_CONTAINER_DRAGGED_CLASSES = 'space-y-3';

const EMPTY_STATE_BASE_CLASSES =
  'flex items-center justify-center h-full min-h-[80px] rounded-xl backdrop-blur-sm transition-all duration-300 ease-out';
const EMPTY_STATE_ACTIVE_CLASSES =
  'border-2 border-dashed border-green-500/70 bg-green-900/20 scale-105';
const EMPTY_STATE_INACTIVE_CLASSES =
  'border-2 border-dashed border-neutral-600/50 bg-neutral-800/30';

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
  const isDraggedOver = isOver && active;
  const isDraggedFromDifferentContainer =
    isDraggedOver && !mods.some((mod) => mod.id === active?.id);
  const isEnabled = type === 'enabled';
  const isEmpty = mods.length === 0;

  const getDropzoneClasses = (): string => {
    const classes = [DROPZONE_BASE_CLASSES];

    if (isDraggedOver) {
      classes.push(DROPZONE_ACTIVE_CLASSES);
    }

    if (isDraggedFromDifferentContainer) {
      classes.push(DROPZONE_DIFFERENT_CONTAINER_CLASSES);
    }

    return classes.join(' ');
  };

  const getListContainerClasses = (): string => {
    return `${LIST_CONTAINER_CLASSES} ${isDraggedOver ? LIST_CONTAINER_DRAGGED_CLASSES : ''}`;
  };

  const getEmptyStateClasses = (): string => {
    const baseClasses = EMPTY_STATE_BASE_CLASSES;
    const stateClasses = isDraggedOver
      ? EMPTY_STATE_ACTIVE_CLASSES
      : EMPTY_STATE_INACTIVE_CLASSES;

    return `${baseClasses} ${stateClasses}`;
  };

  const getEmptyStateTextClasses = (): string => {
    const baseClasses =
      'text-sm italic font-medium transition-colors duration-300';
    const colorClasses = isDraggedOver ? 'text-green-300' : 'text-neutral-400';

    return `${baseClasses} ${colorClasses}`;
  };

  const getDropTargetClasses = (index: number): string => {
    const baseClasses = 'drop-target-indicator transition-all duration-300';
    const activeClasses =
      isDraggedOver && index === mods.length - 1 ? 'active mb-4' : '';

    return `${baseClasses} ${activeClasses}`;
  };

  const getEmptyStateMessage = (): string => {
    return isEnabled ? t('modList.dragToEnable') : t('modList.dragToDisable');
  };

  const getDropHintMessage = (): string => {
    return isEnabled
      ? '🎯 Rilascia per abilitare'
      : '⏸️ Rilascia per disabilitare';
  };

  const dropzoneStyle: React.CSSProperties = {
    borderRadius: '0.375rem',
    padding: '2px',
    minHeight: isEmpty ? EMPTY_LIST_MIN_HEIGHT : undefined,
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const renderModCards = () => (
    <>
      {mods.map((mod, index) => (
        <div key={mod.id} className={getDropTargetClasses(index)}>
          <ModCard
            mod={mod}
            type={type}
            onToggleEnable={onToggleEnable}
            onRename={onRename}
            onRemove={onRemove}
          />
        </div>
      ))}
    </>
  );

  const renderEmptyState = () => (
    <div className={getEmptyStateClasses()}>
      <div className="text-center">
        <p className={getEmptyStateTextClasses()}>{getEmptyStateMessage()}</p>
        {isDraggedOver && (
          <p className="text-xs text-green-400 mt-1 animate-pulse">
            {getDropHintMessage()}
          </p>
        )}
      </div>
    </div>
  );

  const listContent = (
    <div className={getListContainerClasses()}>
      {renderModCards()}
      {isEmpty && renderEmptyState()}
    </div>
  );

  const shouldUseSortableContext = isEnabled && onOrderChange;

  return (
    <div
      ref={setNodeRef}
      style={dropzoneStyle}
      className={getDropzoneClasses()}
    >
      {shouldUseSortableContext ? (
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
