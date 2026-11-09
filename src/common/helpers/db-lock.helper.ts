type RawExecutor = {
  $executeRaw(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<number>;
};

/**
 * Serialises transactions that touch the same `scope` (e.g. assigning the
 * next ordinal, reordering a list): a Postgres transaction-level advisory
 * lock, released automatically at commit/rollback. Without it, two
 * concurrent creates both read max(ordinal) and get the same value.
 *
 *   await this.prisma.$transaction(async (tx) => {
 *     await lockScope(tx, 'banner:ordering');
 *     const max = await tx.banner.aggregate({ _max: { ordinal: true } });
 *     ...
 *   });
 *
 * ($executeRaw on purpose: the lock function returns `void`, which
 * $queryRaw can't deserialise.)
 */
export async function lockScope(tx: RawExecutor, scope: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}))`;
}

/** Ordering scope for items that are sorted among siblings. */
export const orderingScope = (entity: string, parentId?: string | null) =>
  `${entity}:ordering:${parentId ?? 'root'}`;
