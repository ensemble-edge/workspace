/**
 * ColorPicker Component
 *
 * Native color input combined with hex text input.
 * Includes luminance indicator for accessibility preview.
 *
 * Features:
 * - Color swatch with native picker
 * - Hex text input with validation
 * - Luminance indicator (light/dark text preview)
 * - Accessibility-aware contrast indication
 */

import * as React from 'react';
import { useState, useEffect } from 'react';

export interface ColorPickerProps {
  /** Current color value (hex) */
  value: string;
  /** Change handler */
  onChange: (color: string) => void;
  /** Optional label */
  label?: string;
  /** Additional class names */
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  label,
  className = '',
}: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexChange = (e: React.FormEvent) => {
    const input = e.target as HTMLInputElement;
    let hex = input.value;

    // Add # if missing
    if (hex && !hex.startsWith('#')) {
      hex = '#' + hex;
    }

    setHexInput(hex);

    // Validate hex color
    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
    setIsValid(isValidHex);

    if (isValidHex) {
      onChange(hex);
    }
  };

  const handleColorInput = (e: React.FormEvent) => {
    const input = e.target as HTMLInputElement;
    onChange(input.value);
    setHexInput(input.value);
    setIsValid(true);
  };

  const classes = ['color-picker', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {label && <label className="color-picker__label">{label}</label>}
      <div className="color-picker__row">
        {/* Color swatch with native picker */}
        <div
          className="color-picker__swatch"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onInput={handleColorInput}
            className="color-picker__native"
            aria-label="Pick color"
          />
        </div>

        {/* Hex text input */}
        <input
          type="text"
          value={hexInput}
          onInput={handleHexChange}
          className={`input color-picker__hex ${!isValid ? 'input--error' : ''}`}
          placeholder="#3B82F6"
          maxLength={7}
          aria-label="Hex color value"
        />

        {/* Luminance indicator */}
        <div className="color-picker__luminance">
          <LuminanceIndicator color={value} />
        </div>
      </div>
    </div>
  );
}

/**
 * LuminanceIndicator Component
 *
 * Shows whether the color works best with light or dark text.
 * Uses relative luminance calculation per WCAG.
 */
interface LuminanceIndicatorProps {
  color: string;
}

function LuminanceIndicator({ color }: LuminanceIndicatorProps) {
  const luminance = getRelativeLuminance(color);
  const useLight = luminance < 0.5;

  return (
    <div
      className="luminance-indicator"
      style={{ backgroundColor: color }}
      title={`Luminance: ${(luminance * 100).toFixed(0)}% - Use ${useLight ? 'light' : 'dark'} text`}
    >
      <span style={{ color: useLight ? '#ffffff' : '#000000' }}>A</span>
    </div>
  );
}

/**
 * Calculate relative luminance per WCAG 2.1.
 */
function getRelativeLuminance(hex: string): number {
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
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export default ColorPicker;
