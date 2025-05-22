import React from 'react';

/**
 * @file ModCard.tsx
 * @description Component to display information about a single mod.
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
}

/**
 * ModCard component displays information for a single mod item.
 *
 * @param {ModCardProps} props - The props for the component.
 * @param {ModItem} props.mod - The mod data to display.
 * @returns {JSX.Element} The rendered card for a mod.
 */
const ModCard: React.FC<ModCardProps> = ({ mod }) => {
  return (
    <div className="p-3 mb-2 border border-neutral-700 rounded-md bg-neutral-800 hover:bg-neutral-750 cursor-grab">
      <p className="text-sm text-slate-100 truncate" title={mod.name}>
        {mod.name}
      </p>
      {/* Future: Add buttons for enable/disable, delete, info, etc. */}
      {/* Future: Display mod thumbnail if available */}
    </div>
  );
};

export default ModCard;
