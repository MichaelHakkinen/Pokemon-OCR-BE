import { BadRequestException, Injectable } from '@nestjs/common';
import { HelperService } from 'src/utils/helper.service';
import { QueryType } from 'src/models/admin/FAQ.model';
import { CreateFAQDto, UpdateFAQDto } from './dto/faq.dto';
import { FAQSortingDto } from './dto/sorting.dto';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { LogActions } from 'src/common/constants/log-actions';
import { PrismaService } from 'src/prisma/prisma.service';
import { FaqModel } from 'src/models';
import { lockScope, orderingScope } from 'src/common/helpers/db-lock.helper';
import { Prisma } from '@prisma';

@Injectable()
export class FAQService {
  constructor(
    private readonly helper: HelperService,
    private readonly prisma: PrismaService,
    private readonly faqModel: FaqModel,
  ) {}

  async findAll(query: QueryType): Promise<any> {
    // query all data
    const data = await this.faqModel.findAll(query);

    return data;
  }

  async findOne(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
      );
    }

    // get data
    const data = await this.faqModel.findOne(id);

    if (!data) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
      );
    }

    // Log View action
    await this.helper.logAction(LogActions.VIEW, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'View FAQ Detail',
    });

    return data;
  }

  async checkText1Exist(text1: string): Promise<boolean> {
    const data = await this.faqModel.findByText1IgnoreStatus(text1);
    return !!data;
  }

  // Moving `id` under `newParentId` must not create a cycle: the new parent
  // can't be the FAQ itself or any of its descendants (walk up from it).
  private async assertNotOwnDescendant(
    tx: Prisma.TransactionClient,
    id: string,
    newParentId: string | null,
  ): Promise<void> {
    const seen = new Set<string>();
    for (let current = newParentId; current;) {
      if (current === id || seen.has(current)) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('FAQ_PARENT_CYCLE'),
        );
      }
      seen.add(current);
      const node = await tx.fAQ.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      current = node?.parentId ?? null;
    }
  }

  // Level under `parentId`; the parent must exist and not be deleted.
  private async calculateLevel(
    tx: Prisma.TransactionClient,
    parentId: string | null,
  ): Promise<number> {
    if (!parentId) {
      return 0;
    }

    const parent = await tx.fAQ.findUnique({
      where: { id: parentId },
      select: { level: true, deletedAt: true },
    });

    if (!parent || parent.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('PARENT_FAQ_NOT_FOUND'),
      );
    }

    return parent.level + 1;
  }

  // Next ordinal among live siblings. Call inside a transaction that holds
  // the ordering lock for this parent (see lockScope).
  private async getNextOrdinal(
    tx: Prisma.TransactionClient,
    parentId: string | null,
    level: number,
  ): Promise<number> {
    const maxOrdinalFAQ = await tx.fAQ.findFirst({
      where: {
        parentId: parentId || null,
        level: level,
        deletedAt: null,
      },
      orderBy: {
        ordinal: 'desc',
      },
      select: {
        ordinal: true,
      },
    });

    return maxOrdinalFAQ ? maxOrdinalFAQ.ordinal + 1 : 1;
  }

  async create(
    createFAQDto: CreateFAQDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Calculate level based on parent
      const level = await this.calculateLevel(
        tx,
        createFAQDto.parentId || null,
      );

      // Next ordinal for this parent, under the ordering lock
      await lockScope(tx, orderingScope('faq', createFAQDto.parentId));
      const ordinal = await this.getNextOrdinal(
        tx,
        createFAQDto.parentId || null,
        level,
      );

      // create data
      const data = await tx.fAQ.create({
        data: {
          parentId: createFAQDto.parentId || null,
          text1: createFAQDto.text1,
          text2: createFAQDto.text2,
          level: level,
          ordinal: ordinal,
          isActive: createFAQDto.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          parent: {
            select: {
              id: true,
              text1: true,
              text2: true,
              level: true,
            },
          },
        },
      });

      // normalize data
      const normalizedData = {
        ...data,
      };

      return normalizedData;
    });

    // Log creation action
    await this.helper.logAction(LogActions.ADD_NEW, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Add New FAQ',
      valueAfter: transaction,
    });

    return transaction;
  }

  async update(
    id: string,
    updateFAQDto: UpdateFAQDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
      );
    }

    // check if data exists
    const faq = await this.faqModel.findOne(id);

    if (!faq) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
      );
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // update data
      const faqData = await tx.fAQ.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      // Check if parent changed: no cycles, live parent, new level, and the
      // FAQ goes to the end of its new siblings.
      let newLevel = faqData.level;
      let newOrdinal = faqData.ordinal;
      const newParentId =
        updateFAQDto.parentId !== undefined
          ? updateFAQDto.parentId || null
          : faqData.parentId;
      if (newParentId !== faqData.parentId) {
        await this.assertNotOwnDescendant(tx, id, newParentId);
        newLevel = await this.calculateLevel(tx, newParentId);
        await lockScope(tx, orderingScope('faq', newParentId));
        newOrdinal = await this.getNextOrdinal(tx, newParentId, newLevel);
      }

      const updatedFAQ = await tx.fAQ.update({
        where: { id },
        data: {
          parentId: newParentId,
          text1: updateFAQDto.text1 ?? faqData.text1,
          text2: updateFAQDto.text2 ?? faqData.text2,
          level: newLevel,
          ordinal: newOrdinal,
          isActive: updateFAQDto.isActive ?? faqData.isActive,
          updatedAt: new Date(),
        },
        include: {
          parent: {
            select: {
              id: true,
              text1: true,
              text2: true,
              level: true,
            },
          },
          children: {
            select: {
              id: true,
              text1: true,
              text2: true,
              level: true,
            },
            where: {
              deletedAt: null,
            },
          },
        },
      });

      // If parent changed, recursively update children levels
      if (
        updateFAQDto.parentId !== undefined &&
        updateFAQDto.parentId !== faqData.parentId
      ) {
        await this.updateChildrenLevels(tx, id, newLevel);
      }

      // normalize data
      const normalizedData = {
        ...updatedFAQ,
      };

      return normalizedData;
    });

    // Log update action
    await this.helper.logAction(LogActions.UPDATE, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Update FAQ',
      valueBefore: faq,
      valueAfter: transaction,
    });

    return transaction;
  }

  private async updateChildrenLevels(
    tx: any,
    parentId: string,
    parentLevel: number,
  ): Promise<void> {
    const children = await tx.fAQ.findMany({
      where: {
        parentId: parentId,
        deletedAt: null,
      },
    });

    for (const child of children) {
      await tx.fAQ.update({
        where: { id: child.id },
        data: {
          level: parentLevel + 1,
          updatedAt: new Date(),
        },
      });

      // Recursively update grandchildren
      await this.updateChildrenLevels(tx, child.id, parentLevel + 1);
    }
  }

  async delete(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<void> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
      );
    }

    // check if data exists
    const faq = await this.faqModel.findOne(id);

    if (!faq) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
      );
    }

    // Soft-delete the FAQ and its whole live subtree with one shared
    // timestamp, so restoring the FAQ brings back exactly this subtree.
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const ids = [id];
      for (let frontier = [id]; frontier.length > 0;) {
        const children = await tx.fAQ.findMany({
          where: { parentId: { in: frontier }, deletedAt: null },
          select: { id: true },
        });
        frontier = children.map((c) => c.id);
        ids.push(...frontier);
      }
      await tx.fAQ.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt, updatedAt: deletedAt },
      });
    });

    // Log delete action
    await this.helper.logAction(LogActions.DELETE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Delete FAQ',
      valueBefore: faq,
    });
  }

  async restore(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
      );
    }

    // check if data exists and is deleted
    const faq = await this.prisma.fAQ.findFirst({
      where: {
        id,
      },
    });

    if (!faq) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
      );
    }

    if (faq.deletedAt === null) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_DELETED'),
      );
    }

    // A child can't come back under a parent that is still deleted.
    if (faq.parentId) {
      const parent = await this.prisma.fAQ.findUnique({
        where: { id: faq.parentId },
        select: { deletedAt: true },
      });
      if (!parent || parent.deletedAt) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('FAQ_PARENT_DELETED'),
        );
      }
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Restore the descendants deleted together with this FAQ (same
      // deletedAt stamp); ones deleted separately earlier stay deleted.
      const subtree: string[] = [];
      for (let frontier = [id]; frontier.length > 0;) {
        const children = await tx.fAQ.findMany({
          where: { parentId: { in: frontier }, deletedAt: faq.deletedAt },
          select: { id: true },
        });
        frontier = children.map((c) => c.id);
        subtree.push(...frontier);
      }
      if (subtree.length > 0) {
        await tx.fAQ.updateMany({
          where: { id: { in: subtree } },
          data: { deletedAt: null, updatedAt: new Date() },
        });
      }

      // The restored FAQ goes to the end of its (live) siblings.
      await lockScope(tx, orderingScope('faq', faq.parentId));
      const lastSibling = await tx.fAQ.aggregate({
        where: { parentId: faq.parentId, deletedAt: null },
        _max: { ordinal: true },
      });

      // restore data by setting deletedAt to null
      const restoredFAQ = await tx.fAQ.update({
        where: { id },
        data: {
          deletedAt: null,
          ordinal: (lastSibling._max.ordinal ?? 0) + 1,
          updatedAt: new Date(),
        },
        include: {
          parent: {
            select: {
              id: true,
              text1: true,
              text2: true,
              level: true,
            },
          },
          children: {
            select: {
              id: true,
              text1: true,
              text2: true,
              level: true,
            },
            where: {
              deletedAt: null,
            },
          },
        },
      });

      // normalize data
      const data = {
        ...restoredFAQ,
      };

      return data;
    });

    // Log restore action
    await this.helper.logAction(LogActions.RESTORE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Restore FAQ',
    });

    return transaction;
  }

  async sorting(faqSortingDto: FAQSortingDto): Promise<any> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Get the FAQ to move
      const faqToMove = await tx.fAQ.findUnique({
        where: { id: faqSortingDto.id },
      });

      if (!faqToMove || faqToMove.deletedAt) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('FAQ_NOT_FOUND'),
        );
      }

      await lockScope(tx, orderingScope('faq', faqToMove.parentId));

      // Live siblings in list order (position 1 = lowest ordinal, as listed);
      // soft-deleted FAQs don't count.
      const allFAQsInLevel = await tx.fAQ.findMany({
        where: {
          level: faqToMove.level,
          parentId: faqToMove.parentId,
          deletedAt: null,
        },
        orderBy: {
          ordinal: 'asc',
        },
      });

      // Validate new position
      if (faqSortingDto.newPosition > allFAQsInLevel.length) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessageWithReplace(
            'INVALID_FAQ_POSITION',
            {
              maxPosition: allFAQsInLevel.length.toString(),
            },
          ),
        );
      }

      // Find current position (1-based index)
      const currentPosition =
        allFAQsInLevel.findIndex((faq) => faq.id === faqSortingDto.id) + 1;

      // If position hasn't changed, no need to update
      if (currentPosition === faqSortingDto.newPosition) {
        const normalizedData = {
          ...faqToMove,
        };
        return normalizedData;
      }

      // Remove FAQ from current position
      const faqsArray = [...allFAQsInLevel];
      const [movedFAQ] = faqsArray.splice(currentPosition - 1, 1);

      // Insert FAQ at new position
      faqsArray.splice(faqSortingDto.newPosition - 1, 0, movedFAQ);

      // Recalculate ordinals so ordinal = position (1, 2, 3, ...)
      const updatePromises = [];
      for (let i = 0; i < faqsArray.length; i++) {
        const newOrdinal = i + 1;

        // Only update if ordinal has changed
        if (faqsArray[i].ordinal !== newOrdinal) {
          updatePromises.push(
            tx.fAQ.update({
              where: { id: faqsArray[i].id },
              data: {
                ordinal: newOrdinal,
                updatedAt: new Date(),
              },
            }),
          );
        }
      }

      // Execute all updates in parallel
      await Promise.all(updatePromises);

      // Fetch updated FAQ
      const updatedFAQ = await tx.fAQ.findUnique({
        where: { id: faqSortingDto.id },
        include: {
          parent: {
            select: {
              id: true,
              text1: true,
              text2: true,
              level: true,
            },
          },
          children: {
            select: {
              id: true,
              text1: true,
              text2: true,
              level: true,
            },
            where: {
              deletedAt: null,
            },
          },
        },
      });

      // normalize data
      const normalizedData = {
        ...updatedFAQ,
      };

      return normalizedData;
    });

    return transaction;
  }
}
