export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export function Select({
  options,
  value,
  placeholder,
  disabled,
  onChange,
}: SelectProps) {
  return (
    <select
      class="ens-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.((e.target as HTMLSelectElement).value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
