import { z } from "zod";

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/**
 * Cursor pagination query (`?cursor=&limit=`).
 * `limit` is clamped to {@link MAX_PAGE_LIMIT} (SP-009 AC-3).
 */
export const cursorPaginationQuerySchema = z
  .object({
    cursor: z.string().min(1).max(500).optional(),
    limit: z
      .union([z.string(), z.number()])
      .optional()
      .transform((raw): number => {
        if (raw === undefined || raw === "") return DEFAULT_PAGE_LIMIT;
        const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
        if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
        return Math.min(Math.floor(parsed), MAX_PAGE_LIMIT);
      }),
  })
  .meta({ id: "CursorPaginationQuery" });

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

export const cursorPageMetaSchema = z
  .object({
    nextCursor: z.string().nullable(),
    limit: z.number().int().positive().max(MAX_PAGE_LIMIT),
  })
  .meta({ id: "CursorPageMeta" });

export type CursorPageMeta = z.infer<typeof cursorPageMetaSchema>;

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  limit: number;
};

/**
 * Build a cursor page from a `limit + 1` fetch (or an explicit `hasMore` flag).
 * When more results exist, `nextCursor` is derived from the last returned item.
 */
export function createCursorPage<T>(input: {
  items: T[];
  limit: number;
  getCursor: (item: T) => string;
  /** When set, overrides the `items.length > limit` heuristic. */
  hasMore?: boolean;
}): CursorPage<T> {
  const limit = Math.min(Math.max(1, input.limit), MAX_PAGE_LIMIT);
  const hasMore = input.hasMore ?? input.items.length > limit;
  const pageItems = hasMore ? input.items.slice(0, limit) : input.items;
  const last = pageItems.at(-1);
  const nextCursor = hasMore && last !== undefined ? input.getCursor(last) : null;

  return {
    items: pageItems,
    nextCursor,
    limit,
  };
}
