import * as fs from 'fs';
import * as path from 'path';
import {
  bearer,
  createTestApp,
  login,
  SUPERADMIN,
  TestContext,
} from './helpers';

// Regression tests for the security review findings (one block per finding).
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const HTML = Buffer.from(
  '<!doctype html><script>alert(document.domain)</script>',
);

describe('Security review fixes (e2e)', () => {
  let ctx: TestContext;
  let root: { token: string; user: { id: string } };

  beforeAll(async () => {
    ctx = await createTestApp();
    root = await login(ctx);
  });
  afterAll(() => ctx.close());

  // An admin in a fresh group holding only the given rules ("Module:Rule").
  async function limitedAdmin(name: string, rules: string[]) {
    const ruleRows = await ctx.prisma.moduleRule.findMany({
      where: {
        OR: rules.map((r) => {
          const [module, rule] = r.split(':');
          return { name: rule, module: { name: module } };
        }),
      },
    });
    expect(ruleRows).toHaveLength(rules.length);
    const group = (
      await ctx
        .http()
        .post('/admin-group')
        .set(bearer(root.token))
        .send({
          name: `E2E ${name}`,
          isActive: true,
          moduleRuleIds: ruleRows.map((r) => r.id),
        })
        .expect(201)
    ).body.data;
    const creds = { username: `e2e-${name}`, password: 'Limited123!' };
    const admin = (
      await ctx
        .http()
        .post('/admin-account')
        .set(bearer(root.token))
        .send({
          ...creds,
          fullname: `E2E ${name}`,
          phoneNumber: '+6281200000099',
          adminGroupId: group.id,
          isActive: true,
        })
        .expect(201)
    ).body.data;
    const session = await login(ctx, creds);
    return { id: admin.id as string, group, token: session.token };
  }

  describe('#2 granting permissions', () => {
    it("a group editor can't grant rules they don't hold — even to their own group", async () => {
      const editor = await limitedAdmin('grp-editor', [
        'Admin Group Management:View Details',
        'Admin Group Management:Edit',
      ]);
      const everything = await ctx.prisma.moduleRule.findMany({
        select: { id: true },
      });
      const res = await ctx
        .http()
        .put(`/admin-group/${editor.group.id}`)
        .set(bearer(editor.token))
        .send({
          name: editor.group.name,
          isActive: true,
          moduleRuleIds: everything.map((r) => r.id),
        })
        .expect(403);
      expect(res.body.message.en).toMatch(
        /only grant permissions that you have/i,
      );
      // still limited afterwards
      await ctx.http().get('/faq').set(bearer(editor.token)).expect(403);
    });

    it('root can still grant any rule', async () => {
      const faqView = await ctx.prisma.moduleRule.findFirstOrThrow({
        where: { name: 'View List', module: { name: 'FAQ Management' } },
      });
      const group = (
        await ctx
          .http()
          .post('/admin-group')
          .set(bearer(root.token))
          .send({
            name: 'E2E root-granted',
            isActive: true,
            moduleRuleIds: [faqView.id],
          })
          .expect(201)
      ).body.data;
      expect(group).toBeDefined();
    });
  });

  describe('#3 root admin protection', () => {
    it("an account editor can't change or delete a root admin, or delete themselves", async () => {
      const editor = await limitedAdmin('acct-editor', [
        'Admin Management:Edit',
        'Admin Management:Delete',
      ]);
      const superadmin = await ctx.prisma.admin.findFirstOrThrow({
        where: { username: SUPERADMIN.username },
      });

      await ctx
        .http()
        .put(`/admin-account/${superadmin.id}`)
        .set(bearer(editor.token))
        .send({
          fullname: 'x',
          phoneNumber: '+6281200000098',
          password: 'Takeover123!',
        })
        .expect(403);
      await ctx
        .http()
        .delete(`/admin-account/${superadmin.id}`)
        .set(bearer(editor.token))
        .expect(403);
      await ctx
        .http()
        .delete(`/admin-account/${editor.id}`)
        .set(bearer(editor.token))
        .expect(400);
      // the superadmin password is unchanged
      await login(ctx, SUPERADMIN);
    });

    // (the "last active root admin" rule is covered by admin.service.spec.ts:
    // the seed has a single root admin, so this hits the self-delete rule first)
    it("root can't delete their own account", async () => {
      const res = await ctx
        .http()
        .delete(`/admin-account/${root.user.id}`)
        .set(bearer(root.token))
        .expect(400);
      expect(res.body.message.en).toMatch(/cannot delete your own account/i);
    });
  });

  describe('#5 uploads are checked by content', () => {
    it('rejects HTML disguised as a PNG avatar', async () => {
      await ctx
        .http()
        .post('/auth/change-avatar')
        .set(bearer(root.token))
        .attach('avatar', HTML, {
          filename: 'x.html',
          contentType: 'image/png',
        })
        .expect(422);
    });

    it('stores a real image under its detected type and serves it with nosniff', async () => {
      const res = await ctx
        .http()
        .post('/auth/change-avatar')
        .set(bearer(root.token))
        .attach('avatar', PNG, {
          filename: 'evil.html',
          contentType: 'image/png',
        })
        .expect(200);
      const url: string = res.body.data.avatar;
      expect(url).toMatch(/\.png$/);
      const served = await ctx.http().get(new URL(url).pathname).expect(200);
      expect(served.headers['content-type']).toMatch(/^image\/png/);
      expect(served.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('#1 file deletion is limited to managed uploads', () => {
    it('refuses an import row whose mediaUrl is a filesystem path', async () => {
      const csv = 'title,mediaUrl,isActive\nEvil,../../package.json,true\n';
      const res = await ctx
        .http()
        .post('/banner/import')
        .set(bearer(root.token))
        .attach('file', Buffer.from(csv), {
          filename: 'b.csv',
          contentType: 'text/csv',
        })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(/mediaUrl/);
    });

    it('accepts http(s) media URLs and does not store the import file', async () => {
      const dir = path.join(process.cwd(), 'src/public/uploads/banner-import');
      const before = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
      const csv =
        'title,mediaUrl,isActive\nOk,https://cdn.example.com/a.png,true\n';
      await ctx
        .http()
        .post('/banner/import')
        .set(bearer(root.token))
        .attach('file', Buffer.from(csv), {
          filename: 'b.csv',
          contentType: 'text/csv',
        })
        .expect(201);
      const after = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
      expect(after).toBe(before);
    });
  });

  describe('#4 exports', () => {
    it('handles concurrent exports without temp files', async () => {
      const exportsDir = path.join(process.cwd(), 'exports');
      const [a, b, c] = await Promise.all([
        ctx.http().get('/banner/export/csv').set(bearer(root.token)),
        ctx.http().get('/banner/export/csv').set(bearer(root.token)),
        ctx.http().get('/banner/export/xlsx').set(bearer(root.token)),
      ]);
      for (const res of [a, b, c]) expect(res.status).toBe(200);
      expect(a.headers['content-type']).toMatch(/text\/csv/);
      expect(c.headers['content-type']).toMatch(/spreadsheetml/);
      expect(a.headers['content-disposition']).not.toBe(
        b.headers['content-disposition'],
      );
      expect(
        fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir) : [],
      ).toEqual([]);
      // the app is still alive
      await ctx.http().get('/healthz').expect(200);
    });

    it('neutralises formulas in CSV cells', async () => {
      await ctx.prisma.banner.create({
        data: {
          title: '=HYPERLINK("http://evil","x")',
          mediaUrl: 'https://cdn.example.com/f.png',
          ordinal: 999,
          isActive: true,
        },
      });
      const res = await ctx
        .http()
        .get('/banner/export/csv')
        .set(bearer(root.token))
        .expect(200);
      expect(res.text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    });
  });

  describe('#7 audit logs', () => {
    it('never contain password hashes', async () => {
      const target = await limitedAdmin('audit', ['FAQ Management:View List']);
      await ctx
        .http()
        .put(`/admin-account/${target.id}`)
        .set(bearer(root.token))
        .send({ fullname: 'Audit Renamed', phoneNumber: '+6281200000097' })
        .expect(200);
      const logs = await ctx.prisma.log.findMany({
        where: { targetId: target.id },
        select: { valueBefore: true, valueAfter: true },
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(JSON.stringify(logs)).not.toMatch(/\$2[aby]\$/);
    });
  });
});
