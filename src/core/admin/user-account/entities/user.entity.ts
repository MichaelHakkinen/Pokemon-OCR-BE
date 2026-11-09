import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response shape for a User Account record.
 *
 * Mirrors the Prisma `User` model (see prisma/schema.prisma) as normalized
 * by user.service.ts: `password` is stripped and `avatar` is rewritten to a
 * fully-qualified URL via HelperService.generateFileUrl(). Never document
 * the raw password/hash field.
 */
export class UserEntity {
  @ApiProperty({
    description: 'Unique identifier (UUID) of the user account',
    example: 'b3f6c1e2-4a8b-4c9d-9e2f-1234567890ab',
  })
  id: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  fullname: string;

  @ApiPropertyOptional({
    description: 'Email address of the user',
    example: 'johndoe@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Phone number of the user',
    example: '081234567890',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Unique username used for login',
    example: 'johndoe',
  })
  username: string;

  @ApiPropertyOptional({
    description:
      'Fully-qualified URL to the user avatar image, or null if not set',
    example:
      'http://localhost:3003/response/public$avatar-user$user-johndoe-1699999999.jpg',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when the user account was created',
    example: '2026-07-01T08:30:00.000Z',
    nullable: true,
  })
  createdAt: Date | null;

  @ApiPropertyOptional({
    description: 'Timestamp when the user account was last updated',
    example: '2026-07-01T08:30:00.000Z',
    nullable: true,
  })
  updatedAt: Date | null;

  @ApiPropertyOptional({
    description:
      'Timestamp when the user account was soft-deleted, or null if not deleted',
    example: null,
    nullable: true,
  })
  deletedAt: Date | null;
}
