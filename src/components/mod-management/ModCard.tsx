import React from 'react';
import { useTranslation } from 'react-i18next'; // Aggiunto per i18next
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
} from 'lucide-react'; // Rimosso ArrowUpCircle, ArrowDownCircle, Aggiunto GripVertical

/**
 * @file ModCard.tsx
 * @description Component to display information about a single mod, with context menu actions and drag-and-drop capability.
 * Initially, it shows the mod's name and will be expanded to show more details and actions.
 */

export interface ModItem {
  id: string; // A unique identifier for the mod (e.g., file path or a generated UUID)
  name: string; // The display name of the mod (e.g., filename)
  path: string; // Absolute path to the mod file in staging
  activePath?: string; // Absolute path to the mod folder in the game's ~mods directory, if enabled
  numericPrefix?: string; // Prefisso numerico (es. "001") usato per i file del mod quando abilitato (solo per mod non virtuali)
}

interface ModCardProps {
  mod: ModItem;
  type: 'enabled' | 'disabled'; // Indica se il mod è in una lista di abilitati o disabilitati
  onToggleEnable: (modId: string, currentType: 'enabled' | 'disabled') => void;
  onRename: (modId: string, currentName: string) => void;
  onRemove: (modId: string, modName: string) => void;
  // onReorder, isFirst, isLast non sono più necessari qui
  // onSelect: (modId: string) => void; // Per futura selezione multipla o dettagli
  //isSelected?: boolean; // Per futura selezione multipla o dettagli
}

/**
 * ModCard component displays information for a single mod item with context menu.
 * It is draggable when part of an enabled list.
 *
 * @param {ModCardProps} props - The props for the component.
 * @param {ModItem} props.mod - The mod data to display.
 * @param {string} props.type - The type of the mod (enabled or disabled).
 * @param {function} props.onToggleEnable - Callback to toggle the enable state of the mod.
 * @param {function} props.onRename - Callback to rename the mod.
 * @param {function} props.onRemove - Callback to remove the mod.
 * @returns {JSX.Element} The rendered card for a mod.
 */
