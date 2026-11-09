export type Pagination<T> = {
  pagination: {
    totalCount: number;
    currentPage: number;
    lowestNumber: number;
    highestNumber: number;
  };
  data: T[];
};
