import { UnprocessableEntityException } from '@nestjs/common';
import { UuidPipe } from './uuid.pipe';

const UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const meta = (data = 'id') => ({ type: 'param' as const, data });

describe('UuidPipe', () => {
  it('passes valid UUIDs through', () => {
    expect(new UuidPipe().transform(UUID, meta())).toBe(UUID);
  });

  it.each(['not-a-uuid', '123', '', "1' OR '1'='1", `${UUID}x`])(
    'rejects %p with a 422',
    (value) => {
      expect(() => new UuidPipe().transform(value, meta())).toThrow(
        UnprocessableEntityException,
      );
    },
  );

  it('uses the standard translated validation error shape', () => {
    try {
      new UuidPipe().transform('bad', meta('moduleId'));
      fail('expected an exception');
    } catch (e) {
      expect((e as UnprocessableEntityException).getResponse()).toEqual({
        statusCode: 422,
        message: 'Validation failed',
        errors: {
          moduleId: {
            en: 'Module ID must be a valid ID',
            id: 'ID Modul harus berupa ID yang valid',
          },
        },
      });
    }
  });

  it('lets missing values through when optional', () => {
    const pipe = new UuidPipe({ optional: true });
    expect(pipe.transform(undefined, meta('moduleId'))).toBeUndefined();
    expect(pipe.transform('', meta('moduleId'))).toBe('');
    expect(() => pipe.transform('bad', meta('moduleId'))).toThrow();
  });

  it('accepts explicitly allowed literals', () => {
    const pipe = new UuidPipe({ optional: true, allow: ['null'] });
    expect(pipe.transform('null', meta('parentId'))).toBe('null');
  });
});
