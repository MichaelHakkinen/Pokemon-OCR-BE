import { of, lastValueFrom } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { Paginated } from 'src/common/http/paginated';
import { SUCCESS_MESSAGES } from 'src/common/constants/success-messages';

describe('ResponseInterceptor', () => {
  const run = async (
    result: unknown,
    messageKey?: string,
    statusCode = 200,
    raw = false,
  ) => {
    const reflector: any = {
      get: jest.fn((key: string) =>
        key === 'response_message'
          ? messageKey
          : key === 'raw_response'
            ? raw
            : undefined,
      ),
    };
    const context: any = {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({ statusCode, headersSent: false }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    };
    return lastValueFrom(
      new ResponseInterceptor(reflector).intercept(context, {
        handle: () => of(result),
      }),
    );
  };

  it('wraps data in the success envelope', async () => {
    await expect(run({ id: 1 }, 'DATA_CREATED_SUCCESS', 201)).resolves.toEqual({
      code: 201,
      status: 'success',
      message: SUCCESS_MESSAGES.DATA_CREATED_SUCCESS,
      data: { id: 1 },
    });
  });

  it('adds pagination for Paginated results', async () => {
    const pagination = {
      totalCount: 1,
      currentPage: 1,
      lowestNumber: 1,
      highestNumber: 1,
    };
    const body: any = await run(new Paginated(pagination, [{ id: 1 }]));
    expect(body.pagination).toEqual(pagination);
    expect(body.data).toEqual([{ id: 1 }]);
  });

  it('uses the default message and null data when nothing is returned', async () => {
    const body: any = await run(undefined);
    expect(body.message).toEqual(SUCCESS_MESSAGES.DEFAULT_MESSAGE);
    expect(body.data).toBeNull();
  });

  it('returns @RawResponse() results untouched', async () => {
    const health = { status: 'ok', info: {} };
    await expect(run(health, undefined, 200, true)).resolves.toBe(health);
  });
});
