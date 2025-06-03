import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils.ts';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg hover:shadow-blue-500/30 hover:from-blue-500 hover:to-blue-400 active:scale-95',
        destructive:
          'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg hover:shadow-red-500/30 hover:from-red-500 hover:to-red-400 active:scale-95',
        outline:
          'border border-neutral-600 bg-gradient-to-r from-neutral-800/80 to-neutral-700/80 backdrop-blur-sm shadow-sm hover:border-neutral-500 hover:bg-gradient-to-r hover:from-neutral-700/90 hover:to-neutral-600/90 text-slate-200 hover:text-white active:scale-95',
        secondary:
          'bg-gradient-to-r from-neutral-700 to-neutral-600 text-slate-200 shadow-sm hover:from-neutral-600 hover:to-neutral-500 hover:text-white active:scale-95',
        ghost: 'hover:bg-neutral-700/50 hover:text-slate-200 backdrop-blur-sm',
        link: 'text-blue-400 underline-offset-4 hover:underline hover:text-blue-300',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
