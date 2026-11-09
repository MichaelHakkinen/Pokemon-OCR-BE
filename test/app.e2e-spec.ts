import { bearer, createTestApp, login, TestContext } from './helpers';

describe('Platform (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    token = (await login(ctx)).token;
  });
  afterAll(() => ctx.close());

  it('GET / returns the success envelope', async () => {
    const res = await ctx.http().get('/').expect(200);
    expect(res.body).toMatchObject({
      code: 200,
      status: 'success',
      data: null,
    });
  });

  it('GET /healthz is a raw liveness probe', async () => {
    await ctx.http().get('/healthz').expect(200, { status: 'ok' });
  });

  it('GET /healthz/ready reports the database and in-memory Redis', async () => {
    const res = await ctx.http().get('/healthz/ready').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.details.database.status).toBe('up');
    expect(res.body.details.redis).toEqual({ status: 'up', mode: 'memory' });
  });

  it('unknown routes use the error envelope', async () => {
    const res = await ctx.http().get('/does-not-exist').expect(404);
    expect(res.body).toMatchObject({ code: 404, status: 'errors', data: null });
  });

  it.each([
    '/response/.env',
    '/response/package.json',
    '/response/..$..$..$etc$passwd',
  ])('%s is not served', (path) => ctx.http().get(path).expect(404));

  it('rejects requests without a token', async () => {
    const res = await ctx.http().get('/faq').expect(401);
    expect(res.body.status).toBe('errors');
  });

  it('rejects a malformed :id with a translated 422', async () => {
    const res = await ctx
      .http()
      .get('/faq/not-a-uuid')
      .set(bearer(token))
      .expect(422);
    expect(res.body.message.errors.id).toEqual({
      en: 'ID must be a valid ID',
      id: 'ID harus berupa ID yang valid',
    });
  });

  it('keeps not-found responses for well-formed unknown ids', async () => {
    await ctx
      .http()
      .get('/faq/3fa85f64-5717-4562-b3fc-2c963f66afa6')
      .set(bearer(token))
      .expect(400);
  });

  it('returns paginated lists', async () => {
    const res = await ctx
      .http()
      .get('/admin-account?page=1&limit=1')
      .set(bearer(token))
      .expect(200);
    expect(res.body.pagination).toMatchObject({ currentPage: 1 });
    expect(res.body.data).toHaveLength(1);
  });

  it('filters FAQs by parentId (omitted / null / id)', async () => {
    const create = (body: object) =>
      ctx.http().post('/faq').set(bearer(token)).send(body).expect(201);
    const parent = (await create({ text1: 'Parent Q', text2: 'Parent A' })).body
      .data;
    const child = (
      await create({ text1: 'Child Q', text2: 'Child A', parentId: parent.id })
    ).body.data;
    const ids = async (query: string) =>
      (
        await ctx.http().get(`/faq${query}`).set(bearer(token)).expect(200)
      ).body.data.map((f: { id: string }) => f.id);

    expect(await ids('')).toEqual(
      expect.arrayContaining([parent.id, child.id]),
    );
    expect(await ids('?parentId=null')).toContain(parent.id);
    expect(await ids('?parentId=null')).not.toContain(child.id);
    expect(await ids(`?parentId=${parent.id}`)).toEqual([child.id]);
    await ctx.http().get('/faq?parentId=bad').set(bearer(token)).expect(422);
  });

  it('rate-limits per client IP (in-memory store)', async () => {
    const attempt = (ip: string) =>
      ctx
        .httpFrom(ip)
        .post('/auth')
        .send({ username: 'nobody', password: 'x' });
    for (let i = 0; i < 5; i++) await attempt('203.0.113.10').expect(422);
    const limited = await attempt('203.0.113.10').expect(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.body).toMatchObject({ code: 429, status: 'errors' });
    await attempt('203.0.113.11').expect(422); // another client is unaffected
  });
});
