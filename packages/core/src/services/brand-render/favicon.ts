/**
 * Favicon-suite generators.
 *
 * v0.1.53. Produces the canonical favicon files that, together with
 * the existing /_ensemble/brand/favicon.svg endpoint, cover every
 * browser/OS combination from IE11 onward:
 *
 *   favicon.svg              — modern browsers (already exists)
 *   favicon.ico              — legacy IE/Edge, intranet browsers
 *   favicon-32.png           — bookmark bar, downloaded shortcut
 *   favicon-180.png          — iOS home screen (apple-touch-icon)
 *   favicon-192.png          — Android home screen
 *   favicon-512.png          — Android splash, PWA icon
 *   manifest.webmanifest     — PWA + Android (references 192 + 512)
 *
 * All rasters are produced by the same Satori + resvg pipeline that
 * powers the main render endpoint. The icon-only composition at
 * full-color finish is used as the source, then resvg writes the
 * requested pixel size 1:1 (no DPI scaling).
 *
 * The PNG-in-ICO wrapper for /favicon.ico is a small hand-rolled
 * encoder — wrapping a single PNG in an ICO container is legal since
 * Windows Vista / IE11 and avoids needing a separate ICO library.
 */

/**
 * Wrap a PNG buffer in an ICO container. Modern browsers (IE11+,
 * Edge, Chrome, Firefox, Safari) all accept ICO files that contain
 * a single PNG entry — historically ICOs held BMP entries but the
 * PNG-inside-ICO format has been ubiquitously supported for ~15
 * years.
 *
 * Spec: https://docs.fileformat.com/image/ico/
 *
 * Structure:
 *   ICONDIR header (6 bytes)
 *   ICONDIRENTRY for our one image (16 bytes)
 *   The raw PNG bytes
 */
export function wrapPngInIco(pngBytes: Uint8Array, sizePx: number): Uint8Array {
  const size = sizePx >= 256 ? 0 : sizePx; // ICO encodes 256 as 0
  const pngLen = pngBytes.byteLength;

  const header = new Uint8Array(6 + 16);
  const view = new DataView(header.buffer);

  // ICONDIR
  view.setUint16(0, 0, true);   // reserved, must be 0
  view.setUint16(2, 1, true);   // type: 1 = ICO
  view.setUint16(4, 1, true);   // image count: 1

  // ICONDIRENTRY (one entry pointing at the PNG)
  header[6]  = size;            // width  (0 = 256)
  header[7]  = size;            // height (0 = 256)
  header[8]  = 0;               // palette size (0 = no palette / true color)
  header[9]  = 0;               // reserved
  view.setUint16(10, 1, true);  // color planes (PNG: 1)
  view.setUint16(12, 32, true); // bits per pixel (PNG: 32)
  view.setUint32(14, pngLen, true);     // image data size
  view.setUint32(18, 22, true);         // image data offset (header is 22 bytes)

  // Concat header + PNG bytes.
  const out = new Uint8Array(22 + pngLen);
  out.set(header, 0);
  out.set(pngBytes, 22);
  return out;
}

/**
 * Build a minimal Web App Manifest for the workspace. Referenced by
 * the favicon suite via <link rel="manifest" href="..."> and used
 * by Android to add the site to the home screen with a proper icon
 * + name + theme color.
 *
 * Operators who want PWA capabilities (offline, install prompt,
 * standalone display) extend this manifest themselves. We include
 * only the fields that affect favicon/Add-to-Home-Screen behavior.
 */
export interface ManifestInputs {
  /** Workspace display name (operator-configured). */
  name: string;
  /** Short name for crowded home-screen contexts (max ~12 chars). */
  shortName: string;
  /** Theme color — typically brand-primary. */
  themeColor: string;
  /** Background color for the splash screen — typically brand-background-light. */
  backgroundColor: string;
  /** Public base path for the icons. Either '/_ensemble/brand' or '/<alias>/brand'. */
  iconBasePath: string;
}

export function buildWebManifest(inputs: ManifestInputs): string {
  const manifest = {
    name: inputs.name,
    short_name: inputs.shortName,
    icons: [
      {
        src: `${inputs.iconBasePath}/favicon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${inputs.iconBasePath}/favicon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    theme_color: inputs.themeColor,
    background_color: inputs.backgroundColor,
  };
  return JSON.stringify(manifest, null, 2);
}

/**
 * Build the canonical `<head>` snippet operators paste into their
 * site's <head> to get every favicon variant wired up correctly.
 * Returns a string the OverviewTab's FaviconSuiteCard can render
 * inside a copyable code block.
 *
 * URLs use the operator's pretty alias when configured, falling
 * back to the canonical /_ensemble/brand path. The browser cache
 * picks one URL — bookmarking the alias form is fine because both
 * resolve to the same renderer.
 */
export function buildFaviconHeadSnippet(opts: {
  baseUrl: string;
  iconBasePath: string;
}): string {
  const u = (path: string) => `${opts.baseUrl}${opts.iconBasePath}${path}`;
  return [
    '<!-- Favicon suite — Ensemble Workspace -->',
    `<link rel="icon" type="image/svg+xml" href="${u('/favicon.svg')}">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${u('/favicon-32.png')}">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${u('/favicon-180.png')}">`,
    `<link rel="manifest" href="${u('/manifest.webmanifest')}">`,
  ].join('\n');
}
