/**
 * Input Component
 *
 * Single-line text input with label, error, and hint support.
 *
 * Features:
 * - Label with optional required indicator
 * - Error and hint text
 * - Icon support (left side)
 * - Prefix/suffix text
 * - Multiple sizes
 */

import * as React from 'react';

export interface InputProps {
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'search';
  /** Field label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Error message */
  error?: string;
  /** Hint text (hidden when error is shown) */
  hint?: string;
  /** Lucide icon name (left side) */
  icon?: string;
  /** Text prefix inside input */
  prefix?: string;
  /** Text suffix inside input */
  suffix?: string;
  /** Input size */
  size?: 'sm' | 'md' | 'lg';
  /** Disabled state */
  disabled?: boolean;
  /** Required field */
  required?: boolean;
  /** Input ID (auto-generated if not provided) */
  id?: string;
  /** Max length */
  maxLength?: number;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Input handler (for immediate feedback) */
  onInput?: (value: string) => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Additional class names */
  className?: string;
}

let inputIdCounter = 0;

export function Input({
  type = 'text',
  label,
  placeholder,
  value,
  error,
  hint,
  icon,
  prefix,
  suffix,
  size = 'md',
  disabled = false,
  required = false,
  id,
  maxLength,
  onChange,
  onInput,
  onBlur,
  className = '',
}: InputProps) {
  const inputId = id || `input-${++inputIdCounter}`;

  const wrapperClasses = [
    'input-wrapper',
    error && 'input-wrapper--error',
    disabled && 'input-wrapper--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inputClasses = [
    'input',
    `input--${size}`,
    icon && 'input--with-icon',
    prefix && 'input--with-prefix',
    suffix && 'input--with-suffix',
    error && 'input--error',
  ]
    .filter(Boolean)
    .join(' ');

  const handleInput = (e: React.FormEvent) => {
    const target = e.target as HTMLInputElement;
    onInput?.(target.value);
    onChange?.(target.value);
  };

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}

      <div className="input-container">
        {icon && <InputIcon name={icon} />}
        {prefix && <span className="input-prefix">{prefix}</span>}

        <input
          id={inputId}
          type={type}
          className={inputClasses}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          onInput={handleInput}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        />

        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>

      {error && (
        <p id={`${inputId}-error`} className="input-error" role="alert">
          {error}
        </p>
      )}

      {!error && hint && (
        <p id={`${inputId}-hint`} className="input-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Simple icon renderer for input icons.
 */
function InputIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    search: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    mail: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    lock: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    user: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  };

  return <span className="input-icon">{icons[name] || null}</span>;
}

export default Input;
