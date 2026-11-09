import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AddToCollectionDto,
  ExportFieldDefinitionDto,
  FieldType,
  UpdateExportConfigDto,
} from './dto/collection.dto';

const DEFAULT_EXPORT_FIELDS: ExportFieldDefinitionDto[] = [
  {
    key: 'condition',
    label: 'Condition',
    type: FieldType.DROPDOWN,
    options: ['Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Damaged'],
    defaultValue: 'Near Mint',
    required: true,
  },
  {
    key: 'graded',
    label: 'Graded?',
    type: FieldType.DROPDOWN,
    options: ['Raw', 'PSA', 'BGS', 'CGC', 'ARS'],
    defaultValue: 'Raw',
    required: true,
  },
  {
    key: 'purchaseCurrency',
    label: 'Purchase Currency',
    type: FieldType.DROPDOWN,
    options: ['IDR', 'USD', 'JPY', 'EUR', 'GBP', 'SGD'],
    defaultValue: 'IDR',
    required: false,
  },
  {
    key: 'purchasePrice',
    label: 'Purchase Price',
    type: FieldType.NUMBER,
    defaultValue: 0,
    required: false,
  },
  {
    key: 'storageBoxId',
    label: 'Storage Box / Binder ID',
    type: FieldType.TEXT,
    defaultValue: 'Binder-01',
    required: false,
  },
  {
    key: 'notes',
    label: 'Notes / Location',
    type: FieldType.TEXT,
    defaultValue: '',
    required: false,
  },
];

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves export configuration for a user. Falls back to default template.
   */
  async getExportConfig(userId?: string) {
    if (userId) {
      const userConfig = await this.prisma.exportConfig.findUnique({
        where: { userId },
      });
      if (userConfig) {
        return {
          id: userConfig.id,
          isEnabled: userConfig.isEnabled,
          fields: userConfig.fields as unknown as ExportFieldDefinitionDto[],
        };
      }
    }

    return {
      id: 'default',
      isEnabled: true,
      fields: DEFAULT_EXPORT_FIELDS,
    };
  }

  /**
   * Updates or persists dynamic export fields configuration and toggle for a user.
   */
  async updateExportConfig(userId: string, dto: UpdateExportConfigDto) {
    const config = await this.prisma.exportConfig.upsert({
      where: { userId },
      create: {
        userId,
        isEnabled: dto.isEnabled,
        fields: dto.fields as any,
      },
      update: {
        isEnabled: dto.isEnabled,
        fields: dto.fields as any,
      },
    });

    return {
      id: config.id,
      isEnabled: config.isEnabled,
      fields: config.fields as unknown as ExportFieldDefinitionDto[],
    };
  }

  /**
   * Adds a scanned or selected card to user's collection with arbitrary custom fields JSON.
   */
  async addToCollection(userId: string, dto: AddToCollectionDto) {
    const card = await this.prisma.card.findUnique({
      where: { id: dto.cardId },
    });
    if (!card) {
      throw new NotFoundException(`Card with ID ${dto.cardId} not found.`);
    }

    return this.prisma.userCardCollection.create({
      data: {
        userId,
        cardId: dto.cardId,
        condition: dto.condition || 'NM',
        grade: dto.grade || 'Raw',
        language: dto.language || 'en',
        quantity: dto.quantity || 1,
        customFields: dto.customFields || {},
      },
      include: {
        card: {
          include: {
            set: true,
            translations: true,
          },
        },
      },
    });
  }

  /**
   * Fetches user's entire card collection with relations.
   */
  async getUserCollection(userId: string) {
    return this.prisma.userCardCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            set: true,
            translations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Compiles user's collection into a CSV format string.
   * Standard columns are combined with dynamic custom survey fields as configured.
   */
  async generateCollectionCsv(
    userId: string,
    runtimeSurveyAnswers?: Record<string, any>,
  ): Promise<string> {
    const items = await this.getUserCollection(userId);
    const exportConfig = await this.getExportConfig(userId);
    const dynamicFields: ExportFieldDefinitionDto[] = exportConfig.fields;

    // Define Base Headers
    const standardHeaders = [
      'Collection Item ID',
      'Card Name',
      'Set Code',
      'Set Name',
      'Collector Number',
      'Rarity',
      'Condition',
      'Grade',
      'Language',
      'Quantity',
      'Acquired Date',
    ];

    // Dynamic headers configured in popup survey
    const dynamicHeaders = dynamicFields.map((f) => f.label || f.key);
    const fullHeaderRow = [...standardHeaders, ...dynamicHeaders];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows: string[] = [];
    rows.push(fullHeaderRow.map(escapeCsv).join(','));

    for (const item of items) {
      const card = item.card;
      const trans = card.translations[0];
      const cardName = trans ? trans.name : `Card ${card.collectorNumber}`;

      const rowValues: any[] = [
        item.id,
        cardName,
        card.set.code,
        card.set.name,
        card.collectorNumber,
        card.rarity || 'Unknown',
        item.condition,
        item.grade || 'Raw',
        item.language,
        item.quantity,
        item.acquiredDate ? item.acquiredDate.toISOString() : '',
      ];

      // Merge dynamic custom fields: priority given to runtime survey answers, then item customFields
      const itemCustom = (item.customFields as Record<string, any>) || {};
      for (const field of dynamicFields) {
        let value = '';
        if (runtimeSurveyAnswers && runtimeSurveyAnswers[field.key] !== undefined) {
          value = runtimeSurveyAnswers[field.key];
        } else if (itemCustom[field.key] !== undefined) {
          value = itemCustom[field.key];
        } else if (field.defaultValue !== undefined) {
          value = field.defaultValue;
        }
        rowValues.push(value);
      }

      rows.push(rowValues.map(escapeCsv).join(','));
    }

    return rows.join('\r\n');
  }
}

