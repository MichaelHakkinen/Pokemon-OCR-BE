import { PrismaClient } from '../../src/generated/prisma';

export const globalConfigSeed = async (prisma: PrismaClient) => {
  const configs = [
    { key: 'IS_MOBILE_MAINTENANCE', value: 'false' },
    { key: 'IS_WEBSITE_MAINTENANCE', value: 'false' },
    { key: 'ANDROID_MIN_VERSION', value: '1.0.0' },
    { key: 'IOS_MIN_VERSION', value: '1.0.0' },
    {
      key: 'PRIVACY_POLICY',
      value: '<p>Privacy Policy content goes here.</p>',
    },
    {
      key: 'TERMS_AND_CONDITIONS',
      value: '<p>Terms and Conditions content goes here.</p>',
    },
  ];

  for (const item of configs) {
    await prisma.globalConfig.upsert({
      where: { key: item.key },
      update: {},
      create: {
        key: item.key,
        value: item.value,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  console.log('Global configs seeded.');
};
