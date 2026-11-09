import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GlobalConfigEntity {
  @ApiProperty({
    description: 'Global config unique identifier (UUID)',
    example: 'f1e2d3c4-b5a6-4978-8697-0a1b2c3d4e5f',
  })
  id: string;

  @ApiProperty({
    description: 'Config key, unique across all global configs',
    example: 'IS_MOBILE_MAINTENANCE',
  })
  key: string;

  @ApiPropertyOptional({
    description: 'Config value, stored and returned as text',
    example: 'false',
    nullable: true,
  })
  value?: string | null;

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
}
