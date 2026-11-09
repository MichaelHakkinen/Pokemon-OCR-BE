import { bearer, createTestApp, login, TestContext } from './helpers';

// Regression tests for the robustness fixes from the module review.
describe('Robustness (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    token = (await login(ctx)).token;
  });
  afterAll(() => ctx.close());

  const get = (url: string) => ctx.http().get(url).set(bearer(token));

  describe('list query params', () => {
    it('fixes up bad page / limit / sort instead of failing or leaking', async () => {
      const res = await get(
        '/admin-account?page=abc&limit=1000000&sort=password&sortDirection=sideways',
      ).expect(200);
      expect(res.body.pagination).toMatchObject({
        currentPage: 1,
        lowestNumber: 1,
      });
      expect(res.body.data.length).toBeLessThanOrEqual(100);
      expect(JSON.stringify(res.body.data)).not.toContain('"password"');
    });

    it('takes the first value of a repeated param', async () => {
      await get('/admin-account?q=superadmin&q=nobody').expect(200);
      await get('/banner?q=a&q=b&deletedItems=true&deletedItems=x').expect(200);
      await get('/faq?q=a&q=b').expect(200);
    });

    it('ignores a status filter that is not true/false', async () => {
      for (const isActive of [true, false]) {
        await ctx.prisma.banner.create({
          data: {
            title: `E2E Status ${isActive}`,
            mediaUrl: `https://cdn.example.com/status-${isActive}.png`,
            isActive,
          },
        });
      }
      const all = await get('/banner/export/csv').expect(200);
      expect(all.text).toContain('E2E Status true');
      expect(all.text).toContain('E2E Status false');
      const garbage = await get('/banner/export/csv?status=yes').expect(200);
      expect(garbage.text).toBe(all.text);
    });
  });

  describe('database errors', () => {
    it('two racing creates of the same key: one wins, no 500', async () => {
      const create = () =>
        ctx
          .http()
          .post('/admin/global-config')
          .set(bearer(token))
          .send({ key: 'E2E_RACE_KEY', value: 'x' });
      const statuses = (await Promise.all([create(), create(), create()])).map(
        (r) => r.status,
      );
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.every((s) => [201, 400, 409].includes(s))).toBe(true);
      expect(
        await ctx.prisma.globalConfig.count({ where: { key: 'E2E_RACE_KEY' } }),
      ).toBe(1);
    });
  });

  describe('soft-deleted rows', () => {
    it('cannot be updated or deleted again', async () => {
      const group = await ctx.prisma.adminGroup.create({
        data: { name: 'E2E Deleted Group', deletedAt: new Date() },
      });
      await ctx
        .http()
        .put(`/admin-group/${group.id}`)
        .set(bearer(token))
        .send({ name: 'Back from the dead' })
        .expect(400);
      await ctx
        .http()
        .delete(`/admin-group/${group.id}`)
        .set(bearer(token))
        .expect(400);
    });
  });

  describe('admin groups', () => {
    it('keep their rules when an update omits moduleRuleIds', async () => {
      const rule = await ctx.prisma.moduleRule.findFirstOrThrow({
        where: { deletedAt: null },
      });
      const created = await ctx
        .http()
        .post('/admin-group')
        .set(bearer(token))
        .send({ name: 'E2E Keep Rules', moduleRuleIds: [rule.id] })
        .expect(201);
      const id = created.body.data.id;
      await ctx
        .http()
        .put(`/admin-group/${id}`)
        .set(bearer(token))
        .send({ name: 'E2E Keep Rules (renamed)' })
        .expect(200);
      const access = await ctx.prisma.adminGroupAccess.findMany({
        where: { adminGroupId: id },
      });
      expect(access.map((a) => a.moduleRuleId)).toEqual([rule.id]);
    });
  });

  describe('admin accounts', () => {
    it('save a changed phone number', async () => {
      const group = await ctx.prisma.adminGroup.findUniqueOrThrow({
        where: { name: 'Admin' },
      });
      const created = await ctx
        .http()
        .post('/admin-account')
        .set(bearer(token))
        .send({
          fullname: 'Phone Change',
          username: 'e2e-phone',
          email: 'e2e-phone@example.com',
          phoneNumber: '+6281200000060',
          password: 'Phone123!',
          adminGroupId: group.id,
        })
        .expect(201);
      await ctx
        .http()
        .put(`/admin-account/${created.body.data.id}`)
        .set(bearer(token))
        .send({
          fullname: 'Phone Change',
          email: 'e2e-phone@example.com',
          phoneNumber: '+6281200000061',
        })
        .expect(200);
      const stored = await ctx.prisma.admin.findUniqueOrThrow({
        where: { id: created.body.data.id },
      });
      expect(stored.phoneNumber).toBe('+6281200000061');
    });
  });

  describe('FAQ tree', () => {
    const post = (body: object) =>
      ctx.http().post('/faq').set(bearer(token)).send(body).expect(201);
    const move = (id: string, parentId: string | null) =>
      ctx
        .http()
        .put(`/faq/${id}`)
        .set(bearer(token))
        .send({ text1: 'Q', text2: 'A', ...(parentId ? { parentId } : {}) });

    it('refuses to move a FAQ under itself or its descendant', async () => {
      const a = (await post({ text1: 'A', text2: 'A' })).body.data;
      const b = (await post({ text1: 'B', text2: 'B', parentId: a.id })).body
        .data;
      await move(a.id, a.id).expect(400);
      const res = await move(a.id, b.id).expect(400);
      expect(res.body.message.en).toMatch(/under itself/i);
    });

    it('refuses a deleted parent and recomputes level and ordinal on move', async () => {
      const gone = await ctx.prisma.fAQ.create({
        data: { text1: 'Gone', text2: 'Gone', deletedAt: new Date() },
      });
      await ctx
        .http()
        .post('/faq')
        .set(bearer(token))
        .send({ text1: 'X', text2: 'X', parentId: gone.id })
        .expect(400);

      const p = (await post({ text1: 'P', text2: 'P' })).body.data;
      const first = (await post({ text1: 'C1', text2: 'C1', parentId: p.id }))
        .body.data;
      const loose = (await post({ text1: 'L', text2: 'L' })).body.data;
      await move(loose.id, p.id).expect(200);
      const moved = await ctx.prisma.fAQ.findUniqueOrThrow({
        where: { id: loose.id },
      });
      const sibling = await ctx.prisma.fAQ.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(moved.parentId).toBe(p.id);
      expect(moved.level).toBe(sibling.level);
      expect(moved.ordinal).toBeGreaterThan(sibling.ordinal);
    });
  });

  describe('boolean fields', () => {
    it('rejects a malformed isActive instead of saving it as false', async () => {
      const faq = (
        await ctx
          .http()
          .post('/faq')
          .set(bearer(token))
          .send({ text1: 'Bool', text2: 'Bool', isActive: 'true' })
          .expect(201)
      ).body.data;

      await ctx
        .http()
        .put(`/faq/${faq.id}`)
        .set(bearer(token))
        .send({ text1: 'Bool', text2: 'Bool', isActive: 'maybe' })
        .expect(422);
      const row = await ctx.prisma.fAQ.findUniqueOrThrow({
        where: { id: faq.id },
      });
      expect(row.isActive).toBe(true);
    });
  });

  describe('concurrent ordering', () => {
    it('banners created at the same time get distinct ordinals', async () => {
      const PNG = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(64),
      ]);
      const create = (i: number) =>
        ctx
          .http()
          .post('/banner')
          .set(bearer(token))
          .field('title', `E2E Concurrent ${i}`)
          .attach('mediaUrl', PNG, {
            filename: 'b.png',
            contentType: 'image/png',
          })
          .expect(201);
      await Promise.all([1, 2, 3, 4, 5].map(create));
      const created = await ctx.prisma.banner.findMany({
        where: { title: { startsWith: 'E2E Concurrent' } },
        select: { ordinal: true },
      });
      const ordinals = created.map((b) => b.ordinal);
      expect(ordinals).toHaveLength(5);
      expect(new Set(ordinals).size).toBe(5);
    });
  });
});
