export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
export type ResolvedPalette = Record<RungName, string>;
export type ResolvedPalettes = Record<PaletteRole, ResolvedPalette>;
export interface BrandCardPalette {
    /** Operator-facing display name like "Ownly Coral". */
    name: string;
    /** Operator-typed Main hex. */
    main: string;
    hueMode?: 'branded' | 'warm' | 'cool' | 'true';
}
export interface BrandCardGradient {
    slug: string;
    name: string;
    mode: 'linear' | 'radial';
    angle: 0 | 45 | 90 | 135 | 180;
    /** Resolved stops — each carries both the original token and
     *  the concrete hex (so the card can show "primary-pastel" as
     *  label and #FFD4C5 as swatch). */
    resolvedStops: Array<{
        token: string;
        hex: string;
    }>;
}
export interface BrandCardSemanticPair {
    main: string;
    light: string;
}
export interface BrandCardData {
    palettes: {
        primary: BrandCardPalette;
        secondary: BrandCardPalette;
        accent: BrandCardPalette;
        neutral: BrandCardPalette;
    };
    resolvedPalettes: ResolvedPalettes;
    /** On-color foreground per palette role — Faded rung or fallback. */
    onColor: Record<PaletteRole, {
        hex: string;
        usedFallback: boolean;
    }>;
    gradients: BrandCardGradient[];
    semantic: {
        success: BrandCardSemanticPair;
        info: BrandCardSemanticPair;
        warning: BrandCardSemanticPair;
        error: BrandCardSemanticPair;
    };
}
export type BrandCardMode = 'display' | 'edit';
export type BrandCardSize = 'default' | 'compact';
export interface BrandCardProps {
    data: BrandCardData;
    mode?: BrandCardMode;
    size?: BrandCardSize;
    /** edit-mode only: handlers for inline edits. Display mode ignores
     *  these. The host (ColorsTab) wires these to its draft state. */
    onPaletteNameChange?: (role: PaletteRole, name: string) => void;
    onPaletteMainChange?: (role: PaletteRole, hex: string) => void;
    onRungOverride?: (role: PaletteRole, rung: Exclude<RungName, 'main'>, hex: string | null) => void;
    onGradientNameChange?: (slug: string, name: string) => void;
    onSemanticChange?: (role: 'success' | 'info' | 'warning' | 'error', which: 'main' | 'light', hex: string) => void;
    className?: string;
}
export declare function BrandCard({ data, mode, size, onPaletteNameChange, onPaletteMainChange, onRungOverride, onGradientNameChange, onSemanticChange, className, }: BrandCardProps): import("react/jsx-runtime").JSX.Element;
export default BrandCard;
//# sourceMappingURL=BrandCard.d.ts.map