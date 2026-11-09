import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MatchedCard, PythonOcrResponse } from './dto/ocr.dto';

@Injectable()
export class CardResolutionService {
  private readonly logger = new Logger(CardResolutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalizes card numbers by removing denominators (e.g. "025/165" -> "025", "TG04/TG30" -> "TG04")
   */
  public normalizeCardNumber(numStr: string): string {
    const cleaned = numStr.trim();
    if (cleaned.includes('/')) {
      return cleaned.split('/')[0].trim();
    }
    return cleaned;
  }

  /**
   * Resolves card from database using two-stage strategy:
   * 1. Exact Set Code + Collector Number / Normalized Number match.
   * 2. Fallback: PostgreSQL pg_trgm similarity search for Latin scripts or normalized CJK search.
   */
  async resolveCard(ocrData: PythonOcrResponse): Promise<MatchedCard[]> {
    const { detected_script, name_candidates, set_number_candidates, set_code_candidates } = ocrData;

    // Stage 1: Exact Set Code + Number matching
    const exactMatches = await this.findExactMatches(set_code_candidates, set_number_candidates);
    if (exactMatches.length > 0) {
      this.logger.log(`Resolved ${exactMatches.length} card(s) via EXACT_CODE_AND_NUMBER match`);
      return exactMatches;
    }

    // Stage 2: Fallback to Trigram / Fuzzy Script-aware resolution
    const fuzzyMatches = await this.findFuzzyMatches(name_candidates, detected_script, set_code_candidates);
    if (fuzzyMatches.length > 0) {
      this.logger.log(`Resolved ${fuzzyMatches.length} card(s) via FUZZY match (Script: ${detected_script})`);
      return fuzzyMatches;
    }

    return [];
  }

  /**
   * Stage 1: Exact match on set code and collector number
   */
  private async findExactMatches(
    setCodes: string[],
    setNumbers: string[],
  ): Promise<MatchedCard[]> {
    if (!setCodes.length || !setNumbers.length) {
      return [];
    }

    // Build lists of numbers including normalized variants
    const rawNumbers = setNumbers.map((n) => n.trim());
    const normalizedNumbers = setNumbers.map((n) => this.normalizeCardNumber(n));
    const allNumberQueries = Array.from(new Set([...rawNumbers, ...normalizedNumbers]));

    // Query cards matching any of the set codes and numbers
    const foundCards = await this.prisma.card.findMany({
      where: {
        set: {
          code: {
            in: setCodes.map((c) => c.trim()),
            mode: 'insensitive',
          },
        },
        OR: [
          { collectorNumber: { in: allNumberQueries, mode: 'insensitive' } },
          { normalizedNumber: { in: allNumberQueries, mode: 'insensitive' } },
        ],
      },
      include: {
        set: true,
        translations: true,
      },
      take: 5,
    });

    return foundCards.map((card) => {
      // Pick first translation or default
      const defaultTrans = card.translations[0];
      return {
        id: card.id,
        name: defaultTrans ? defaultTrans.name : `Card #${card.collectorNumber}`,
        collectorNumber: card.collectorNumber,
        normalizedNumber: card.normalizedNumber,
        rarity: card.rarity,
        cardType: card.cardType,
        supertype: card.supertype,
        hp: card.hp,
        imageUrl: card.imageUrl,
        setCode: card.set.code,
        setName: card.set.name,
        language: defaultTrans ? defaultTrans.language : card.set.language,
        matchType: 'EXACT_CODE_AND_NUMBER',
        confidenceScore: 0.99,
      };
    });
  }

  /**
   * Stage 2: Fuzzy similarity search leveraging PostgreSQL pg_trgm for Latin,
   * or substring + similarity weighting for CJK scripts.
   */
  private async findFuzzyMatches(
    nameCandidates: string[],
    script: string,
    setCodes: string[],
  ): Promise<MatchedCard[]> {
    if (!nameCandidates.length) {
      return [];
    }

    const matches: MatchedCard[] = [];

    for (const nameCandidate of nameCandidates) {
      const sanitizedName = nameCandidate.replace(/['"%;]/g, '').trim();
      if (sanitizedName.length < 2) continue;

      if (script === 'japanese' || script === 'korean' || script === 'chinese') {
        // CJK matching strategy: Contains substring or character similarity
        const cjkResults = await this.prisma.$queryRaw<
          Array<{
            id: string;
            collectorNumber: string;
            normalizedNumber: string;
            rarity: string | null;
            cardType: string | null;
            supertype: string | null;
            hp: string | null;
            imageUrl: string | null;
            setCode: string;
            setName: string;
            name: string;
            language: string;
            score: number;
          }>
        >`
          SELECT 
            c.id,
            c."collectorNumber",
            c."normalizedNumber",
            c.rarity,
            c."cardType",
            c.supertype,
            c.hp,
            c."imageUrl",
            s.code AS "setCode",
            s.name AS "setName",
            ct.name,
            ct.language,
            CASE 
              WHEN ct.name = ${sanitizedName} THEN 1.0
              WHEN ct.name ILIKE '%' || ${sanitizedName} || '%' THEN 0.85
              ELSE similarity(ct.name, ${sanitizedName})
            END AS score
          FROM cards c
          JOIN sets s ON c."setId" = s.id
          JOIN card_translations ct ON c.id = ct."cardId"
          WHERE ct.name ILIKE '%' || ${sanitizedName} || '%'
             OR similarity(ct.name, ${sanitizedName}) > 0.3
          ORDER BY score DESC
          LIMIT 5;
        `;

        for (const row of cjkResults) {
          matches.push({
            id: row.id,
            name: row.name,
            collectorNumber: row.collectorNumber,
            normalizedNumber: row.normalizedNumber,
            rarity: row.rarity,
            cardType: row.cardType,
            supertype: row.supertype,
            hp: row.hp,
            imageUrl: row.imageUrl,
            setCode: row.setCode,
            setName: row.setName,
            language: row.language,
            matchType: 'NORMALIZED_CJK',
            confidenceScore: parseFloat(row.score.toString()),
          });
        }
      } else {
        // Latin scripts (English, Indonesian, French, German, Spanish, Italian):
        // Fast pg_trgm SIMILARITY() search with GIN index
        const latinResults = await this.prisma.$queryRaw<
          Array<{
            id: string;
            collectorNumber: string;
            normalizedNumber: string;
            rarity: string | null;
            cardType: string | null;
            supertype: string | null;
            hp: string | null;
            imageUrl: string | null;
            setCode: string;
            setName: string;
            name: string;
            language: string;
            score: number;
          }>
        >`
          SELECT 
            c.id,
            c."collectorNumber",
            c."normalizedNumber",
            c.rarity,
            c."cardType",
            c.supertype,
            c.hp,
            c."imageUrl",
            s.code AS "setCode",
            s.name AS "setName",
            ct.name,
            ct.language,
            similarity(ct.name, ${sanitizedName}) AS score
          FROM cards c
          JOIN sets s ON c."setId" = s.id
          JOIN card_translations ct ON c.id = ct."cardId"
          WHERE similarity(ct.name, ${sanitizedName}) > 0.35
          ORDER BY score DESC
          LIMIT 5;
        `;

        for (const row of latinResults) {
          // If a set code was also recognized, boost the confidence score
          let finalScore = parseFloat(row.score.toString());
          if (setCodes.some((sc) => sc.toLowerCase() === row.setCode.toLowerCase())) {
            finalScore = Math.min(1.0, finalScore + 0.15);
          }

          matches.push({
            id: row.id,
            name: row.name,
            collectorNumber: row.collectorNumber,
            normalizedNumber: row.normalizedNumber,
            rarity: row.rarity,
            cardType: row.cardType,
            supertype: row.supertype,
            hp: row.hp,
            imageUrl: row.imageUrl,
            setCode: row.setCode,
            setName: row.setName,
            language: row.language,
            matchType: 'PG_TRGM_FUZZY',
            confidenceScore: finalScore,
          });
        }
      }
    }

    // Sort combined fuzzy matches by confidence score descending and deduplicate by card id
    const uniqueMap = new Map<string, MatchedCard>();
    for (const match of matches) {
      if (!uniqueMap.has(match.id) || uniqueMap.get(match.id)!.confidenceScore < match.confidenceScore) {
        uniqueMap.set(match.id, match);
      }
    }

    return Array.from(uniqueMap.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5);
  }
}

