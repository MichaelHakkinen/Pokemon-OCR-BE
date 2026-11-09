import { ApiProperty } from '@nestjs/swagger';

/** Dropdown item returned by GET /option/admin-groups. */
export class AdminGroupOptionEntity {
  @ApiProperty({
    description: 'Admin group unique identifier (UUID)',
    example: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
  })
  id: string;

  @ApiProperty({
    description: 'Admin group name',
    example: 'Content Editor',
  })
  name: string;
}

/** A single rule within a module rule group (nested under ModuleRuleOptionGroupEntity). */
export class ModuleRuleOptionItemEntity {
  @ApiProperty({
    description: 'Module rule unique identifier (UUID)',
    example: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  })
  id: string;

  @ApiProperty({
    description: 'Rule name',
    example: 'View List',
  })
  name: string;
}

/**
 * Dropdown item returned by GET /option/module-rules — module rules grouped
 * by their parent module, for building RBAC assignment UI.
 */
export class ModuleRuleOptionGroupEntity {
  @ApiProperty({
    description: 'Module unique identifier (UUID)',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  id: string;

  @ApiProperty({
    description: 'Module name',
    example: 'Banner Management',
  })
  name: string;

  @ApiProperty({
    description:
      'Rules belonging to this module (active modules only, non-deleted rules only)',
    type: () => ModuleRuleOptionItemEntity,
    isArray: true,
  })
  rules: ModuleRuleOptionItemEntity[];
}
