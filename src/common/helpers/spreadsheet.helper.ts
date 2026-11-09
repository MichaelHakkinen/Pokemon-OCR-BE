import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { ErrorMessageHelper } from './error-message.helper';

/** One spreadsheet row: lowercase, trimmed headers → cell text ('' if empty). */
export type SheetRow = Record<string, string>;

export interface ReadSheetOptions {
  /** Rows (excluding the header) allowed in one file; more → 400. */
  maxRows: number;
}

/**
 * Reads the first sheet of an .xlsx or a .csv into plain-string rows, ready
 * for DTO validation. Reusable by any module's import:
 *
 *   const rows = await readSpreadsheet(file.buffer, 'xlsx', { maxRows: 5000 });
 *   const name = pickColumn(row, ['name', 'product name']);
 *
 * Every cell becomes a string the way a user sees it — hyperlinks give their
 * text, formulas their result, booleans "true"/"false", dates ISO strings —
 * so imports never get objects or numbers where text is expected. Files that
 * can't be parsed (e.g. a legacy .xls renamed .xlsx) are a 400, not a 500.
 */
export async function readSpreadsheet(
  buffer: Buffer,
  type: 'xlsx' | 'csv',
  options: ReadSheetOptions,
): Promise<SheetRow[]> {
  let rows: SheetRow[];
  try {
    rows = type === 'xlsx' ? await readXlsx(buffer) : await readCsv(buffer);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(
      ErrorMessageHelper.getMultiLanguageMessage('FILE_PARSE_ERROR'),
    );
  }

  if (rows.length > options.maxRows) {
    throw new BadRequestException(
      ErrorMessageHelper.getMultiLanguageMessageWithReplace(
        'IMPORT_TOO_MANY_ROWS',
        { max: String(options.maxRows) },
      ),
    );
  }
  return rows;
}

/** First non-empty value among header aliases (empty string if none). */
export function pickColumn(row: SheetRow, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias.toLowerCase()];
    if (value !== undefined && value !== '') return value;
  }
  return '';
}

/**
 * Parses a yes/no cell. Empty → `fallback`; unrecognised → undefined (so the
 * caller can report it instead of guessing — the old code turned FALSE into
 * true via `value || true`).
 */
export function parseBooleanCell(
  value: string,
  fallback: boolean,
): boolean | undefined {
  const v = value.trim().toLowerCase();
  if (v === '') return fallback;
  if (['true', '1', 'yes', 'y', 'active'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'inactive'].includes(v)) return false;
  return undefined;
}

/** A cell's value as the user sees it. */
export function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('hyperlink' in value) {
      const text = (value as ExcelJS.CellHyperlinkValue).text;
      return cellToText(text as ExcelJS.CellValue) || value.hyperlink;
    }
    if ('formula' in value || 'sharedFormula' in value) {
      return cellToText(
        (value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue,
      );
    }
    if ('error' in value) return '';
    return '';
  }
  return String(value).trim();
}

async function readXlsx(buffer: Buffer): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException(
      ErrorMessageHelper.getMultiLanguageMessage('NO_WORKSHEET_FOUND'),
    );
  }

  const headers: string[] = [];
  const rows: SheetRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, col) => {
        headers[col] = cellToText(cell.value).toLowerCase();
      });
      return;
    }
    const record: SheetRow = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (headers[col]) record[headers[col]] = cellToText(cell.value);
    });
    rows.push(record);
  });
  return rows;
}

function readCsv(buffer: Buffer): Promise<SheetRow[]> {
  return new Promise((resolve, reject) => {
    const rows: SheetRow[] = [];
    Readable.from([buffer])
      .pipe(
        csv({
          mapHeaders: ({ header }) =>
            header.replace(/^﻿/, '').trim().toLowerCase(),
          mapValues: ({ value }) => String(value ?? '').trim(),
        }),
      )
      .on('data', (row: SheetRow) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}
