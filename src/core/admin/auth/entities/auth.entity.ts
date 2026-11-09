import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Minimal admin profile embedded in login / refresh-token responses.
 * Mirrors the `user` object built in AuthService.login() / refreshToken().
 */
export class AuthenticatedAdminEntity {
  @ApiProperty({
    example: 'b3f1c2a0-1e4a-4b8b-9c2a-0f3a5d6e7f89',
    description: 'Admin unique identifier.',
  })
  id: string;

  @ApiProperty({
    example: 'Super Admin',
    description: "Admin's full name.",
  })
  fullname: string;

  @ApiProperty({
    example: 'admin@superfk.co',
    description: "Admin's email address.",
  })
  email: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatar-admin/admin-1234.png',
    description: 'Public URL of the admin avatar, or null if not set.',
    nullable: true,
  })
  avatar: string | null;
}

/** A single module rule (permission) granted to a module. */
export class GrantedModuleRuleEntity {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Module rule identifier.',
  })
  id: string;

  @ApiProperty({
    example: 'View List',
    description: 'Name of the permitted action/rule.',
  })
  name: string;
}

/** A module with the rules the admin's group(s) grant access to. */
export class ModuleAccessEntity {
  @ApiProperty({
    example: '11111111-2222-3333-4444-555555555555',
    description: 'Module identifier.',
  })
  id: string;

  @ApiProperty({
    example: 'Banner Management',
    description: 'Module name.',
  })
  name: string;

  @ApiProperty({
    type: () => GrantedModuleRuleEntity,
    isArray: true,
    description: 'Rules granted for this module.',
  })
  rules: GrantedModuleRuleEntity[];
}

/** An admin group the authenticated admin belongs to. */
export class AdminGroupMembershipEntity {
  @ApiProperty({
    example: '66666666-7777-8888-9999-000000000000',
    description: 'Admin group identifier.',
  })
  id: string;

  @ApiProperty({
    example: 'Super Admin',
    description: 'Admin group name.',
  })
  name: string;
}

/** RBAC detail attached to login/refresh-token responses. */
export class AdminGroupDetailEntity {
  @ApiProperty({
    type: () => AdminGroupMembershipEntity,
    isArray: true,
    description: 'Admin groups the admin belongs to.',
  })
  groups: AdminGroupMembershipEntity[];

  @ApiProperty({
    type: () => ModuleAccessEntity,
    isArray: true,
    description:
      'Modules and rules the admin has access to via their group(s).',
  })
  modules: ModuleAccessEntity[];
}

/** Response returned by POST /auth (login). */
export class LoginResponseEntity {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token used to authorize subsequent requests.',
  })
  token: string;

  @ApiProperty({
    example: 'b6e2c1d0f4a5...9f8e7d6c5b4a3928',
    description: 'Opaque refresh token used to obtain a new access token.',
  })
  refreshToken: string;

  @ApiProperty({
    type: () => AuthenticatedAdminEntity,
    description: 'Basic profile of the authenticated admin.',
  })
  user: AuthenticatedAdminEntity;

  @ApiProperty({
    type: () => AdminGroupDetailEntity,
    description: "Admin's group memberships and module access.",
  })
  adminGroupDetail: AdminGroupDetailEntity;
}

/** Response returned by POST /auth/refresh-token. */
export class RefreshTokenResponseEntity {
  @ApiProperty({
    example: 200,
    description: 'HTTP status code echoed in the payload.',
  })
  code: number;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Newly issued JWT access token.',
  })
  token: string;

  @ApiProperty({
    example: 'c7f3d2e1a5b6...0a9b8c7d6e5f4a3b',
    description:
      'Newly issued refresh token. The previous refresh token is revoked.',
  })
  refreshToken: string;

  @ApiProperty({
    type: () => AuthenticatedAdminEntity,
    description: 'Basic profile of the authenticated admin.',
  })
  user: AuthenticatedAdminEntity;

  @ApiProperty({
    type: () => AdminGroupDetailEntity,
    description: "Admin's group memberships and module access.",
  })
  adminGroupDetail: AdminGroupDetailEntity;
}

/**
 * Full admin profile returned by GET/POST /auth/profile and
 * POST /auth/change-avatar (password field is always omitted).
 */
export class AdminProfileEntity {
  @ApiProperty({
    example: 'b3f1c2a0-1e4a-4b8b-9c2a-0f3a5d6e7f89',
    description: 'Admin unique identifier.',
  })
  id: string;

  @ApiProperty({
    example: 'superadmin',
    description: 'Username used to sign in.',
  })
  username: string;

  @ApiProperty({
    example: 'Super Admin',
    description: "Admin's full name.",
  })
  fullname: string;

  @ApiPropertyOptional({
    example: 'admin@superfk.co',
    description: "Admin's email address.",
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    example: '081234567890',
    description: "Admin's phone number.",
  })
  phoneNumber: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatar-admin/admin-1234.png',
    description: 'Public URL of the admin avatar, or null if not set.',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the admin account is active.',
  })
  isActive: boolean;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Timestamp the admin account was created.',
    nullable: true,
  })
  createdAt: Date | null;

  @ApiPropertyOptional({
    example: '2026-06-01T00:00:00.000Z',
    description: 'Timestamp the admin account was last updated.',
    nullable: true,
  })
  updatedAt: Date | null;

  @ApiPropertyOptional({
    example: null,
    description:
      'Timestamp the admin account was soft-deleted, or null if active.',
    nullable: true,
  })
  deletedAt: Date | null;
}

/** Response returned by POST /auth/verify-otp. */
export class OtpVerifiedResponseEntity {
  @ApiProperty({
    example: 'f9e8d7c6b5a4938271605f4e3d2c1b0a',
    description:
      'Short-lived reset token to be used as the `token` field on POST /auth/reset-password. Valid for 15 minutes.',
  })
  token: string;
}

/** Response returned by POST /auth/change-password. */
export class MessageResponseEntity {
  @ApiProperty({
    example: 'Password changed successfully',
    description: 'Human readable result message.',
  })
  message: string;
}

/** Response returned by POST /auth/logout. */
export class LogoutResponseEntity {
  @ApiProperty({
    example: 200,
    description: 'HTTP status code echoed in the payload.',
  })
  code: number;

  @ApiProperty({
    example: 'Logout successful',
    description: 'Human readable result message.',
  })
  message: string;
}
