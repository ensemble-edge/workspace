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
export declare function wrapPngInIco(pngBytes: Uint8Array, sizePx: number): Uint8Array;
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
export declare function buildWebManifest(inputs: ManifestInputs): string;
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
export declare function buildFaviconHeadSnippet(opts: {
    baseUrl: string;
    iconBasePath: string;
}): string;
//# sourceMappingURL=favicon.d.ts.map