export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  onInput?: (value: string) => void;
}

export function Input({
  type = 'text',
  placeholder,
  value,
  disabled,
  onInput,
}: InputProps) {
  return (
    <input
      class="ens-input"
      type={type}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onInput={(e) => onInput?.((e.target as HTMLInputElement).value)}
    />
  );
}
