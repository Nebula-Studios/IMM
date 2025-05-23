import React from 'react';
import ModCard, { ModItem } from './ModCard.tsx';

/**
 * @file ModList.tsx
 * @description Component to display a list of mods, using ModCard for each item.
 * It also displays a title for the list (e.g., "Enabled Mods" or "Disabled Mods").
 */

interface ModListProps {
  title: string;
  mods: ModItem[];
  type: 'enabled' | 'disabled';
  onToggleEnable: (modId: string, currentType: 'enabled' | 'disabled') => void;
  onRename: (modId: string, currentName: string) => void;
  onRemove: (modId: string, modName: string) => void;
}

/**
 * ModList component displays a list of mods under a given title.
 *
 * @param {ModListProps} props - The props for the component.
 * @param {string} props.title - The title to display above the list of mods.
 * @param {ModItem[]} props.mods - An array of mod data objects to be displayed.
 * @returns {JSX.Element} The rendered list of mods.
 */
const ModList: React.FC<ModListProps> = ({
  title,
  mods,
  type,
  onToggleEnable,
  onRename,
  onRemove,
}) => {
  return (
    <div className="p-1 flex-1">
      {mods.length === 0 ? (
        <p className="text-sm text-neutral-500">No mods yet.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto pr-2">
          {' '}
          {/* Added pr-2 for scrollbar spacing */}
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
        </div>
      )}
      {/* Future: Could add a placeholder here if mods.length is 0 and it's a drop target */}
    </div>
  );
};

export default ModList;
