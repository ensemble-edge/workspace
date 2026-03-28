export interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div class={`ens-avatar ens-avatar--${size}`}>
      {src ? <img src={src} alt={name} /> : <span>{initials}</span>}
    </div>
  );
}
