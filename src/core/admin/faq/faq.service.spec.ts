import { BadRequestException } from '@nestjs/common';
import { FAQService } from './faq.service';

// parent links of a small tree: a → b → c (c is the deepest)
const tree: Record<string, string | null> = { a: null, b: 'a', c: 'b' };
const tx: any = {
  fAQ: {
    findUnique: jest.fn(async ({ where }) =>
      where.id in tree ? { parentId: tree[where.id] } : null,
    ),
  },
};

describe('FAQService parent cycle check', () => {
  const service = new FAQService({} as any, {} as any, {} as any);
  const check = (id: string, newParentId: string | null) =>
    (service as any).assertNotOwnDescendant(tx, id, newParentId);

  it.each([
    ['a', 'a'],
    ['a', 'b'],
    ['a', 'c'],
    ['b', 'c'],
  ])('refuses to move %s under %s (itself or a descendant)', async (id, p) => {
    await expect(check(id, p)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['c', 'a'],
    ['b', null],
    ['c', 'missing'],
  ])('allows moving %s under %s', async (id, p) => {
    await expect(check(id, p)).resolves.toBeUndefined();
  });

  it('stops on a cycle already in the data instead of looping forever', async () => {
    tree.x = 'y';
    tree.y = 'x';
    await expect(check('a', 'x')).rejects.toBeInstanceOf(BadRequestException);
  });
});
