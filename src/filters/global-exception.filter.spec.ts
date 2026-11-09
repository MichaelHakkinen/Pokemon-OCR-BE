import { BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let errorLog: any;
  let res: any;
  let filter: GlobalExceptionFilter;
  const host = (): any => ({
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ params: { id: 't-1' }, moduleName: 'FAQ' }),
    }),
  });

  beforeEach(() => {
    errorLog = { logFromRequest: jest.fn().mockResolvedValue(undefined) };
    res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    filter = new GlobalExceptionFilter(errorLog);
    jest
      .spyOn((filter as any).logger, 'error')
      .mockImplementation(() => undefined);
  });

  it('renders HttpExceptions in the error envelope without logging them', () => {
    filter.catch(new BadRequestException('nope'), host());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      code: 400,
      status: 'errors',
      data: null,
    });
    expect(errorLog.logFromRequest).not.toHaveBeenCalled();
  });

  it('hides internals of unexpected errors and logs them', () => {
    filter.catch(new Error('db password is hunter2'), host());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('hunter2');
    expect(errorLog.logFromRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Error),
      { moduleName: 'FAQ', targetId: 't-1' },
    );
  });
});
