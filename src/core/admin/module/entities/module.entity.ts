import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ModuleEntity {
  @ApiProperty({
    description: 'Module unique identifier (UUID)',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  id: string;

  @ApiProperty({
    description: 'Module name (must be unique across all modules)',
    example: 'Banner Management',
  })
  name: string;

  @ApiProperty({
    description:
      'Whether the module is active and available for RBAC assignment',
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
    description: 'Soft-delete timestamp, null when the module is not deleted',
    example: null,
    nullable: true,
  })
  deletedAt?: Date | null;
}
