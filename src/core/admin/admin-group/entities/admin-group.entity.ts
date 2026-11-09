import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A single module rule granted to an admin group, grouped under its module. */
export class AdminGroupModuleRuleEntity {
  @ApiProperty({
    description: 'Module rule ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id: string;

  @ApiProperty({
    description: 'Module rule name',
    example: 'Edit',
  })
  name: string;
}

/** A module with the rules granted to it, as returned by findOne(). */
export class AdminGroupModuleEntity {
  @ApiProperty({
    description: 'Module ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id: string;

  @ApiProperty({
    description: 'Module name',
    example: 'Admin Management',
  })
  name: string;

  @ApiProperty({
    description: 'Rules of this module granted to the admin group',
    type: [AdminGroupModuleRuleEntity],
  })
  rules: AdminGroupModuleRuleEntity[];
}

/** Summary of an admin belonging to the group, as returned by findOne(). */
export class AdminGroupMemberEntity {
  @ApiProperty({
    description: 'Admin ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id: string;

  @ApiProperty({
    description: 'Full name of the admin',
    example: 'Farhan Taufik Hidayat',
  })
  fullname: string;

  @ApiProperty({
    description: 'Login username of the admin',
    example: 'farhanth',
  })
  username: string;

  @ApiPropertyOptional({
    description: 'Email address of the admin',
    example: 'farhan@team.superfk.co',
    nullable: true,
  })
  email: string | null;
}

/** The module reference nested inside an access record's moduleRule. */
export class AdminGroupAccessModuleEntity {
  @ApiProperty({
    description: 'Module ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id: string;

  @ApiProperty({
    description: 'Module name',
    example: 'Admin Management',
  })
  name: string;
}

/** The module rule reference nested inside an access record. */
export class AdminGroupAccessModuleRuleEntity {
  @ApiProperty({
    description: 'Module rule ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id: string;

  @ApiProperty({
    description: 'Module rule name',
    example: 'Edit',
  })
  name: string;

  @ApiProperty({
    description: 'Module this rule belongs to',
    type: AdminGroupAccessModuleEntity,
  })
  module: AdminGroupAccessModuleEntity;
}

/**
 * A single admin group access record, as returned by create()/update()
 * (one row per granted module rule).
 */
export class AdminGroupAccessEntity {
  @ApiProperty({
    description: 'Admin group access record ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id: string;

  @ApiProperty({
    description: 'Admin group ID this access record belongs to',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  adminGroupId: string;

  @ApiProperty({
    description: 'Module rule ID granted by this access record',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  moduleRuleId: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-06-01T09:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-06-15T14:12:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Module rule granted by this access record',
    type: AdminGroupAccessModuleRuleEntity,
  })
  moduleRule: AdminGroupAccessModuleRuleEntity;
}

export class AdminGroupEntity {
  @ApiProperty({
    description: 'Admin group ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id: string;

  @ApiProperty({
    description: 'Admin group name',
    example: 'Content Editor',
  })
  name: string;

  @ApiProperty({
    description: 'Whether the admin group is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-06-01T09:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-06-15T14:12:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description:
      'Soft-delete timestamp, null when the admin group is not deleted',
    example: null,
    nullable: true,
  })
  deletedAt: Date | null;

  @ApiPropertyOptional({
    description:
      'Admins that belong to this group (returned by detail endpoint)',
    type: [AdminGroupMemberEntity],
  })
  members?: AdminGroupMemberEntity[];

  @ApiPropertyOptional({
    description:
      'Modules and their granted rules for this group (returned by detail endpoint)',
    type: [AdminGroupModuleEntity],
  })
  moduleRules?: AdminGroupModuleEntity[];

  @ApiPropertyOptional({
    description:
      'Raw access records created for this group (returned by create/update endpoints)',
    type: [AdminGroupAccessEntity],
  })
  access?: AdminGroupAccessEntity[];
}
