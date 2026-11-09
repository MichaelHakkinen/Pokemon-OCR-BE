import { mapPrismaError } from './prisma-error.mapper';

const prismaError = (code: string, meta?: object) =>
  Object.assign(new Error('db'), {
    name: 'PrismaClientKnownRequestError',
    code,
    meta,
  });

describe('mapPrismaError', () => {
  it('maps a unique violation (driver adapter shape) to 409 naming the field', () => {
    const error = mapPrismaError(
      prismaError('P2002', {
        modelName: 'GlobalConfig',
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { fields: ['key'] },
          },
        },
      }),
    );
    expect(error?.getStatus()).toBe(409);
    expect(JSON.stringify(error?.getResponse())).toContain('key');
  });

  it('also reads the classic meta.target shape', () => {
    const error = mapPrismaError(prismaError('P2002', { target: ['email'] }));
    expect(JSON.stringify(error?.getResponse())).toContain('email');
  });

  it.each([
    ['P2025', 404],
    ['P2000', 422],
    ['P2003', 409],
    ['P2023', 400],
  ])('maps %s to %i', (code, status) => {
    expect(mapPrismaError(prismaError(code))?.getStatus()).toBe(status);
  });

  it('leaves unknown codes and non-Prisma errors alone', () => {
    expect(mapPrismaError(prismaError('P1001'))).toBeNull();
    expect(mapPrismaError(new Error('boom'))).toBeNull();
    expect(mapPrismaError(null)).toBeNull();
  });
});
