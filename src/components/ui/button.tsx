import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils.ts';

type ColorName = 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
type ColorConfig = {
  base: string;
  hover: string;
  shadow?: string;
};

const COLOR_CONFIGS: Record<ColorName, ColorConfig> = {
  primary: {
    base: 'blue-600',
    hover: 'blue-500',
    shadow: 'blue-500/30',
  },
  success: {
    base: 'green-600',
    hover: 'green-500',
    shadow: 'green-500/30',
  },
  danger: {
    base: 'red-600',
    hover: 'red-500',
    shadow: 'red-500/30',
  },
  warning: {
    base: 'yellow-600',
    hover: 'yellow-500',
    shadow: 'yellow-500/30',
  },
  neutral: {
    base: 'neutral-700',
    hover: 'neutral-600',
  },
};

const createGradientClasses = (variant: string, colorName: ColorName) => {
  const config = COLOR_CONFIGS[colorName];
  let generatedClasses = '';

  switch (variant) {
    case 'default':
      generatedClasses = config.shadow
        ? `bg-gradient-to-r from-${config.base} to-${config.hover} hover:shadow-${config.shadow} hover:from-${config.hover} hover:to-${config.hover.replace(/\d+/, (n) => String(parseInt(n) - 100))}`
        : `bg-gradient-to-r from-${config.base} to-${config.hover} hover:from-${config.hover} hover:to-${config.hover.replace(/\d+/, (n) => String(parseInt(n) - 100))}`;
      break;

    case 'outline':
      const darkerBase = config.base.replace(/\d+/, (n) =>
        String(parseInt(n) + 200)
      );
      const darkerHover = config.hover.replace(/\d+/, (n) =>
        String(parseInt(n) + 100)
      );
      generatedClasses = `border-${config.base} bg-gradient-to-r from-${darkerBase}/20 to-${config.base.replace(/\d+/, (n) => String(parseInt(n) + 100))}/20 hover:border-${config.hover} hover:bg-gradient-to-r hover:from-${config.base.replace(/\d+/, (n) => String(parseInt(n) + 100))}/30 hover:to-${darkerHover}/30`;
      break;

    case 'secondary':
      const lighterBase = config.base.replace(/\d+/, (n) =>
        String(parseInt(n) + 100)
      );
      generatedClasses = `bg-gradient-to-r from-${lighterBase} to-${config.base} hover:from-${config.base} hover:to-${config.hover}`;
      break;

    case 'ghost':
      const ghostColor =
        colorName === 'primary'
          ? 'blue'
          : colorName === 'success'
            ? 'green'
            : colorName === 'danger'
              ? 'red'
              : colorName === 'warning'
                ? 'yellow'
                : 'slate';
      generatedClasses = `hover:bg-${config.base.replace(/\d+/, '700')}/50 hover:text-${ghostColor}-200`;
      break;

    case 'link':
      const linkColor =
        colorName === 'neutral'
          ? 'neutral'
          : colorName === 'primary'
            ? 'blue'
            : colorName === 'success'
              ? 'green'
              : colorName === 'danger'
                ? 'red'
                : 'yellow';
      generatedClasses = `text-${linkColor}-400 hover:text-${linkColor}-300`;
      break;

    default:
      generatedClasses = '';
  }

  // eslint-disable-next-line no-console
  console.log(
    `[ButtonDebug] Variant: ${variant}, Color: ${colorName}, Classes: "${generatedClasses}"`
  );
  return generatedClasses;
};

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'text-white shadow-lg active:scale-95',
        outline:
          'border backdrop-blur-sm shadow-sm text-slate-200 hover:text-white active:scale-95',
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
      // Generate compound variants programmatically to reduce duplication
      ...(
        ['default', 'outline', 'secondary', 'ghost', 'link'] as const
      ).flatMap((variant) =>
        (['primary', 'success', 'danger', 'warning', 'neutral'] as const).map(
          (color) => ({
            variant,
            color,
            className: createGradientClasses(variant, color),
          })
        )
      ),
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
    // eslint-disable-next-line no-console
    console.log('[ButtonPropsDebug]', { variant, color, size, className });
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
