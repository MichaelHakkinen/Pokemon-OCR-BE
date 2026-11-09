import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Minimal shape used for `parent`/`children` relations (selected fields only). */
export class FaqRelationEntity {
  @ApiProperty({
    description: 'FAQ unique identifier (UUID)',
    example: '7c1e4b2a-3d5f-4a6b-8c9d-1e2f3a4b5c6d',
  })
  id: string;

  @ApiProperty({
    description: 'Question text',
    example: 'How do I reset my password?',
  })
  text1: string;

  @ApiProperty({
    description: 'Answer text',
    example: 'Go to Settings > Security > Reset Password.',
  })
  text2: string;

  @ApiProperty({
    description: 'Nesting depth, 0 for root-level FAQs',
    example: 0,
  })
  level: number;
}

export class FaqEntity {
  @ApiProperty({
    description: 'FAQ unique identifier (UUID)',
    example: '9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d',
  })
  id: string;

  @ApiPropertyOptional({
    description:
      'Parent FAQ id, null for root-level FAQs (use "null" query value to filter root FAQs)',
    example: null,
    nullable: true,
  })
  parentId?: string | null;

  @ApiProperty({
    description: 'Question text',
    example: 'How do I reset my password?',
  })
  text1: string;

  @ApiProperty({
    description: 'Answer text',
    example: 'Go to Settings > Security > Reset Password.',
  })
  text2: string;

  @ApiProperty({
    description: 'Sort order of the FAQ within its parent/level',
    example: 1,
  })
  ordinal: number;

  @ApiProperty({
    description:
      'Nesting depth, 0 for root-level FAQs, incremented per child level',
    example: 0,
  })
  level: number;

  @ApiProperty({
    description: 'Whether the FAQ is active and shown to end users',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Creation timestamp',
    example: '2026-07-01T08:30:00.000Z',
    nullable: true,
  })
  createdAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Last update timestamp',
    example: '2026-07-02T10:15:00.000Z',
    nullable: true,
  })
  updatedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Soft-delete timestamp, null when the FAQ is not deleted',
    example: null,
    nullable: true,
  })
  deletedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Parent FAQ summary, present when this FAQ has a parent',
    type: FaqRelationEntity,
    nullable: true,
  })
  parent?: FaqRelationEntity | null;

  @ApiPropertyOptional({
    description: 'Child FAQs nested under this FAQ (non-deleted only)',
    type: FaqRelationEntity,
    isArray: true,
  })
  children?: FaqRelationEntity[];
}
