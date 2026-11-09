import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Summary of the admin group(s) an admin belongs to, as returned by
 * findAll()/findOne() in AdminService (excludes the `*root` group).
 */
export class AdminGroupSummaryEntity {
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
}

export class AdminEntity {
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

  @ApiPropertyOptional({
    description: 'Email address of the admin',
    example: 'farhan@team.superfk.co',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Phone number of the admin',
    example: '+6281231412322',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Login username of the admin',
    example: 'farhanth',
  })
  username: string;

  @ApiPropertyOptional({
    description: 'Public URL of the admin avatar image, or null if not set',
    example: 'https://cdn.example.com/avatar-admin/admin-farhan-th.webp',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    description: 'Whether the admin account is active',
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
    description: 'Soft-delete timestamp, null when the admin is not deleted',
    example: null,
    nullable: true,
  })
  deletedAt: Date | null;

  @ApiPropertyOptional({
    description:
      'Admin group(s) the admin belongs to (returned on list/detail endpoints)',
    type: [AdminGroupSummaryEntity],
  })
  adminGroups?: AdminGroupSummaryEntity[];
}
