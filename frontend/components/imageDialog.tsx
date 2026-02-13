"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  description?: string;
}

export function ImageDialog({
  isOpen,
  onClose,
  imageUrl,
  title,
  description,
}: ImageDialogProps) {
  const [scale, setScale] = useState(1);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleReset = () => {
    setScale(1);
  };

  const handleClose = () => {
    setScale(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] p-0 bg-background">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {title}
              </DialogTitle>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            ></Button>
          </div>
        </DialogHeader>

        {/* Image Container */}
        <div className="overflow-auto p-4 flex items-center justify-center min-h-[400px] max-h-[calc(90vh-80px)] bg-muted/30">
          <img
            src={imageUrl}
            alt={title}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center",
              transition: "transform 0.2s ease-in-out",
            }}
            className="w-auto max-h-full border border-border rounded-lg shadow-md"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
