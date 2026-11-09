import {
  MAX_PAGE_SIZE,
  queryFlag,
  queryString,
  toDatatable,
} from './datatable';

describe('toDatatable', () => {
  const sortable = ['name', 'createdAt'] as const;

  it('uses defaults when nothing is given', () => {
    expect(toDatatable({}, { sortable })).toEqual({
      page: 1,
      limit: 10,
      search: null,
      sort: 'createdAt',
      sortDirection: 'desc',
      filter: null,
      offset: 0,
    });
  });

  it('keeps valid values and computes the offset', () => {
    expect(
      toDatatable(
        {
          page: '3',
          limit: '20',
          sort: 'name',
          sortDirection: 'ASC',
          q: ' a ',
        },
        { sortable },
      ),
    ).toMatchObject({
      page: 3,
      limit: 20,
      sort: 'name',
      sortDirection: 'asc',
      search: 'a',
      offset: 40,
    });
  });

  it.each([['abc'], ['0'], ['-2'], ['1.5'], ['']])(
    'fixes page=%p up to 1',
    (page) => {
      expect(toDatatable({ page }, { sortable }).page).toBe(1);
    },
  );

  it('caps limit and falls back on garbage', () => {
    expect(toDatatable({ limit: '1000000' }, { sortable }).limit).toBe(
      MAX_PAGE_SIZE,
    );
    expect(toDatatable({ limit: 'x' }, { sortable }).limit).toBe(10);
  });

  it('never sorts by a column outside the allow-list', () => {
    expect(toDatatable({ sort: 'password' }, { sortable }).sort).toBe(
      'createdAt',
    );
    expect(
      toDatatable(
        { sort: 'password', sortDirection: 'sideways' },
        { sortable, defaultSort: 'name', defaultDirection: 'asc' },
      ),
    ).toMatchObject({ sort: 'name', sortDirection: 'asc' });
  });

  it('takes the first value of repeated params', () => {
    expect(
      toDatatable({ page: ['2', '9'], q: ['x', 'y'] }, { sortable }),
    ).toMatchObject({ page: 2, search: 'x' });
  });

  it('passes the filter through', () => {
    expect(
      toDatatable({}, { sortable, filter: { moduleId: 'm' } }).filter,
    ).toEqual({ moduleId: 'm' });
  });
});

describe('queryString', () => {
  it('trims, takes the first value, and maps empty to null', () => {
    expect(queryString(' hi ')).toBe('hi');
    expect(queryString(['a', 'b'])).toBe('a');
    expect(queryString('   ')).toBeNull();
    expect(queryString(undefined)).toBeNull();
  });
});

describe('queryFlag', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['false', false],
    [' False ', false],
    [['true', 'false'], true],
  ])('%p → %p', (value, expected) => {
    expect(queryFlag(value)).toBe(expected);
  });

  it.each([['yes'], ['1'], [''], [undefined]])(
    '%p → undefined (no filter)',
    (value) => {
      expect(queryFlag(value)).toBeUndefined();
    },
  );
});
