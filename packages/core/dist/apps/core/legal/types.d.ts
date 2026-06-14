/**
 * Legal Center — shared types.
 *
 * The legal app models localized content as `LocalizedString` JSON
 * blobs ({"es":"…","en":"…"}) stored in `*_json` columns — the
 * convention the Curalisto prototype and product_families use. This is
 * distinct from brand_tokens' per-row `locale` column; legal docs are
 * whole-document translations, so one JSON value per field is the right
 * shape.
 */
/**
 * A map of BCP-47 locale code → string. A missing or null value for a
 * locale means "no content for that locale — fall back". The `loc()`
 * helper in the routes resolves a requested locale against this shape.
 */
export type LocalizedString = Record<string, string | null | undefined>;
/** A legal doc as stored (JSON columns parsed). */
export interface LegalDoc {
    id: string;
    slugs: LocalizedString;
    title: LocalizedString;
    description: LocalizedString | null;
    /** Prominent localized callout shown at the top of the doc (e.g. an
     *  arbitration / class-action-waiver warning). Null = no notice. */
    notice: LocalizedString | null;
    bodyMd: LocalizedString;
    lastUpdated: string;
    status: 'active' | 'archived';
    sortOrder: number;
}
/** The PUT body shape for upserting a doc (spec §3.1). */
export interface LegalDocUpsert {
    slugs: LocalizedString;
    title: LocalizedString;
    /** undefined preserves existing; null clears; object replaces. */
    description?: LocalizedString | null;
    /** undefined preserves existing; null clears; object replaces. */
    notice?: LocalizedString | null;
    bodyMd: LocalizedString;
    lastUpdated: string;
    status?: 'active' | 'archived';
    sortOrder?: number;
}
//# sourceMappingURL=types.d.ts.map