import { type UserRole, isValidUserRole } from '../../modules/identity/domain/types.ts';
import { ValidationFailedError } from '../errors/app-error.ts';

export interface RequestContext {
  readonly request_id: string;
  readonly user_id: string;
  readonly role: UserRole;
  readonly shop_id?: string;
  readonly shop_status?: string;
}

export interface CreateRequestContextInput {
  request_id: string;
  user_id: string;
  role: UserRole;
  shop_id?: string;
  shop_status?: string;
}

export function createRequestContext(input: CreateRequestContextInput): RequestContext {
  if (!isValidUserRole(input.role)) {
    throw new ValidationFailedError(`Invalid role: '${String(input.role)}'. Allowed roles: BUYER, SELLER, ADMIN`, [
      { field: 'role', message: 'Role must be BUYER, SELLER, or ADMIN' }
    ]);
  }

  // Strict rule: Only SELLER may have shop_id; BUYER and ADMIN must have undefined shop_id
  const assignedShopId = input.role === 'SELLER' ? input.shop_id : undefined;
  const assignedShopStatus = input.role === 'SELLER' ? input.shop_status ?? (input.shop_id ? 'ACTIVE' : undefined) : undefined;

  const context: RequestContext = {
    request_id: input.request_id,
    user_id: input.user_id,
    role: input.role,
    shop_id: assignedShopId,
    shop_status: assignedShopStatus,
  };

  return Object.freeze(context);
}
