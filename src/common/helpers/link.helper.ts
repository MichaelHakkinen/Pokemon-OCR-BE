import { ValidateBy, ValidationOptions } from 'class-validator';

/**
 * A "safe link" is where a client may send users: an absolute http(s) URL,
 * or an app path starting with a single "/" (e.g. "/promo/123"). Everything
 * else — javascript:, data:, vbscript:, protocol-relative "//evil.com",
 * whitespace or control characters — is rejected, so stored links can be
 * rendered as <a href> without becoming XSS or open-redirect vectors.
 */
export function isSafeLink(value: unknown): boolean {
  if (typeof value !== 'string' || value === '' || value.trim() !== value) {
    return false;
  }
  if (/[\s\u0000-\u001f\u007f\\]/.test(value)) return false;

  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && !!url.host
    );
  } catch {
    return false;
  }
}

/**
 * DTO decorator for link fields (see isSafeLink). Message key IS_SAFE_LINK is
 * translated by TranslatedValidationPipe.
 *
 *   @IsOptional()
 *   @IsSafeLink()
 *   urlTarget?: string;
 */
export const IsSafeLink = (options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isSafeLink',
      validator: { validate: (value) => isSafeLink(value) },
    },
    { message: 'IS_SAFE_LINK', ...options },
  );
