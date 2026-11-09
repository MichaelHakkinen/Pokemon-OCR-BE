import { ConflictException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ErrorMessageHelper } from './error-message.helper';

/** Emails are stored trimmed and lowercase; empty means "no email". */
export function normalizeEmail(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const email = String(value).trim().toLowerCase();
  return email === '' ? null : email;
}

/**
 * DTO decorator: normalises an email field before validation, so every
 * write and lookup uses the same form ("Ann@X.com " -> "ann@x.com") and the
 * unique index on email is effectively case-insensitive.
 */
export const NormalizeEmail = () =>
  Transform(({ value }) => normalizeEmail(value));

type EmailLookup = {
  findFirst(args: {
    where: { email: string; id?: { not: string } };
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

/**
 * Throws 409 EMAIL_ALREADY_EXISTS if another row of `table` (soft-deleted
 * rows included, matching the unique index) already uses `email`.
 *
 *   await assertEmailAvailable(this.prisma.admin, dto.email, adminId);
 */
export async function assertEmailAvailable(
  table: EmailLookup,
  email: string | null | undefined,
  excludeId?: string,
): Promise<void> {
  if (!email) return;
  const existing = await table.findFirst({
    where: { email, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictException(
      ErrorMessageHelper.getMultiLanguageMessage('EMAIL_ALREADY_EXISTS'),
    );
  }
}
