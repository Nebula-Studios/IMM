import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils.ts';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'text-white shadow-lg active:scale-95',
        outline: 'border backdrop-blur-sm shadow-sm text-slate-200 hover:text-white active:scale-95',
        secondary: 'text-slate-200 shadow-sm hover:text-white active:scale-95',
        ghost: 'backdrop-blur-sm',
        link: 'underline-offset-4 hover:underline',
      },
      color: {
        primary: '',
        success: '',
        danger: '',
        warning: '',
        neutral: '',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    compoundVariants: [
      // Default variant with colors
      {
        variant: 'default',
        color: 'primary',
        className: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:shadow-blue-500/30 hover:from-blue-500 hover:to-blue-400',
      },
      {
        variant: 'default',
        color: 'success',
        className: 'bg-gradient-to-r from-green-600 to-green-500 hover:shadow-green-500/30 hover:from-green-500 hover:to-green-400',
      },
      {
        variant: 'default',
        color: 'danger',
        className: 'bg-gradient-to-r from-red-600 to-red-500 hover:shadow-red-500/30 hover:from-red-500 hover:to-red-400',
      },
      {
        variant: 'default',
        color: 'warning',
        className: 'bg-gradient-to-r from-yellow-600 to-yellow-500 hover:shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-400',
      },
      {
        variant: 'default',
        color: 'neutral',
        className: 'bg-gradient-to-r from-neutral-700 to-neutral-600 hover:from-neutral-600 hover:to-neutral-500',
      },
      // Outline variant with colors
      {
        variant: 'outline',
        color: 'primary',
        className: 'border-blue-600 bg-gradient-to-r from-blue-800/20 to-blue-700/20 hover:border-blue-500 hover:bg-gradient-to-r hover:from-blue-700/30 hover:to-blue-600/30',
      },
      {
        variant: 'outline',
        color: 'success',
        className: 'border-green-600 bg-gradient-to-r from-green-800/20 to-green-700/20 hover:border-green-500 hover:bg-gradient-to-r hover:from-green-700/30 hover:to-green-600/30',
      },
      {
        variant: 'outline',
        color: 'danger',
        className: 'border-red-600 bg-gradient-to-r from-red-800/20 to-red-700/20 hover:border-red-500 hover:bg-gradient-to-r hover:from-red-700/30 hover:to-red-600/30',
      },
      {
        variant: 'outline',
        color: 'warning',
        className: 'border-yellow-600 bg-gradient-to-r from-yellow-800/20 to-yellow-700/20 hover:border-yellow-500 hover:bg-gradient-to-r hover:from-yellow-700/30 hover:to-yellow-600/30',
      },
      {
        variant: 'outline',
        color: 'neutral',
        className: 'border-neutral-600 bg-gradient-to-r from-neutral-800/80 to-neutral-700/80 hover:border-neutral-500 hover:bg-gradient-to-r hover:from-neutral-700/90 hover:to-neutral-600/90',
      },
      // Secondary variant with colors
      {
        variant: 'secondary',
        color: 'primary',
        className: 'bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500',
      },
      {
        variant: 'secondary',
        color: 'success',
        className: 'bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500',
      },
      {
        variant: 'secondary',
        color: 'danger',
        className: 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500',
      },
      {
        variant: 'secondary',
        color: 'warning',
        className: 'bg-gradient-to-r from-yellow-700 to-yellow-600 hover:from-yellow-600 hover:to-yellow-500',
      },
      {
        variant: 'secondary',
        color: 'neutral',
        className: 'bg-gradient-to-r from-neutral-700 to-neutral-600 hover:from-neutral-600 hover:to-neutral-500',
      },
      // Ghost variant with colors
      {
        variant: 'ghost',
        color: 'primary',
        className: 'hover:bg-blue-700/50 hover:text-blue-200',
      },
      {
        variant: 'ghost',
        color: 'success',
        className: 'hover:bg-green-700/50 hover:text-green-200',
      },
      {
        variant: 'ghost',
        color: 'danger',
        className: 'hover:bg-red-700/50 hover:text-red-200',
      },
      {
        variant: 'ghost',
        color: 'warning',
        className: 'hover:bg-yellow-700/50 hover:text-yellow-200',
      },
      {
        variant: 'ghost',
        color: 'neutral',
        className: 'hover:bg-neutral-700/50 hover:text-slate-200',
      },
      // Link variant with colors
      {
        variant: 'link',
        color: 'primary',
        className: 'text-blue-400 hover:text-blue-300',
      },
      {
        variant: 'link',
        color: 'success',
        className: 'text-green-400 hover:text-green-300',
      },
      {
        variant: 'link',
        color: 'danger',
        className: 'text-red-400 hover:text-red-300',
      },
      {
        variant: 'link',
        color: 'warning',
        className: 'text-yellow-400 hover:text-yellow-300',
      },
      {
        variant: 'link',
        color: 'neutral',
        className: 'text-neutral-400 hover:text-neutral-300',
      },
    ],
    defaultVariants: {
      variant: 'default',
      color: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, color, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, color, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
