import * as React from 'react';

import { cn } from '@/lib/utils.ts';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-neutral-600 bg-gradient-to-r from-neutral-800/80 to-neutral-700/80 backdrop-blur-sm px-3 py-1 text-base text-slate-200 shadow-sm transition-all duration-300 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-200 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
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
