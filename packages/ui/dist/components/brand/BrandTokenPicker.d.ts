export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
export type PaletteRungRef = `${PaletteRole}-${RungName}`;
export type ResolvedPalettes = Record<PaletteRole, Record<RungName, string>>;
export interface BrandTokenPickerProps {
    /** Current stored value — token ref, hex, or "auto"/"white"/"black". */
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
    /** Optional restriction to specific palette roles (used by gradient
     *  stops where neutral might be excluded). Default: all four. */
    allowedRoles?: PaletteRole[];
    /** Trigger label override. */
    label?: string;
    className?: string;
}
export declare function BrandTokenPicker({ value, onChange, palettes, allowHex, allowAuto, allowSystem, allowedRoles, label, className, }: BrandTokenPickerProps): import("react/jsx-runtime").JSX.Element;
export default BrandTokenPicker;
//# sourceMappingURL=BrandTokenPicker.d.ts.map