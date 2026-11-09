import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  parseBooleanCell,
  pickColumn,
  readSpreadsheet,
} from './spreadsheet.helper';

async function xlsx(rows: ExcelJS.CellValue[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('readSpreadsheet', () => {
  it('turns every xlsx cell into the text a user sees', async () => {
    const buf = await xlsx([
      ['Title', 'Media URL', 'Is Active', 'Order', 'Note'],
      [
        123, // number title
        {
          text: 'https://cdn.example.com/a.png',
          hyperlink: 'https://cdn.example.com/a.png',
        },
        false, // Excel FALSE
        { formula: '1+1', result: 2 },
        { richText: [{ text: 'Rich ' }, { text: 'text' }] },
      ],
    ]);
    const [row] = await readSpreadsheet(buf, 'xlsx', { maxRows: 10 });
    expect(row).toEqual({
      title: '123',
      'media url': 'https://cdn.example.com/a.png',
      'is active': 'false',
      order: '2',
      note: 'Rich text',
    });
  });

  it('reads CSV with a BOM and normalised headers', async () => {
    const csv = Buffer.from('﻿Title , MediaUrl\n Hello ,https://x.io/a.png\n');
    expect(await readSpreadsheet(csv, 'csv', { maxRows: 10 })).toEqual([
      { title: 'Hello', mediaurl: 'https://x.io/a.png' },
    ]);
  });

  it('rejects files with too many rows', async () => {
    const csv = Buffer.from('title\n' + 'x\n'.repeat(4));
    await expect(
      readSpreadsheet(csv, 'csv', { maxRows: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('turns an unparseable workbook (e.g. a renamed .xls) into a 400', async () => {
    const legacyXls = Buffer.from([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0,
    ]);
    await expect(
      readSpreadsheet(legacyXls, 'xlsx', { maxRows: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('pickColumn / parseBooleanCell', () => {
  it('takes the first non-empty alias', () => {
    expect(
      pickColumn({ link: '', url: '/a' }, ['urlTarget', 'link', 'url']),
    ).toBe('/a');
    expect(pickColumn({}, ['x'])).toBe('');
  });

  it.each([
    ['', true, true],
    ['FALSE', true, false],
    ['0', true, false],
    ['Inactive', true, false],
    ['yes', false, true],
    ['maybe', true, undefined],
  ])('parseBooleanCell(%p, %p) → %p', (value, fallback, expected) => {
    expect(parseBooleanCell(value, fallback)).toBe(expected);
  });
});
