export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
export type PaletteRungRef = `${PaletteRole}-${RungName}`;
export type ResolvedPalettes = Record<PaletteRole, Record<RungName, string>>;
/** v0.1.60: gradient option in the picker. When `allowGradient` is
 *  true, the host passes the workspace's defined gradients (slug +
 *  name + a resolved CSS string for preview) and operators can pick
 *  one. Stored value becomes "gradient-<slug>". */
export interface PickableGradient {
    /** Stable slug. Stored value is "gradient-<slug>". */
    slug: string;
    /** Operator-facing display name (for the picker chip label). */
    name: string;
    /** Resolved CSS gradient string for the chip swatch preview. */
    css: string;
}
export interface BrandTokenPickerProps {
    /** Current stored value — token ref, hex, gradient ref, auto, or
     *  system token. Examples: "primary-main", "gradient-sunrise",
     *  "#FF6B35", "auto", "white". */
    value: string;
    /** Called with the new stored value. */
    onChange: (next: string) => void;
    /** Resolved palettes so we can show actual color chips next to ref labels. */
    palettes: ResolvedPalettes;
    /** Enable a "Custom hex" tab. Default false. */
    allowHex?: boolean;
    /** Enable "Auto (APCA)" option. Default false. */
    allowAuto?: boolean;
    /** Enable system tokens 'white' and 'black'. Default false. */
    allowSystem?: boolean;
    /** v0.1.60: enable gradient refs. Host must pass `gradients` too. */
    allowGradient?: boolean;
    /** Available gradients to pick from. Required when allowGradient is
     *  true; ignored otherwise. */
    gradients?: PickableGradient[];
    /** Optional restriction to specific palette roles (used by gradient
     *  stops where neutral might be excluded). Default: all four. */
    allowedRoles?: PaletteRole[];
    /** Trigger label override. */
    label?: string;
    className?: string;
}
export declare function BrandTokenPicker({ value, onChange, palettes, allowHex, allowAuto, allowSystem, allowGradient, gradients, allowedRoles, label, className, }: BrandTokenPickerProps): import("react/jsx-runtime").JSX.Element;
export default BrandTokenPicker;
//# sourceMappingURL=BrandTokenPicker.d.ts.map