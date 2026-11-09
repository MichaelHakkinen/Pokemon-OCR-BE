import { applyDecorators, HttpStatus, SetMetadata } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';

export const UNDER_MAINTENANCE_KEY = 'under_maintenance';

/**
 * Marks a user-facing controller or route as subject to maintenance mode.
 * While the matching flag is on, MaintenanceGuard answers 503:
 *   - X-Client-Platform: mobile → IS_MOBILE_MAINTENANCE
 *   - X-Client-Platform: web    → IS_WEBSITE_MAINTENANCE
 *   - header missing/other      → only when both flags are on
 * Admin routes are never marked, so admins can always switch it off again.
 */
export const UnderMaintenance = () =>
  applyDecorators(
    SetMetadata(UNDER_MAINTENANCE_KEY, true),
    ApiHeader({
      name: 'X-Client-Platform',
      required: false,
      enum: ['mobile', 'web'],
      description:
        'Which client is calling; selects the maintenance flag (IS_MOBILE_MAINTENANCE / IS_WEBSITE_MAINTENANCE).',
    }),
    ApiResponse({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      description: 'The app is under maintenance for this platform.',
    }),
  );
