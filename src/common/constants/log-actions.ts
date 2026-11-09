/**
 * Log action types used in the system
 */
export const LogActions = {
  LOGIN: 'LOGIN',
  EDIT_PROFILE: 'EDIT PROFILE',
  VIEW: 'VIEW',
  ADD_NEW: 'ADD NEW',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',
  IMPORT: 'IMPORT',
} as const;

export type LogAction = (typeof LogActions)[keyof typeof LogActions];
