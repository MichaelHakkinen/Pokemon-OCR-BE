import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ModuleRuleEntity {
  @ApiProperty({
    description: 'Module rule unique identifier (UUID)',
    example: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  })
  id: string;

  @ApiProperty({
    description: 'Id of the module this rule belongs to',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  moduleId: string;

  @ApiProperty({
    description:
      'Rule name, unique within its module (e.g. "View List", "Edit")',
    example: 'View List',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of what the rule grants access to',
    example: 'User can View List the Banner Management data',
    nullable: true,
  })
  description?: string | null;

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
    description: 'Soft-delete timestamp, null when the rule is not deleted',
    example: null,
    nullable: true,
  })
  deletedAt?: Date | null;
}

/**
 * Response shape returned by POST /module-rule when `isPackage: true` is sent —
 * instead of creating a single rule, the service creates the standard set of
 * CRUD rules (View List, View Details, Add New, Edit, Delete, Restore) for the
 * given module, skipping any that already exist.
 */
export class ModuleRulePackageCreateEntity {
  @ApiProperty({
    description: 'Id of the module the rule package was created for',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  moduleId: string;

  @ApiProperty({
    description:
      'Number of rules actually created (excludes any that already existed)',
    example: 5,
  })
  createdCount: number;

  @ApiProperty({
    description:
      'Names of standard rules that already existed for this module and were skipped',
    example: ['Delete'],
    type: [String],
  })
  skipped: string[];

  @ApiProperty({
    description: 'The module rules that were created',
    type: () => ModuleRuleEntity,
    isArray: true,
  })
  data: ModuleRuleEntity[];
}
