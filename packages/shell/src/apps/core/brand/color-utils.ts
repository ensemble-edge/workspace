/**
 * Color Utility Functions
 *
 * Palette generation, color conversion (hex <-> HSL <-> RGB),
 * and WCAG luminance calculations for the Brand Manager.
 */

/**
 * Palette interface for color shades.
 */
export interface Palette {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

/**
 * Calculate relative luminance per WCAG 2.1.
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex to RGB.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert hex to HSL.
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex.
 */
export function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1/3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a full palette from a single accent color.
 */
export function generatePalette(hex: string): Palette {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      400: '#60a5fa', 500: hex, 600: '#2563eb', 700: '#1d4ed8',
      800: '#1e40af', 900: '#1e3a8a',
    };
  }

  const { h, s } = hsl;
  const lightnesses: Record<number, number> = {
    50: 97, 100: 94, 200: 86, 300: 76, 400: 64,
    500: 50, 600: 42, 700: 35, 800: 28, 900: 22,
  };

  return {
    50: hslToHex(h, s, lightnesses[50]),
    100: hslToHex(h, s, lightnesses[100]),
    200: hslToHex(h, s, lightnesses[200]),
    300: hslToHex(h, s, lightnesses[300]),
    400: hslToHex(h, s, lightnesses[400]),
    500: hslToHex(h, s, lightnesses[500]),
    600: hslToHex(h, s, lightnesses[600]),
    700: hslToHex(h, s, lightnesses[700]),
    800: hslToHex(h, s, lightnesses[800]),
    900: hslToHex(h, s, lightnesses[900]),
  };
}
