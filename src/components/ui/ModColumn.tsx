import React from 'react';
import ModItem from './ModItem.tsx'; // Assuming ModItem will be in the same directory

/**
 * @typedef {object} Mod
 * @property {string} id
 * @property {string} name
 */
interface Mod {
  id: string;
  name: string;
}

/**
 * @typedef {object} ModColumnProps
 * @property {string} title The title of the column (e.g., "Disabled Mods").
 * @property {Mod[]} mods An array of mod objects to display in the column.
 */
interface ModColumnProps {
  title: string;
  mods: Mod[];
}

/**
 * ModColumn component displays a list of mods under a given title.
 * @param {ModColumnProps} props The props for the component.
 * @returns {JSX.Element}
 */
const ModColumn: React.FC<ModColumnProps> = ({ title, mods }) => {
  return (
    <div className="flex flex-col h-full bg-neutral-800/80 p-4 rounded-lg shadow-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-4 text-center text-gray-300 flex-shrink-0">
        {title}
      </h2>
      <div className="flex-grow space-y-2 overflow-y-auto pr-1">
        {' '}
        {/* Adjust max-h as needed */}
        {mods.length > 0 ? (
          mods.map((mod: Mod) => <ModItem key={mod.id} name={mod.name} />)
        ) : (
          <p className="text-gray-500 text-center italic">
            No mods in this list.
          </p>
        )}
      </div>
    </div>
  );
};

export default ModColumn;
