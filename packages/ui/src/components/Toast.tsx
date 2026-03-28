import { ComponentChildren } from 'preact';

export interface ToastProps {
  children: ComponentChildren;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
}

export function Toast({ children, type = 'info', onClose }: ToastProps) {
  return (
    <div class={`ens-toast ens-toast--${type}`}>
      <span>{children}</span>
      {onClose && (
        <button class="ens-toast__close" onClick={onClose}>
          &times;
        </button>
      )}
    </div>
  );
}
