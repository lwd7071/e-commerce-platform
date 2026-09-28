"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="dialog__content">
        <header className="dialog__header">
          <div>
            <h2 className="dialog__title" id={titleId}>{title}</h2>
            {description && <p className="dialog__description" id={descriptionId}>{description}</p>}
          </div>
          <button className="icon-button" type="button" aria-label="Đóng hộp thoại" onClick={() => onOpenChange(false)}>
            <Icon name="close" />
          </button>
        </header>
        <div>{children}</div>
        {footer && <footer className="dialog__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
