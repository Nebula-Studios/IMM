import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  // ContextMenuShortcut, // Non la usiamo per ora
} from '../ui/context-menu.tsx'; // CORRETTO
import { PlayCircle, PauseCircle, FileEdit, Trash2 } from 'lucide-react';

/**
 * @file ModCard.tsx
 * @description Component to display information about a single mod, with context menu actions.
 * Initially, it shows the mod's name and will be expanded to show more details and actions.
 */

export interface ModItem {
  id: string; // A unique identifier for the mod (e.g., file path or a generated UUID)
  name: string; // The display name of the mod (e.g., filename)
  path: string; // Absolute path to the mod file
  // Future properties: enabled (boolean), order (number), image (string), description (string), etc.
}

interface ModCardProps {
  mod: ModItem;
  type: 'enabled' | 'disabled'; // Indica se il mod è in una lista di abilitati o disabilitati
  onToggleEnable: (modId: string, currentType: 'enabled' | 'disabled') => void;
  onRename: (modId: string, currentName: string) => void;
  onRemove: (modId: string, modName: string) => void;
  // onSelect: (modId: string) => void; // Per futura selezione multipla o dettagli
  //isSelected?: boolean; // Per futura selezione multipla o dettagli
}

/**
 * ModCard component displays information for a single mod item with context menu.
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
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text/plain', mod.id);
    // Potremmo anche aggiungere un effetto visivo, se necessario
    // event.dataTransfer.effectAllowed = "move";
  };

  const toggleLabel = type === 'disabled' ? 'Enable' : 'Disable';
  const ToggleIcon = type === 'disabled' ? PlayCircle : PauseCircle;
  const iconColor = type === 'disabled' ? 'text-green-500' : 'text-yellow-500';

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          draggable={true}
          onDragStart={handleDragStart}
          // onClick={() => onSelect && onSelect(mod.id)} // Futuro
          className={`p-3 mb-2 border rounded-md cursor-grab transition-colors
                      ${
                        false /*isSelected*/
                          ? 'border-green-500 bg-green-500/20'
                          : 'border-neutral-700 bg-neutral-800 hover:bg-neutral-750'
                      }`}
        >
          <p className="text-sm text-slate-100 truncate" title={mod.name}>
            {mod.name}
          </p>
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
          <span className="text-blue-500">Rename</span>
          {/* <ContextMenuShortcut>⌘R</ContextMenuShortcut> */}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onRemove(mod.id, mod.name)}
          className="focus:bg-red-700/20"
        >
          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
          <span className="text-red-500">Remove</span>
          {/* <ContextMenuShortcut>⌘⌫</ContextMenuShortcut> */}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default ModCard;
