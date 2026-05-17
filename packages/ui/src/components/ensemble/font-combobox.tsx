import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

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

// ─── Lazy font-CSS loader ──────────────────────────────────────────
//
// Each Google Fonts family the picker wants to render needs a <link>
// in the document head. We track loaded families in a module-level Set
// so multiple comboboxes share one load per family, and so the load
// persists when the picker closes/reopens.

const LOADED_FAMILIES = new Set<string>();

function ensureFontLoaded(family: string): void {
  if (LOADED_FAMILIES.has(family)) return;
  if (typeof document === "undefined") return;
  LOADED_FAMILIES.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  // Only load 400 + 700 for the picker preview — enough to render the
  // family name in its natural weight. Operator-final selections trigger
  // a separate full load via the shell entry HTML.
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

// ─── Option row ────────────────────────────────────────────────────

function OptionRow({
  option,
  selected,
  systemStack,
}: {
  option: FontComboboxOption;
  selected: boolean;
  systemStack?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Lazy-load this family's CSS when the row scrolls into view.
  React.useEffect(() => {
    if (systemStack) return; // system fonts don't need loading
    const el = ref.current;
    if (!el) return;
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ensureFontLoaded(option.family);
            io.disconnect();
            break;
          }
        }
      }, { rootMargin: "100px" });
      io.observe(el);
      return () => io.disconnect();
    }
    // No IO support — load immediately.
    ensureFontLoaded(option.family);
  }, [option.family, systemStack]);

  const previewStyle: React.CSSProperties = systemStack
    ? { fontFamily: systemStack }
    : { fontFamily: `"${option.family}", sans-serif` };

  return (
    <div ref={ref} className="flex items-center w-full gap-2">
      <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      <span className="flex-1 text-base truncate" style={previewStyle}>
        {option.family}
      </span>
      {option.hint && (
        <span className="text-xs text-muted-foreground shrink-0">{option.hint}</span>
      )}
    </div>
  );
}

// ─── Combobox ──────────────────────────────────────────────────────

export const FontCombobox = React.forwardRef<HTMLButtonElement, FontComboboxProps>(
  ({ value, onChange, systemFonts, googleFonts, recent, onFirstSearch, disabled, placeholder, className }, ref) => {
    const [open, setOpen] = React.useState(false);
    const firstSearchFired = React.useRef(false);

    const handleSearchInput = React.useCallback(
      (next: string) => {
        if (!firstSearchFired.current && next.trim().length > 0 && onFirstSearch) {
          firstSearchFired.current = true;
          onFirstSearch();
        }
      },
      [onFirstSearch],
    );

    // Group Google Fonts by category for browsability.
    const groupedGoogle = React.useMemo(() => {
      const groups = new Map<string, FontComboboxOption[]>();
      for (const f of googleFonts) {
        const k = f.category || "Other";
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(f);
      }
      return groups;
    }, [googleFonts]);

    const recentOptions = React.useMemo(() => {
      if (!recent || recent.length === 0) return [];
      // Look up each recent family in the full list.
      return recent
        .map((family) =>
          systemFonts.find((s) => s.family === family) ??
          googleFonts.find((g) => g.family === family),
        )
        .filter((o): o is FontComboboxOption => !!o);
    }, [recent, systemFonts, googleFonts]);

    // Find the system stack (if any) for live preview in the trigger.
    const systemStackForTrigger = React.useMemo(() => {
      const sys = systemFonts.find((s) => s.family === value);
      return sys && "stack" in (sys as unknown as { stack?: string })
        ? ((sys as unknown as { stack: string }).stack)
        : undefined;
    }, [value, systemFonts]);

    // Eagerly load the selected family if it's a Google Font, so the
    // trigger renders in its proper face.
    React.useEffect(() => {
      if (value && !systemStackForTrigger) ensureFontLoaded(value);
    }, [value, systemStackForTrigger]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between", className)}
          >
            <span
              className="truncate text-base"
              style={
                systemStackForTrigger
                  ? { fontFamily: systemStackForTrigger }
                  : { fontFamily: `"${value}", sans-serif` }
              }
            >
              {value || placeholder || "Pick a font…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search fonts…"
              onValueChange={handleSearchInput}
            />
            <CommandList className="max-h-80">
              <CommandEmpty>No fonts match.</CommandEmpty>

              {/* Pinned system defaults */}
              <CommandGroup heading="System">
                {systemFonts.map((opt) => (
                  <CommandItem
                    key={`sys:${opt.family}`}
                    value={opt.family}
                    onSelect={() => { onChange(opt.family); setOpen(false); }}
                  >
                    <OptionRow
                      option={opt}
                      selected={value === opt.family}
                      systemStack={(opt as unknown as { stack: string }).stack}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>

              {recentOptions.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Recently picked">
                    {recentOptions.map((opt) => (
                      <CommandItem
                        key={`recent:${opt.family}`}
                        value={opt.family}
                        onSelect={() => { onChange(opt.family); setOpen(false); }}
                      >
                        <OptionRow option={opt} selected={value === opt.family} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Google Fonts, grouped by category */}
              {Array.from(groupedGoogle.entries()).map(([category, options]) => (
                <React.Fragment key={`cat:${category}`}>
                  <CommandSeparator />
                  <CommandGroup heading={prettyCategory(category)}>
                    {options.map((opt) => (
                      <CommandItem
                        key={`g:${opt.family}`}
                        value={opt.family}
                        onSelect={() => { onChange(opt.family); setOpen(false); }}
                      >
                        <OptionRow option={opt} selected={value === opt.family} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </React.Fragment>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
FontCombobox.displayName = "FontCombobox";

function prettyCategory(c: string): string {
  switch (c) {
    case "sans-serif": return "Sans Serif";
    case "serif": return "Serif";
    case "display": return "Display";
    case "monospace": return "Monospace";
    case "handwriting": return "Handwriting";
    default: return c.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
  }
}
