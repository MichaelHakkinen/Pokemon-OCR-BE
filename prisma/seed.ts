import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';
import { adminGroupAccessSeed } from './seed/admin-group-access.seed';
import { adminGroupMemberSeed } from './seed/admin-group-member.seed';
import { adminGroupSeed } from './seed/admin-group.seed';
import { adminSeed } from './seed/admin.seed';
import { moduleSeed } from './seed/module.seed';
import { moduleRuleSeed } from './seed/module-rule.seed';
import { userSeed } from './seed/user.seed';
import { logDetailSeed } from './seed/log-detail.seed';
import { globalConfigSeed } from './seed/global-config.seed';
import { seedPokemonCards } from './seed/pokemon-card.seed';

// Seeds run outside Nest, so they create their own client.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await adminSeed(prisma);
  await userSeed(prisma);
  await moduleSeed(prisma);
  await moduleRuleSeed(prisma);
  await adminGroupSeed(prisma);
  await adminGroupMemberSeed(prisma);
  await adminGroupAccessSeed(prisma);
  await logDetailSeed(prisma);
  await globalConfigSeed(prisma);
  await seedPokemonCards(prisma);
  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
