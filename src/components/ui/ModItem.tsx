import React from 'react';

/**
 * @typedef {object} ModItemProps
 * @property {string} name The name of the mod to display.
 * // Add other props like status, image, etc. in the future
 */
interface ModItemProps {
  name: string;
  // id: string; // Will be needed for interactions
  // enabled: boolean; // To show different styles or actions
}

/**
 * ModItem component represents a single mod in the list.
 * It displays the mod's name and will eventually show its status and allow interaction.
 * @param {ModItemProps} props The props for the component.
 * @returns {JSX.Element}
 */
const ModItem: React.FC<ModItemProps> = ({ name }) => {
  return (
    <div className="p-3 bg-neutral-800/80 rounded shadow hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-700">
      <p className="text-sm text-gray-200">{name}</p>
      {/* Placeholder for future status indicators or action buttons */}
    </div>
  );
};

export default ModItem;
