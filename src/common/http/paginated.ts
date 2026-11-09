export type Pagination = {
  totalCount: number;
  currentPage: number;
  lowestNumber: number;
  highestNumber: number;
};

// Return this from a handler to get `pagination` alongside `data` in the
// response envelope.
export class Paginated<T> {
  constructor(
    readonly pagination: Pagination,
    readonly data: T,
  ) {}
}
