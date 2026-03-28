import { ComponentChildren } from 'preact';

export interface ModalProps {
  children: ComponentChildren;
  title?: string;
  open: boolean;
  onClose: () => void;
}

export function Modal({ children, title, open, onClose }: ModalProps) {
  if (!open) return null;

  return (
    <div class="ens-modal-overlay" onClick={onClose}>
      <div class="ens-modal" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div class="ens-modal__header">
            <h2>{title}</h2>
            <button class="ens-modal__close" onClick={onClose}>
              &times;
            </button>
          </div>
        )}
        <div class="ens-modal__content">{children}</div>
      </div>
    </div>
  );
}
