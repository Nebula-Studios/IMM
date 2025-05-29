import React, { ReactNode } from 'react';
// import { createPortal } from 'react-dom'; // createPortal non è più necessario con DialogPrimitive.Portal
// import './modal.css'; // Rimosso
import { Button } from '../../ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription, // Aggiunto se necessario per descrizioni, o si usa children direttamente
  DialogClose, // Per il pulsante di chiusura standard
} from '../../ui/dialog.tsx';
import { X } from 'lucide-react'; // Icona per il pulsante di chiusura

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode; // Mantenuto per flessibilità, ma di solito si usano i bottoni nel DialogFooter
  cancelText?: string;
  okText?: string;
  onCancel?: () => void;
  onOk?: () => void;
  // width non è più una prop, DialogContent ha una larghezza massima predefinita (max-w-lg)
}

const CustomModal: React.FC<ModalProps> = ({
  open,
  title,
  children,
  footer,
  cancelText = 'Cancel',
  okText = 'OK',
  onCancel,
  onOk,
}) => {
  if (!open) {
    return null;
  }

  // Gestisce la chiusura sia dal pulsante X che dal pulsante Annulla
  const handleClose = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          {title && <DialogTitle>{title}</DialogTitle>}
          {/* <DialogDescription>
            Qui potrebbe andare una descrizione se necessaria.
          </DialogDescription> */}
        </DialogHeader>
        
        {children} {/* Contenuto principale della modale */}

        {footer !== null && ( // Se footer è esplicitamente null, non mostrare il footer di default
          <DialogFooter>
            {onCancel && (
              <Button variant="outline" onClick={handleClose}>
                {cancelText}
              </Button>
            )}
            {onOk && (
              <Button variant="default" onClick={onOk}>
                {okText}
              </Button>
            )}
          </DialogFooter>
        )}
        {footer} {/* Permette di passare un footer completamente personalizzato se necessario */}
        
        {/* Il componente DialogContent di Shadcn/ui include già un pulsante di chiusura con icona X */}
        {/* Non è necessario aggiungerne uno manualmente a meno di requisiti specifici */}
      </DialogContent>
    </Dialog>
  );
};

export default CustomModal;
