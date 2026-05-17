/**
 * Fallback Google Fonts catalog — bundled into the shell.
 *
 * Used when the workspace's /_ensemble/core/fonts/google proxy endpoint
 * fails (KV cache corruption, upstream Google Fonts unreachable from
 * Cloudflare, etc.). Means the operator always sees *some* picker, even
 * when the live catalog can't load.
 *
 * Top ~40 most-popular fonts as of late 2026 — covers the families an
 * operator is overwhelmingly likely to want. Each entry mirrors the
 * shape returned by the proxy endpoint.
 */

export interface FallbackFont {
  family: string;
  category: string;
  variants: string[];
  popularity: number;
}

export const FALLBACK_GOOGLE_FONTS: FallbackFont[] = [
  // Sans Serif — bread and butter
  { family: 'Roboto',           category: 'sans-serif', variants: ['100', '100i', '300', '300i', '400', '400i', '500', '500i', '700', '700i', '900', '900i'], popularity: 1 },
  { family: 'Inter',            category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], popularity: 2 },
  { family: 'Open Sans',        category: 'sans-serif', variants: ['300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i'], popularity: 3 },
  { family: 'Lato',             category: 'sans-serif', variants: ['100', '100i', '300', '300i', '400', '400i', '700', '700i', '900', '900i'], popularity: 4 },
  { family: 'Montserrat',       category: 'sans-serif', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 5 },
  { family: 'Poppins',          category: 'sans-serif', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 6 },
  { family: 'Nunito',           category: 'sans-serif', variants: ['200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 7 },
  { family: 'Nunito Sans',      category: 'sans-serif', variants: ['200', '200i', '300', '300i', '400', '400i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 8 },
  { family: 'DM Sans',          category: 'sans-serif', variants: ['400', '400i', '500', '500i', '700', '700i'], popularity: 9 },
  { family: 'Manrope',          category: 'sans-serif', variants: ['200', '300', '400', '500', '600', '700', '800'], popularity: 10 },
  { family: 'Work Sans',        category: 'sans-serif', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 11 },
  { family: 'Rubik',            category: 'sans-serif', variants: ['300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 12 },
  { family: 'Plus Jakarta Sans', category: 'sans-serif', variants: ['200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i'], popularity: 13 },
  { family: 'Outfit',           category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], popularity: 14 },
  { family: 'Geist',            category: 'sans-serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], popularity: 15 },
  { family: 'Public Sans',      category: 'sans-serif', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 16 },
  { family: 'IBM Plex Sans',    category: 'sans-serif', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i'], popularity: 17 },
  { family: 'Source Sans 3',    category: 'sans-serif', variants: ['200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 18 },
  { family: 'Karla',            category: 'sans-serif', variants: ['200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i'], popularity: 19 },
  { family: 'Mulish',           category: 'sans-serif', variants: ['200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i', '1000', '1000i'], popularity: 20 },

  // Serif
  { family: 'Playfair Display', category: 'serif', variants: ['400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 30 },
  { family: 'Merriweather',     category: 'serif', variants: ['300', '300i', '400', '400i', '700', '700i', '900', '900i'], popularity: 31 },
  { family: 'PT Serif',         category: 'serif', variants: ['400', '400i', '700', '700i'], popularity: 32 },
  { family: 'Lora',             category: 'serif', variants: ['400', '400i', '500', '500i', '600', '600i', '700', '700i'], popularity: 33 },
  { family: 'Roboto Slab',      category: 'serif', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], popularity: 34 },
  { family: 'Source Serif 4',   category: 'serif', variants: ['200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 35 },
  { family: 'Crimson Text',     category: 'serif', variants: ['400', '400i', '600', '600i', '700', '700i'], popularity: 36 },
  { family: 'Spectral',         category: 'serif', variants: ['200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i'], popularity: 37 },
  { family: 'EB Garamond',      category: 'serif', variants: ['400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i'], popularity: 38 },
  { family: 'Bitter',           category: 'serif', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 39 },

  // Display
  { family: 'Oswald',           category: 'display', variants: ['200', '300', '400', '500', '600', '700'], popularity: 50 },
  { family: 'Bebas Neue',       category: 'display', variants: ['400'], popularity: 51 },
  { family: 'Archivo',          category: 'display', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 52 },
  { family: 'Anton',            category: 'display', variants: ['400'], popularity: 53 },
  { family: 'Gloock',           category: 'display', variants: ['400'], popularity: 54 },

  // Monospace
  { family: 'JetBrains Mono',   category: 'monospace', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i'], popularity: 60 },
  { family: 'Roboto Mono',      category: 'monospace', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i'], popularity: 61 },
  { family: 'Fira Code',        category: 'monospace', variants: ['300', '400', '500', '600', '700'], popularity: 62 },
  { family: 'IBM Plex Mono',    category: 'monospace', variants: ['100', '100i', '200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i'], popularity: 63 },
  { family: 'Source Code Pro',  category: 'monospace', variants: ['200', '200i', '300', '300i', '400', '400i', '500', '500i', '600', '600i', '700', '700i', '800', '800i', '900', '900i'], popularity: 64 },
  { family: 'Space Mono',       category: 'monospace', variants: ['400', '400i', '700', '700i'], popularity: 65 },

  // Handwriting / Script — usually rare but worth a few
  { family: 'Caveat',           category: 'handwriting', variants: ['400', '500', '600', '700'], popularity: 70 },
  { family: 'Dancing Script',   category: 'handwriting', variants: ['400', '500', '600', '700'], popularity: 71 },
  { family: 'Pacifico',         category: 'handwriting', variants: ['400'], popularity: 72 },
];
