export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'LOCKED';

export const VALID_USER_ROLES: readonly UserRole[] = ['BUYER', 'SELLER', 'ADMIN'] as const;
export const VALID_USER_STATUSES: readonly UserStatus[] = ['ACTIVE', 'LOCKED'] as const;

export function isValidUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (VALID_USER_ROLES as readonly string[]).includes(role);
}

export function isValidUserStatus(status: unknown): status is UserStatus {
  return typeof status === 'string' && (VALID_USER_STATUSES as readonly string[]).includes(status);
}

// AuthUserRecord strictly omits any password or secret hash per QD02
export interface AuthUserRecord {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at?: string;
  updated_at?: string;
}
