import { PrismaClient } from '../../src/generated/prisma';

export async function seedPokemonCards(prisma: any) {
  console.log('Seeding Pokemon Sets, Cards, and Multilingual Translations...');

  // 1. Japanese Pokemon Card 151 (sv2a)
  const sv2aSet = await prisma.set.upsert({
    where: { code: 'sv2a' },
    update: {},
    create: {
      code: 'sv2a',
      name: 'Pokemon Card 151 (Enhanced Expansion Pack)',
      series: 'Scarlet & Violet',
      totalCards: 165,
      releaseYear: 2023,
      region: 'JP',
      language: 'ja',
    },
  });

  // 2. English Scarlet & Violet 151 (MEW)
  const mewSet = await prisma.set.upsert({
    where: { code: 'MEW' },
    update: {},
    create: {
      code: 'MEW',
      name: 'Scarlet & Violet: 151',
      series: 'Scarlet & Violet',
      totalCards: 165,
      releaseYear: 2023,
      region: 'EN',
      language: 'en',
    },
  });

  // 3. Lost Origin Trainer Gallery (TG)
  const tgSet = await prisma.set.upsert({
    where: { code: 'LOR-TG' },
    update: {},
    create: {
      code: 'LOR-TG',
      name: 'Lost Origin Trainer Gallery',
      series: 'Sword & Shield',
      totalCards: 30,
      releaseYear: 2022,
      region: 'GLOBAL',
      language: 'en',
    },
  });

  // Card 1: Japanese Pikachu (sv2a 025/165)
  const pikachuJp = await prisma.card.upsert({
    where: {
      setId_collectorNumber: {
        setId: sv2aSet.id,
        collectorNumber: '025/165',
      },
    },
    update: {},
    create: {
      setId: sv2aSet.id,
      collectorNumber: '025/165',
      normalizedNumber: '025',
      rarity: 'Common',
      cardType: 'Pokemon',
      supertype: 'Basic',
      hp: '60',
      imageUrl: 'https://images.pokemontcg.io/sv2a/25.png',
      translations: {
        create: [
          { language: 'ja', name: 'ピカチュウ' },
          { language: 'en', name: 'Pikachu' },
          { language: 'ko', name: '피카츄' },
          { language: 'zh', name: '皮卡丘' },
          { language: 'id', name: 'Pikachu' },
        ],
      },
    },
  });

  // Card 2: English Pikachu (MEW 025/165)
  const pikachuEn = await prisma.card.upsert({
    where: {
      setId_collectorNumber: {
        setId: mewSet.id,
        collectorNumber: '025/165',
      },
    },
    update: {},
    create: {
      setId: mewSet.id,
      collectorNumber: '025/165',
      normalizedNumber: '025',
      rarity: 'Common',
      cardType: 'Pokemon',
      supertype: 'Basic',
      hp: '60',
      imageUrl: 'https://images.pokemontcg.io/mew/25.png',
      translations: {
        create: [
          { language: 'en', name: 'Pikachu' },
          { language: 'fr', name: 'Pikachu' },
          { language: 'de', name: 'Pikachu' },
          { language: 'es', name: 'Pikachu' },
          { language: 'it', name: 'Pikachu' },
          { language: 'id', name: 'Pikachu' },
        ],
      },
    },
  });

  // Card 3: Charizard ex (MEW 006/165)
  const charizardEn = await prisma.card.upsert({
    where: {
      setId_collectorNumber: {
        setId: mewSet.id,
        collectorNumber: '006/165',
      },
    },
    update: {},
    create: {
      setId: mewSet.id,
      collectorNumber: '006/165',
      normalizedNumber: '006',
      rarity: 'Double Rare',
      cardType: 'Pokemon',
      supertype: 'Stage 2',
      hp: '330',
      imageUrl: 'https://images.pokemontcg.io/mew/6.png',
      translations: {
        create: [
          { language: 'en', name: 'Charizard ex' },
          { language: 'ja', name: 'リザードンex' },
          { language: 'fr', name: 'Dracaufeu ex' },
          { language: 'de', name: 'Glurak ex' },
          { language: 'ko', name: '리자몽 ex' },
          { language: 'zh', name: '噴火龍 ex' },
        ],
      },
    },
  });

  // Card 4: Pikachu Trainer Gallery (TG04/TG30)
  const pikachuTg = await prisma.card.upsert({
    where: {
      setId_collectorNumber: {
        setId: tgSet.id,
        collectorNumber: 'TG04/TG30',
      },
    },
    update: {},
    create: {
      setId: tgSet.id,
      collectorNumber: 'TG04/TG30',
      normalizedNumber: 'TG04',
      rarity: 'Trainer Gallery Rare Holo',
      cardType: 'Pokemon',
      supertype: 'Basic',
      hp: '60',
      imageUrl: 'https://images.pokemontcg.io/swsh11tg/TG04.png',
      translations: {
        create: [
          { language: 'en', name: 'Pikachu' },
          { language: 'ja', name: 'ピカチュウ' },
        ],
      },
    },
  });

  console.log('Seeded sample Pokemon sets and cards successfully.');
}

