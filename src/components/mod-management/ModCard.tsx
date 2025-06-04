import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '../ui/context-menu.tsx';
import {
  PlayCircle,
  PauseCircle,
  FileEdit,
  Trash2,
  GripVertical,
} from 'lucide-react';

export interface ModItem {
  id: string;
  name: string;
  path: string;
  activePath?: string;
  numericPrefix?: string;
}

interface ModCardProps {
  mod: ModItem;
  type: 'enabled' | 'disabled';
  onToggleEnable: (modId: string, currentType: 'enabled' | 'disabled') => void;
  onRename: (modId: string, currentName: string) => void;
  onRemove: (modId: string, modName: string) => void;
}

const CARD_BASE_CLASSES =
  'mod-card group relative flex items-center justify-between p-4 rounded-xl cursor-grab backdrop-blur-sm';
const ENABLED_CARD_CLASSES =
  'mod-card-enabled border border-green-600/30 bg-gradient-to-r from-green-900/20 to-emerald-900/20 hover:from-green-800/30 hover:to-emerald-800/30 hover:border-green-500/50 shadow-lg hover:shadow-green-500/30 hover:shadow-2xl transition-all duration-300 ease-out';
const DISABLED_CARD_CLASSES =
  'border border-neutral-600/50 bg-gradient-to-r from-neutral-800/80 to-slate-800/80 hover:from-neutral-700/90 hover:to-slate-700/90 hover:border-neutral-500/70 shadow-md hover:shadow-neutral-400/20 hover:shadow-xl transition-all duration-300 ease-out';
const DRAGGING_CARD_CLASSES =
  'mod-card-dragging shadow-2xl shadow-sky-500/50 border-2 border-sky-400 bg-gradient-to-r from-sky-900/60 to-blue-900/60';

const ModCard: React.FC<ModCardProps> = ({
  mod,
  type,
  onToggleEnable,
  onRename,
  onRemove,
}) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: mod.id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const getCardClasses = (): string => {
    const classes = [CARD_BASE_CLASSES];

    if (isDragging) {
      classes.push(DRAGGING_CARD_CLASSES);
    } else {
      classes.push(
        type === 'enabled' ? ENABLED_CARD_CLASSES : DISABLED_CARD_CLASSES
      );
    }

    if (isOver && !isDragging) {
      classes.push('dropzone-hover');
    }

    return classes.join(' ');
  };

  const isEnabled = type === 'enabled';
  const toggleLabel = isEnabled
    ? t('modCard.contextMenu.disable')
    : t('modCard.contextMenu.enable');
  const ToggleIcon = isEnabled ? PauseCircle : PlayCircle;
  const iconColor = isEnabled ? 'text-yellow-500' : 'text-green-500';

  const getStatusIndicatorClasses = (): string => {
    const baseClasses =
      'absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 rounded-r-full transition-all duration-300';
    const enabledClasses =
      'bg-gradient-to-b from-green-400 to-emerald-500 shadow-lg shadow-green-400/50';
    const disabledClasses = 'bg-gradient-to-b from-neutral-500 to-slate-600';
    const draggingClasses = 'w-2 h-10 shadow-2xl';

    return `${baseClasses} ${isEnabled ? enabledClasses : disabledClasses} ${isDragging ? draggingClasses : ''}`;
  };

  const getDragHandleClasses = (): string => {
    const baseClasses =
      'drag-handle flex items-center justify-center p-2 mr-3 rounded-lg transition-all duration-300 hover:bg-white/15 active:bg-white/20 hover:shadow-lg hover:shadow-white/10';
    const cursorClasses = isDragging
      ? 'cursor-grabbing scale-110'
      : 'cursor-grab';

    return `${baseClasses} ${cursorClasses}`;
  };

  const getGripIconClasses = (): string => {
    const baseClasses = 'h-5 w-5 transition-all duration-300';
    const transformClasses = isDragging ? 'scale-125 rotate-90' : '';
    const colorClasses = isEnabled
      ? 'text-green-400 group-hover:text-green-300'
      : 'text-neutral-400 group-hover:text-neutral-300';

    return `${baseClasses} ${transformClasses} ${colorClasses}`;
  };

  const getModNameClasses = (): string => {
    const baseClasses =
      'font-medium text-base leading-tight truncate transition-all duration-300';
    const draggingClasses = isDragging ? 'text-white font-semibold' : '';
    const colorClasses = isEnabled
      ? 'text-slate-50 group-hover:text-white'
      : 'text-slate-100 group-hover:text-slate-50';

    return `${baseClasses} ${draggingClasses} ${colorClasses}`;
  };

  const getStatusBadgeClasses = (): string => {
    const baseClasses =
      'status-badge inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium rounded-full w-fit bg-blue-500/20 text-blue-300 border border-blue-500/30';
    const draggingClasses =
      'bg-blue-400/30 text-blue-200 border-blue-400/50 scale-105';

    return `${baseClasses} ${isDragging ? draggingClasses : ''}`;
  };

  const getStatusIconContainerClasses = (): string => {
    const baseClasses =
      'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300';
    const scaleClasses = isDragging ? 'scale-110 shadow-lg' : '';
    const backgroundClasses = isEnabled
      ? 'bg-green-500/20 group-hover:bg-green-500/30'
      : 'bg-neutral-500/20 group-hover:bg-neutral-500/30';

    return `${baseClasses} ${scaleClasses} ${backgroundClasses}`;
  };

  const getStatusIconClasses = (): string => {
    const baseClasses = 'h-5 w-5 transition-all duration-300';
    const colorClasses = isEnabled ? 'text-green-400' : 'text-neutral-400';
    const draggingClasses = isDragging
      ? isEnabled
        ? 'text-green-300 scale-110'
        : 'text-neutral-300 scale-110'
      : '';

    return `${baseClasses} ${colorClasses} ${draggingClasses}`;
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger disabled={isDragging}>
        <div
          ref={setNodeRef}
          style={dragStyle}
          className={getCardClasses()}
          data-id={mod.id}
          {...attributes}
          {...listeners}
        >
          <div className={getStatusIndicatorClasses()} />

          <div className="flex items-center flex-grow truncate ml-2">
            <span
              className={getDragHandleClasses()}
              title={t('modCard.dragHandleTooltip')}
            >
              <GripVertical className={getGripIconClasses()} />
            </span>

            <div className="flex flex-col flex-grow truncate">
              <p className={getModNameClasses()} title={mod.name}>
                {mod.name}
              </p>
              <span className={getStatusBadgeClasses()}>.pak</span>
            </div>
          </div>

          <div className={getStatusIconContainerClasses()}>
            <ToggleIcon className={getStatusIconClasses()} />
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => onToggleEnable(mod.id, type)}
          className="focus:bg-green-700/20"
        >
          <ToggleIcon className={`mr-2 h-4 w-4 ${iconColor}`} />
          <span className={iconColor}>{toggleLabel}</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onRename(mod.id, mod.name)}
          className="focus:bg-blue-700/20"
        >
          <FileEdit className="mr-2 h-4 w-4 text-blue-500" />
          <span className="text-blue-500">{t('common.rename')}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onRemove(mod.id, mod.name)}
          className="focus:bg-red-700/20"
        >
          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
          <span className="text-red-500">
            {t('modCard.contextMenu.remove')}
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default ModCard;
