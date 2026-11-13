"use client";

import { type ReactNode, useId } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * App-wide dialog. Callers pass the title, description, and actions.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: ModalProps): React.JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="bg-background text-foreground w-full max-w-md rounded-lg border p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <h2 id={titleId} className="font-display text-2xl tracking-tight">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="text-muted-foreground mt-2 text-sm">
            {description}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">{children}</div>
      </div>
    </div>
  );
}
