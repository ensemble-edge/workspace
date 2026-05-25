import * as React from "react";
/**
 * FontCombobox — typeahead picker for font families.
 *
 * Renders a single Combobox (Command + Popover) with:
 *   - Pinned "System defaults" group at top (instant render, no network)
 *   - "Recently picked" group (passed in via prop)
 *   - All available Google Fonts grouped by category
 *   - Each option's name rendered IN ITS OWN FONT (lazy-loaded as
 *     options come into view via IntersectionObserver)
 *   - Type-ahead filter handled by the underlying Command primitive
 *
 * Designed to handle ~1500 entries fluidly. Uses Command's built-in
 * filtering (cmdk under the hood) which does fuzzy matching.
 *
 * The lazy font-CSS loader maintains a module-level Set so a family
 * loaded for the picker is reused if the operator picks it (no re-fetch).
 */
export interface FontComboboxOption {
    family: string;
    category: string;
    /** Optional secondary label (e.g. 'System', or weight count). */
    hint?: string;
}
export interface FontComboboxProps {
    /** Currently selected family name. */
    value: string;
    onChange: (family: string) => void;
    /** Pinned system defaults (always shown at top). */
    systemFonts: FontComboboxOption[];
    /** Full Google Fonts catalog (or subset). */
    googleFonts: FontComboboxOption[];
    /** Recently picked families to highlight. */
    recent?: string[];
    /**
     * Optional hook: fired on first non-empty search input. Parents wire
     * this to a live catalog fetch so typeahead reaches the full Google
     * Fonts list even when the visible `googleFonts` prop is a curated
     * subset (e.g. the bundled top-40 fallback). Called at most once.
     */
    onFirstSearch?: () => void;
    /** Disable the combobox. */
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}
export declare const FontCombobox: React.ForwardRefExoticComponent<FontComboboxProps & React.RefAttributes<HTMLButtonElement>>;
//# sourceMappingURL=font-combobox.d.ts.map