const ModCard: React.FC<ModCardProps> = ({
  mod,
  type,
  onToggleEnable,
  onRename,
  onRemove,
  // onSelect,
  // isSelected,
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
    active,
  } = useSortable({ id: mod.id });

  // Stile dinamico migliorato per il drag and drop
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  // Classi CSS dinamiche per animazioni migliorate
  const getDynamicClasses = () => {
    let classes = 'mod-card group relative flex items-center justify-between p-4 rounded-xl cursor-grab backdrop-blur-sm';
    
    if (isDragging) {
      classes += ' mod-card-dragging shadow-2xl shadow-sky-500/50 border-2 border-sky-400 bg-gradient-to-r from-sky-900/60 to-blue-900/60';
    } else if (type === 'enabled') {
      classes += ' mod-card-enabled border border-green-600/30 bg-gradient-to-r from-green-900/20 to-emerald-900/20 hover:from-green-800/30 hover:to-emerald-800/30 hover:border-green-500/50 shadow-lg hover:shadow-green-500/30 hover:shadow-2xl transition-all duration-300 ease-out';
    } else {
      classes += ' border border-neutral-600/50 bg-gradient-to-r from-neutral-800/80 to-slate-800/80 hover:from-neutral-700/90 hover:to-slate-700/90 hover:border-neutral-500/70 shadow-md hover:shadow-neutral-400/20 hover:shadow-xl transition-all duration-300 ease-out';
    }
    
    if (isOver && !isDragging) {
      classes += ' dropzone-hover';
    }
    
    return classes;
  };

  const toggleLabel =
    type === 'disabled'
      ? t('modCard.contextMenu.enable')
      : t('modCard.contextMenu.disable');
  const ToggleIcon = type === 'disabled' ? PlayCircle : PauseCircle;
  const iconColor = type === 'disabled' ? 'text-green-500' : 'text-yellow-500';

  return (
    <ContextMenu>
      <ContextMenuTrigger disabled={isDragging}>
        <div
          ref={setNodeRef}
          style={style}
          className={getDynamicClasses()}
          data-id={mod.id}
          {...attributes}
          {...listeners}
        >
          {/* Indicatore di stato a sinistra con animazione migliorata */}
          <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 rounded-r-full transition-all duration-300
                          ${type === 'enabled'
                            ? 'bg-gradient-to-b from-green-400 to-emerald-500 shadow-lg shadow-green-400/50'
                            : 'bg-gradient-to-b from-neutral-500 to-slate-600'}
                          ${isDragging ? 'w-2 h-10 shadow-2xl' : ''}`}
          />
          
          <div className="flex items-center flex-grow truncate ml-2">
            {/* Handle di trascinamento - ora solo visivo */}
            <span
              className={`drag-handle flex items-center justify-center p-2 mr-3 rounded-lg
                         transition-all duration-300 hover:bg-white/15 active:bg-white/20
                         ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}
                         hover:shadow-lg hover:shadow-white/10`}
              title={t('modCard.dragHandleTooltip')}
            >
              <GripVertical className={`h-5 w-5 transition-all duration-300
                                     ${isDragging ? 'scale-125 rotate-90' : ''}
                                     ${type === 'enabled'
                                       ? 'text-green-400 group-hover:text-green-300'
                                       : 'text-neutral-400 group-hover:text-neutral-300'}`} />
            </span>
            
            {/* Nome del mod con tipografia migliorata */}
            <div className="flex flex-col flex-grow truncate">
              <p className={`font-medium text-base leading-tight truncate transition-all duration-300
                           ${isDragging ? 'text-white font-semibold' : ''}
                           ${type === 'enabled'
                             ? 'text-slate-50 group-hover:text-white'
                             : 'text-slate-100 group-hover:text-slate-50'}`}
                 title={mod.name}>
                {mod.name}
              </p>
              {/* Badge tipo mod con animazione */}
              <span className={`status-badge inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium rounded-full w-fit
                              bg-blue-500/20 text-blue-300 border border-blue-500/30
                              ${isDragging ? 'bg-blue-400/30 text-blue-200 border-blue-400/50 scale-105' : ''}`}>
                .pak
              </span>
            </div>
          </div>
          
          {/* Icona di stato a destra con feedback animato */}
          <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300
                          ${isDragging ? 'scale-110 shadow-lg' : ''}
                          ${type === 'enabled'
                            ? 'bg-green-500/20 group-hover:bg-green-500/30'
                            : 'bg-neutral-500/20 group-hover:bg-neutral-500/30'}`}>
            {type === 'enabled' ? (
              <PlayCircle className={`h-5 w-5 text-green-400 transition-all duration-300
                                   ${isDragging ? 'text-green-300 scale-110' : ''}`} />
            ) : (
              <PauseCircle className={`h-5 w-5 text-neutral-400 transition-all duration-300
                                    ${isDragging ? 'text-neutral-300 scale-110' : ''}`} />
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => onToggleEnable(mod.id, type)}
          className="focus:bg-green-700/20"
        >
          <ToggleIcon className={`mr-2 h-4 w-4 ${iconColor}`} />
          <span className={`${iconColor}`}>{toggleLabel}</span>
          {/* <ContextMenuShortcut>⌘E</ContextMenuShortcut> */}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onRename(mod.id, mod.name)}
          className="focus:bg-blue-700/20"
        >
          <FileEdit className="mr-2 h-4 w-4 text-blue-500" />
          <span className="text-blue-500">{t('common.rename')}</span>
          {/* <ContextMenuShortcut>⌘R</ContextMenuShortcut> */}
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
          {/* <ContextMenuShortcut>⌘⌫</ContextMenuShortcut> */}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default ModCard;
