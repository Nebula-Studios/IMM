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
    isDragging, // Per feedback visivo
  } = useSortable({ id: mod.id }); // Rimosso: disabled: type === 'disabled'. Tutti i mod sono ora trascinabili.
  // Il riordino è controllato da SortableContext e handleDragEnd.

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1, // Feedback visivo durante il drag
    zIndex: isDragging ? 100 : 'auto', // Assicura che l'elemento trascinato sia sopra gli altri
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
        {' '}
        {/* Disabilita il context menu durante il drag */}
        <div
          ref={setNodeRef}
          style={style}
          // onClick={() => onSelect && onSelect(mod.id)} // Futuro
          className={`flex items-center justify-between p-3 mb-2 border rounded-md transition-colors
                    ${isDragging ? 'shadow-lg border-sky-500 bg-sky-900/30' : 'border-neutral-700 bg-neutral-800 hover:bg-neutral-750'}
                    cursor-grab`} // Ora tutti i mod hanno il cursore grab
          // Non servono più draggable e onDragStart nativi
        >
          <div className="flex items-center flex-grow truncate">
            {/* L'handle di trascinamento (GripVertical) ora è sempre visibile se si vuole, o condizionato diversamente */}
            <span
              {...attributes}
              {...listeners}
              className="p-1 mr-2 cursor-grab"
              title={t('modCard.dragHandleTooltip')}
            >
              <GripVertical className="h-5 w-5 text-neutral-400" />
            </span>
            <p className="text-sm text-slate-100 truncate" title={mod.name}>
              {mod.name}
            </p>
          </div>
          {/* I pulsanti di riordino sono stati rimossi */}
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
