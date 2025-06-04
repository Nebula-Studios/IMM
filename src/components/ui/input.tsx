import * as React from 'react';

import { cn } from '@/lib/utils.ts';

// Costanti per le classi CSS del componente Input
const INPUT_BASE_CLASSES =
  'flex h-9 w-full rounded-md border px-3 py-1 shadow-sm transition-all duration-300 ease-out';

const INPUT_BACKGROUND_CLASSES =
  'bg-gradient-to-r from-neutral-800/80 to-neutral-700/80 backdrop-blur-sm';

const INPUT_BORDER_CLASSES =
  'border-neutral-600 hover:border-neutral-500 focus-visible:border-blue-500/50';

const INPUT_TEXT_CLASSES =
  'text-base text-slate-200 placeholder:text-neutral-400 md:text-sm';

const INPUT_FILE_CLASSES =
  'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-200';

const INPUT_FOCUS_CLASSES =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50';

const INPUT_DISABLED_CLASSES =
  'disabled:cursor-not-allowed disabled:opacity-50';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          INPUT_BASE_CLASSES,
          INPUT_BACKGROUND_CLASSES,
          INPUT_BORDER_CLASSES,
          INPUT_TEXT_CLASSES,
          INPUT_FILE_CLASSES,
          INPUT_FOCUS_CLASSES,
          INPUT_DISABLED_CLASSES,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
