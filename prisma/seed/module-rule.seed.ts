import { PrismaClient } from '../../src/generated/prisma';

export const moduleRuleSeed = async (prisma: PrismaClient) => {
  // Define module rules that apply to all modules
  const defaultRules = [
    { name: 'View List', description: 'View list of the data' },
    {
      name: 'View Details',
      description: 'View detailed information of the data',
    },
    { name: 'Add New', description: 'Add new data' },
    { name: 'Edit', description: 'Edit data information' },
    { name: 'Delete', description: 'Delete data' },
    { name: 'Restore', description: 'Restore deleted data' },
  ];

  // Module names that should have rules (must match module.seed.ts)
  const moduleNames = [
    'Admin Management',
    'User Management',
    'Admin Group Management',
    'Module Management',
    'Module Rule Management',
    'Banner Management',
    'FAQ Management',
    'Global Config Management',
  ];

  // Rules only some modules have (must match their @RequireRule names) —
  // without these, only *root could reorder banners and FAQs.
  const extraRules: Record<string, { name: string; description: string }[]> = {
    'Banner Management': [{ name: 'Sorting', description: 'Reorder banners' }],
    'FAQ Management': [{ name: 'Sorting', description: 'Reorder FAQs' }],
  };

  // Get only seeded modules
  const modules = await prisma.module.findMany({
    where: {
      name: {
        in: moduleNames,
      },
    },
  });

  for (const module of modules) {
    // Create rules for each module
    for (const rule of [...defaultRules, ...(extraRules[module.name] ?? [])]) {
      await prisma.moduleRule.upsert({
        where: {
          moduleId_name: {
            moduleId: module.id,
            name: rule.name,
          },
        },
        update: {
          description: rule.description,
          updatedAt: new Date(),
        },
        create: {
          moduleId: module.id,
          name: rule.name,
          description: rule.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log('Module rules seeded.');
};
