import { bearer, createTestApp, login, TestContext } from './helpers';

describe('RBAC (e2e)', () => {
  let ctx: TestContext;
  let rootToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    rootToken = (await login(ctx)).token;
  });
  afterAll(() => ctx.close());

  it('applies permission changes immediately and signs out deleted admins', async () => {
    const root = () => ctx.http();

    // A group with no rules, and an admin in it
    const group = (
      await root()
        .post('/admin-group')
        .set(bearer(rootToken))
        .send({ name: 'E2E Readers', isActive: true })
        .expect(201)
    ).body.data;
    const admin = { username: 'e2e-reader', password: 'Reader123!' };
    const created = (
      await root()
        .post('/admin-account')
        .set(bearer(rootToken))
        .send({
          ...admin,
          fullname: 'E2E Reader',
          phoneNumber: '+6281200000001',
          adminGroupId: group.id,
          isActive: true,
        })
        .expect(201)
    ).body.data;

    const reader = await login(ctx, admin);
    const denied = await ctx
      .http()
      .get('/faq')
      .set(bearer(reader.token))
      .expect(403);
    expect(denied.body.message.en).toMatch(/View List in FAQ Management/);

    // Grant FAQ "View List" through the API -> cached permissions are dropped
    const rule = await ctx.prisma.moduleRule.findFirstOrThrow({
      where: { name: 'View List', module: { name: 'FAQ Management' } },
    });
    await root()
      .put(`/admin-group/${group.id}`)
      .set(bearer(rootToken))
      .send({ name: 'E2E Readers', isActive: true, moduleRuleIds: [rule.id] })
      .expect(200);
    await ctx.http().get('/faq').set(bearer(reader.token)).expect(200);

    // Deleting the admin ends their sessions and blocks login
    await root()
      .delete(`/admin-account/${created.id}`)
      .set(bearer(rootToken))
      .expect(200);
    await ctx.http().get('/auth/profile').set(bearer(reader.token)).expect(401);
    await ctx.http().post('/auth').send(admin).expect(422);
  });

  it('validates ids in request bodies', async () => {
    const res = await ctx
      .http()
      .post('/admin-account')
      .set(bearer(rootToken))
      .send({
        fullname: 'X',
        username: 'e2e-bad-group',
        phoneNumber: '+6281200000002',
        password: 'Valid123!',
        adminGroupId: 'not-a-uuid',
      })
      .expect(422);
    expect(res.body.message.errors.adminGroupId.en).toBe(
      'Admin Group ID must be a valid ID',
    );
  });
});
