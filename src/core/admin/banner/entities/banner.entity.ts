import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BannerEntity {
  @ApiProperty({
    description: 'Banner unique identifier (UUID)',
    example: 'b3f1c2a0-6e4d-4b8a-9c1e-2f0a1d4e5c6b',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Banner title',
    example: 'Summer Sale 2026',
    nullable: true,
  })
  title?: string | null;

  @ApiPropertyOptional({
    description: 'Banner subtitle',
    example: 'Up to 50% off on selected items',
    nullable: true,
  })
  subtitle?: string | null;

  @ApiProperty({
    description:
      'Full URL to the uploaded banner media (image or video), resolved by the storage provider',
    example: 'http://localhost:3003/uploads/banner/summer-sale-1720000000.jpg',
  })
  mediaUrl: string;

  @ApiPropertyOptional({
    description: 'Destination URL the banner links to when clicked',
    example: 'https://example.com/promo/summer-sale',
    nullable: true,
  })
  urlTarget?: string | null;

  @ApiProperty({
    description: 'Sort order of the banner (lower ordinal is shown first)',
    example: 1,
  })
  ordinal?: number;

  @ApiProperty({
    description: 'Whether the banner is active and shown to end users',
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
    description: 'Soft-delete timestamp, null when the banner is not deleted',
    example: null,
    nullable: true,
  })
  deletedAt?: Date | null;
}

/** Shape returned by the bulk banner import endpoint. */
export class BannerImportResultEntity {
  @ApiProperty({
    description: 'Total number of rows parsed from the uploaded file',
    example: 25,
  })
  totalProcessed: number;

  @ApiProperty({
    description: 'Number of rows that passed validation and were imported',
    example: 25,
  })
  totalImported: number;

  @ApiProperty({
    description:
      'Number of chunks (batches of 100 rows) the import was split into',
    example: 1,
  })
  totalChunks: number;

  @ApiProperty({
    description: 'The banners created by the import',
    type: BannerEntity,
    isArray: true,
  })
  data: BannerEntity[];
}
