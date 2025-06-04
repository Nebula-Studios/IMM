import * as React from 'react';

import { cn } from '@/lib/utils.ts';

// Costanti per le classi CSS riutilizzabili
const CARD_BASE_STYLES = [
  'rounded-xl',
  'border border-neutral-700/50',
  'bg-gradient-to-br from-neutral-900/60 to-neutral-800/80',
  'backdrop-blur-sm',
  'text-card-foreground',
  'shadow-lg hover:shadow-xl',
  'transition-all duration-300 ease-out',
  'hover:border-neutral-600/60',
].join(' ');

const CARD_HEADER_STYLES = 'flex flex-col space-y-1.5 p-6';
const CARD_TITLE_STYLES = 'font-semibold leading-none tracking-tight';
const CARD_DESCRIPTION_STYLES = 'text-sm text-muted-foreground';
const CARD_CONTENT_STYLES = 'p-6 pt-0';
const CARD_FOOTER_STYLES = 'flex items-center p-6 pt-0';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(CARD_BASE_STYLES, className)} {...props} />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(CARD_HEADER_STYLES, className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(CARD_TITLE_STYLES, className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(CARD_DESCRIPTION_STYLES, className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(CARD_CONTENT_STYLES, className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(CARD_FOOTER_STYLES, className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
