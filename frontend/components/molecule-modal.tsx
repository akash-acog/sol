"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MoleculeModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  structure: string;
}

export default function MoleculeModal({
  isOpen,
  onClose,
  name,
  structure,
}: MoleculeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl mx-auto">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center p-4">
          <img
            src={`data:image/png;base64,${structure}`}
            alt={`${name} structure`}
            className="max-w-full h-auto"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
