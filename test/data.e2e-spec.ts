import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import {
  bearer,
  createTestApp,
  login,
  TestContext,
  waitForOtp,
} from './helpers';

// Regression tests for the data-correctness fixes from the module review.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);

async function xlsx(rows: ExcelJS.CellValue[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Banners');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('Data correctness (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    token = (await login(ctx)).token;
  });
  afterAll(() => ctx.close());

  const importFile = (buf: Buffer, filename: string, contentType: string) =>
    ctx
      .http()
      .post('/banner/import')
      .set(bearer(token))
      .attach('file', buf, { filename, contentType });
  const XLSX_TYPE =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  describe('banner import', () => {
    it('keeps FALSE as inactive and reads hyperlink / numeric cells as text', async () => {
      const url = 'https://cdn.example.com/import-1.png';
      const buf = await xlsx([
        ['title', 'mediaUrl', 'isActive', 'urlTarget'],
        [2026, { text: url, hyperlink: url }, false, '/promo/2026'],
      ]);
      const res = await importFile(buf, 'b.xlsx', XLSX_TYPE).expect(201);
      expect(res.body.data.totalImported).toBe(1);
      const banner = await ctx.prisma.banner.findFirstOrThrow({
        where: { mediaUrl: url },
      });
      expect(banner).toMatchObject({
        title: '2026',
        isActive: false,
        urlTarget: '/promo/2026',
      });
    });

    it('is all-or-nothing: one invalid row imports nothing and reports the row', async () => {
      const before = await ctx.prisma.banner.count();
      const csv =
        'title,mediaUrl\n' +
        'Good,https://cdn.example.com/ok.png\n' +
        `${'x'.repeat(300)},https://cdn.example.com/long.png\n`;
      const res = await importFile(
        Buffer.from(csv),
        'b.csv',
        'text/csv',
      ).expect(400);
      expect(res.body.message.errors).toEqual([
        expect.objectContaining({ row: 3, field: 'title' }),
      ]);
      expect(res.body.message.errors[0].message.en).toContain('255');
      expect(await ctx.prisma.banner.count()).toBe(before);
    });

    it('rejects unsafe links and unknown yes/no values per row', async () => {
      const csv =
        'title,mediaUrl,urlTarget,isActive\n' +
        'A,https://cdn.example.com/a.png,javascript:alert(1),true\n' +
        'B,https://cdn.example.com/b.png,/ok,maybe\n';
      const res = await importFile(
        Buffer.from(csv),
        'b.csv',
        'text/csv',
      ).expect(400);
      const fields = res.body.message.errors.map(
        (e: any) => `${e.row}:${e.field}`,
      );
      expect(fields).toEqual(['2:urlTarget', '3:isActive']);
    });

    it('answers a legacy .xls or too many rows with 400, not 500', async () => {
      const legacy = Buffer.from([
        0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0,
      ]);
      await importFile(legacy, 'old.xls', 'application/vnd.ms-excel').expect(
        400,
      );
      const big =
        'title,mediaUrl\n' + 'x,https://cdn.example.com/x.png\n'.repeat(5001);
      const res = await importFile(
        Buffer.from(big),
        'big.csv',
        'text/csv',
      ).expect(400);
      expect(res.body.message.en).toMatch(/5000/);
    });
  });

  describe('banner links', () => {
    const create = (urlTarget: string) =>
      ctx
        .http()
        .post('/banner')
        .set(bearer(token))
        .field('title', 'Link test')
        .field('urlTarget', urlTarget)
        .attach('mediaUrl', PNG, {
          filename: 'b.png',
          contentType: 'image/png',
        });

    it.each(['javascript:alert(1)', '//evil.example.com', 'data:text/html,x'])(
      'rejects urlTarget %s',
      async (urlTarget) => {
        const res = await create(urlTarget).expect(422);
        expect(res.body.message.errors.urlTarget).toBeDefined();
      },
    );

    it('accepts http(s) URLs and app paths', async () => {
      await create('https://example.com/promo').expect(201);
      await create('/promo/123').expect(201);
    });
  });

  describe('ordering', () => {
    it('position 1 is the top of the list, and deleted banners do not count', async () => {
      await ctx.prisma.banner.updateMany({ data: { deletedAt: new Date() } });
      const make = (title: string, ordinal: number, deleted = false) =>
        ctx.prisma.banner.create({
          data: {
            title,
            mediaUrl: `https://cdn.example.com/${title}.png`,
            ordinal,
            deletedAt: deleted ? new Date() : null,
          },
        });
      const a = await make('A', 1);
      await make('B', 2);
      const c = await make('C', 3);
      await make('Deleted', 4, true);

      await ctx
        .http()
        .put('/banner/sorting')
        .set(bearer(token))
        .send({ id: c.id, newPosition: 1 })
        .expect(200);
      const list = (
        await ctx.http().get('/banner').set(bearer(token)).expect(200)
      ).body.data;
      expect(list.map((b: any) => b.title)).toEqual(['C', 'A', 'B']);

      // position beyond the live count is rejected (the deleted one isn't counted)
      await ctx
        .http()
        .put('/banner/sorting')
        .set(bearer(token))
        .send({ id: a.id, newPosition: 4 })
        .expect(400);
    });
  });

  describe('FAQ delete / restore cascade', () => {
    it('deletes and restores the subtree that was deleted together', async () => {
      const post = (body: object) =>
        ctx.http().post('/faq').set(bearer(token)).send(body).expect(201);
      const parent = (await post({ text1: 'P', text2: 'P' })).body.data;
      const child = (
        await post({ text1: 'C', text2: 'C', parentId: parent.id })
      ).body.data;
      const grandchild = (
        await post({ text1: 'G', text2: 'G', parentId: child.id })
      ).body.data;
      const loner = (
        await post({ text1: 'L', text2: 'L', parentId: parent.id })
      ).body.data;

      // loner deleted on its own first, then the parent (cascades to C and G)
      await ctx
        .http()
        .delete(`/faq/${loner.id}`)
        .set(bearer(token))
        .expect(200);
      await ctx
        .http()
        .delete(`/faq/${parent.id}`)
        .set(bearer(token))
        .expect(200);
      const deleted = await ctx.prisma.fAQ.findMany({
        where: { id: { in: [parent.id, child.id, grandchild.id] } },
      });
      expect(deleted.every((f) => f.deletedAt)).toBe(true);

      // a child can't come back while its parent is deleted
      await ctx
        .http()
        .put(`/faq/${child.id}/restore`)
        .set(bearer(token))
        .expect(400);

      await ctx
        .http()
        .put(`/faq/${parent.id}/restore`)
        .set(bearer(token))
        .expect(200);
      const after = await ctx.prisma.fAQ.findMany({
        where: { id: { in: [parent.id, child.id, grandchild.id, loner.id] } },
      });
      const byId = Object.fromEntries(after.map((f) => [f.id, f.deletedAt]));
      expect(byId[parent.id]).toBeNull();
      expect(byId[child.id]).toBeNull();
      expect(byId[grandchild.id]).toBeNull();
      expect(byId[loner.id]).not.toBeNull(); // deleted separately: stays deleted
    });
  });

  describe('emails', () => {
    it('are stored lowercase and unique regardless of case', async () => {
      const group = await ctx.prisma.adminGroup.findUniqueOrThrow({
        where: { name: 'Admin' },
      });
      const base = {
        fullname: 'Email Case',
        phoneNumber: '+6281200000050',
        password: 'Email123!',
        adminGroupId: group.id,
        isActive: true,
      };
      await ctx
        .http()
        .post('/admin-account')
        .set(bearer(token))
        .send({
          ...base,
          username: 'e2e-email-1',
          email: ' Mixed.Case@Example.COM ',
        })
        .expect(201);
      const stored = await ctx.prisma.admin.findFirstOrThrow({
        where: { username: 'e2e-email-1' },
      });
      expect(stored.email).toBe('mixed.case@example.com');

      const dup = await ctx
        .http()
        .post('/admin-account')
        .set(bearer(token))
        .send({
          ...base,
          username: 'e2e-email-2',
          email: 'MIXED.case@example.com',
        })
        .expect(409);
      expect(dup.body.message.en).toMatch(/already used/i);

      // forgot-password finds the account whatever the case
      await ctx
        .http()
        .post('/auth/forgot-password')
        .send({ email: 'MIXED.CASE@EXAMPLE.COM' })
        .expect(200);
      await waitForOtp(ctx, 'mixed.case@example.com');
    });
  });

  describe('file replacement', () => {
    it('keeps the old avatar when the update fails, and leaves no orphan', async () => {
      const group = await ctx.prisma.adminGroup.findUniqueOrThrow({
        where: { name: 'Admin' },
      });
      const created = await ctx
        .http()
        .post('/admin-account')
        .set(bearer(token))
        .field('fullname', 'Avatar Keep')
        .field('username', 'e2e-avatar-keep')
        .field('phoneNumber', '+6281200000051')
        .field('password', 'Avatar123!')
        .field('adminGroupId', group.id)
        .attach('avatar', PNG, { filename: 'a.png', contentType: 'image/png' })
        .expect(201);
      const before = await ctx.prisma.admin.findUniqueOrThrow({
        where: { id: created.body.data.id },
      });
      const dir = path.join(process.cwd(), 'src/public/uploads/avatar-admin');
      const filesBefore = fs.readdirSync(dir).length;

      // valid new avatar, but a group that doesn't exist -> transaction fails
      await ctx
        .http()
        .put(`/admin-account/${before.id}`)
        .set(bearer(token))
        .field('fullname', 'Avatar Keep')
        .field('phoneNumber', '+6281200000051')
        .field('adminGroupId', '3fa85f64-5717-4562-b3fc-2c963f66afa6')
        .attach('avatar', PNG, { filename: 'b.png', contentType: 'image/png' })
        .expect(400);

      const after = await ctx.prisma.admin.findUniqueOrThrow({
        where: { id: before.id },
      });
      expect(after.avatar).toBe(before.avatar);
      expect(fs.existsSync(path.join(process.cwd(), before.avatar))).toBe(true);
      expect(fs.readdirSync(dir).length).toBe(filesBefore);
    });
  });
});
