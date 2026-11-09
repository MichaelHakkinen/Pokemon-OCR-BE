import { toBoolean } from './transform.helper';

describe('toBoolean', () => {
  it.each([
    [true, true],
    [false, false],
    ['true', true],
    ['false', false],
  ])('maps %p to %p', (value, expected) => {
    expect(toBoolean({ value })).toBe(expected);
  });

  it.each([['maybe'], ['yes'], ['1'], [1], ['']])(
    'passes %p through unchanged so @IsBoolean rejects it',
    (value) => {
      expect(toBoolean({ value })).toBe(value);
    },
  );

  it('leaves an omitted field undefined', () => {
    expect(toBoolean({ value: undefined })).toBeUndefined();
  });
});
