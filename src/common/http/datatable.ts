import type { DatatableType, SortDirection } from 'src/types/datatable';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export type ListQuery = {
  page?: unknown;
  limit?: unknown;
  sort?: unknown;
  sortDirection?: unknown;
  q?: unknown;
};

export type ListQueryOptions = {
  /** Columns clients may sort by. Anything else falls back to defaultSort. */
  sortable: readonly string[];
  defaultSort?: string;
  defaultDirection?: SortDirection;
  filter?: DatatableType['filter'];
};

// A repeated query key (?q=a&q=b) arrives as an array — use the first value.
const first = (value: unknown): string | undefined => {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string'
    ? v
    : v === undefined || v === null
      ? undefined
      : String(v);
};

const positiveInt = (value: unknown): number | undefined => {
  const n = Number(first(value));
  return Number.isInteger(n) && n >= 1 ? n : undefined;
};

/**
 * Turns raw list query params into a safe DatatableType. Bad values are
 * fixed up silently, never passed to Prisma:
 * - page: whole number >= 1, otherwise 1
 * - limit: 1..MAX_PAGE_SIZE (larger values are capped), otherwise the default
 * - sort: only a column listed in `sortable` (so never e.g. "password"),
 *   otherwise `defaultSort`
 * - sortDirection: 'asc' | 'desc', otherwise the default
 *
 *   const datatable = toDatatable({ page, limit, sort, sortDirection, q }, {
 *     sortable: ['name', 'createdAt'],
 *   });
 */
export function toDatatable(
  query: ListQuery,
  options: ListQueryOptions,
): DatatableType {
  const defaultSort = options.defaultSort ?? 'createdAt';
  const defaultDirection = options.defaultDirection ?? 'desc';

  const page = positiveInt(query.page) ?? 1;
  const limit = Math.min(
    positiveInt(query.limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const sortParam = first(query.sort);
  const sort =
    sortParam && options.sortable.includes(sortParam) ? sortParam : defaultSort;
  const directionParam = first(query.sortDirection)?.toLowerCase();
  const sortDirection: SortDirection =
    directionParam === 'asc' || directionParam === 'desc'
      ? directionParam
      : defaultDirection;
  const search = queryString(query.q);

  return {
    page,
    limit,
    search,
    sort,
    sortDirection,
    filter: options.filter ?? null,
    offset: (page - 1) * limit,
  };
}

/** A text query param: first value if repeated, trimmed; empty → null. */
export function queryString(value: unknown): string | null {
  return first(value)?.trim() || null;
}

/**
 * A yes/no query param: "true"/"false" (any case) → boolean; anything else
 * (missing, "yes", "1", repeated garbage) → undefined, i.e. "don't filter".
 * Previously e.g. status=yes silently meant "inactive only".
 */
export function queryFlag(value: unknown): boolean | undefined {
  const v = first(value)?.trim().toLowerCase();
  return v === 'true' ? true : v === 'false' ? false : undefined;
}
