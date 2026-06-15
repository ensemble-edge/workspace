/**
 * BrandCard — unified display unit for a workspace's brand color system.
 *
 * v0.1.55. Single component, two consumers, two modes:
 *
 *   Consumers:
 *     - Brand Overview tab (display mode)
 *     - /brand public guide (display mode)
 *     - Brand Colors editor tab (edit mode — hosts inline editors)
 *
 *   Modes:
 *     - display: click-to-copy swatches, no inputs, no pickers
 *     - edit: name/gradient-name become inline-editable inputs;
 *             Main faces and rung swatches open ColorPicker popovers
 *
 * The component receives a "resolved" data structure (every rung +
 * theme binding pre-resolved to hex) via the `data` prop. Resolution
 * lives in @ensemble-edge/core (services/brand-colors/resolver.ts);
 * this component is render-only.
 *
 * Sections (in order):
 *   1. Brand palettes — 3-up grid of Primary, Secondary, Accent
 *   2. Neutral — single horizontal strip with five rungs
 *   3. Gradients — stacked named banners (hidden when empty)
 *   4. Semantic — 4-up grid of state-color pairs
 *
 * Every swatch is click-to-copy with toast confirmation. Hover
 * affordances follow the card spec (brightness 0.97 on filled
 * faces, translateY -1px on chips).
 */
import * as React from 'react';
export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
export type ResolvedPalette = Record<RungName, string>;
export type ResolvedPalettes = Record<PaletteRole, ResolvedPalette>;
export interface BrandCardPalette {
    /** Operator-facing display name like "Ownly Coral". */
    name: string;
    /** Operator-typed Main hex. */
    main: string;
    hueMode?: 'branded' | 'warm' | 'cool' | 'true' | 'custom';
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
    /** Neutral palette only — change the hue mode (Branded / Warm /
     *  Cool / True / Custom). Wired by the ColorsTab editor; ignored
     *  in display mode. */
    onNeutralHueModeChange?: (hueMode: 'branded' | 'warm' | 'cool' | 'true' | 'custom') => void;
    onGradientNameChange?: (slug: string, name: string) => void;
    onSemanticChange?: (role: 'success' | 'info' | 'warning' | 'error', which: 'main' | 'light', hex: string) => void;
    /**
     * v0.1.101: optional render slot for an "Additional accents" section.
     * Renders between Section 1 (Brand palettes) and Section 2 (Neutral).
     * The host (ColorsTab in edit mode, OverviewTab in display mode)
     * passes the JSX in; BrandCard just renders it where it belongs in
     * the visual hierarchy. Kept as a slot rather than a built-in
     * section so the editor vs. display tabs can each control their
     * own affordances without forking BrandCard.
     */
    accentExtrasSlot?: React.ReactNode;
    className?: string;
}
export declare function BrandCard({ data, mode, size, onPaletteNameChange, onPaletteMainChange, onRungOverride, onNeutralHueModeChange, onGradientNameChange, onSemanticChange, accentExtrasSlot, className, }: BrandCardProps): import("react/jsx-runtime").JSX.Element;
export default BrandCard;
//# sourceMappingURL=BrandCard.d.ts.map