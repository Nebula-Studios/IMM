import React from 'react';

const Progress: React.FC<React.PropsWithChildren<{
  percent?: number;
}>> = (props) => {
  const { percent = 0 } = props;
  const displayPercent = Math.min(100, Math.max(0, percent)); // Assicura che la percentuale sia tra 0 e 100

  return (
    <div className="flex items-center w-full">
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mr-2">
        <div
          className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${displayPercent}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {`${displayPercent.toFixed(0)}%`}
      </span>
    </div>
  );
};

export default Progress;
