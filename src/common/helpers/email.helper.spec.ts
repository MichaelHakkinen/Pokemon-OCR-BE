import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  assertEmailAvailable,
  NormalizeEmail,
  normalizeEmail,
} from './email.helper';

describe('email helper', () => {
  it.each([
    [' Ann@Example.COM ', 'ann@example.com'],
    ['', null],
    ['   ', null],
    [null, null],
    [undefined, undefined],
  ])('normalizeEmail(%p) → %p', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it('normalises DTO fields', () => {
    class Dto {
      @NormalizeEmail()
      email?: string;
    }
    expect(plainToInstance(Dto, { email: 'Mixed@Case.io' }).email).toBe(
      'mixed@case.io',
    );
  });

  it('409s when another row has the email, ignoring the row itself', async () => {
    const table = {
      findFirst: jest.fn(async ({ where }) =>
        where.email === 'taken@x.io' && where.id?.not !== 'owner'
          ? { id: 'owner' }
          : null,
      ),
    };
    await expect(
      assertEmailAvailable(table, 'taken@x.io'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      assertEmailAvailable(table, 'taken@x.io', 'owner'),
    ).resolves.toBeUndefined();
    await expect(
      assertEmailAvailable(table, 'free@x.io'),
    ).resolves.toBeUndefined();
    await expect(assertEmailAvailable(table, null)).resolves.toBeUndefined();
  });
});
