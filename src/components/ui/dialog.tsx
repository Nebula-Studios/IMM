import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils.ts';

// Costanti per le classi CSS riutilizzabili
const DIALOG_OVERLAY_STYLES = [
  'fixed inset-0 z-50',
  'bg-black/80 backdrop-blur-sm',
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
].join(' ');

const DIALOG_CONTENT_POSITIONING = [
  'fixed left-[50%] top-[50%] z-50',
  'translate-x-[-50%] translate-y-[-50%]',
].join(' ');

const DIALOG_CONTENT_ANIMATIONS = [
  'duration-200',
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'data-[state=closed]:slide-out-to-left-1/2',
  'data-[state=closed]:slide-out-to-top-[48%]',
  'data-[state=open]:slide-in-from-left-1/2',
  'data-[state=open]:slide-in-from-top-[48%]',
].join(' ');

const DIALOG_CONTENT_STYLES = [
  DIALOG_CONTENT_POSITIONING,
  'grid w-full max-w-lg gap-4',
  'border border-neutral-700/80',
  'bg-gradient-to-br from-neutral-900/95 to-neutral-800/95',
  'backdrop-blur-xl p-6 shadow-2xl',
  'sm:rounded-xl transition-all',
  DIALOG_CONTENT_ANIMATIONS,
].join(' ');

const DIALOG_CLOSE_BUTTON_STYLES = [
  'absolute right-4 top-4 rounded-md',
  'opacity-70 ring-offset-background',
  'transition-all duration-200',
  'hover:opacity-100 hover:bg-neutral-700/50',
  'focus:outline-none focus:ring-2',
  'focus:ring-blue-500/50 focus:ring-offset-2',
  'disabled:pointer-events-none',
  'data-[state=open]:bg-neutral-700/30',
  'data-[state=open]:text-slate-300 p-1.5',
].join(' ');

const DIALOG_HEADER_STYLES =
  'flex flex-col space-y-1.5 text-center sm:text-left';
const DIALOG_FOOTER_STYLES =
  'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2';
const DIALOG_TITLE_STYLES = 'text-lg font-semibold leading-none tracking-tight';
const DIALOG_DESCRIPTION_STYLES = 'text-sm text-muted-foreground';

// Componenti primitivi
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(DIALOG_OVERLAY_STYLES, className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(DIALOG_CONTENT_STYLES, className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className={DIALOG_CLOSE_BUTTON_STYLES}>
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(DIALOG_HEADER_STYLES, className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(DIALOG_FOOTER_STYLES, className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(DIALOG_TITLE_STYLES, className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(DIALOG_DESCRIPTION_STYLES, className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
