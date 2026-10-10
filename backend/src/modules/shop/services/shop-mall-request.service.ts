import { randomUUID, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { RequestContext } from '../../../platform/context/request-context.ts';
import type { IAuditPort } from '../../../contracts/audit.port.ts';
import type { ITargetLookupRepository } from '../../moderation/domain/moderation.types.ts';
import {
  ValidationFailedError,
  ReasonRequiredError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AuditWriteFailedError,
} from '../../../platform/errors/app-error.ts';
import type {
  ApproveMallRequestInput,
  ListMallRequestsQuery,
  RejectMallRequestInput,
  ShopMallRequest,
  ShopMallRequestListItem,
  SubmitMallRequestInput,
} from '../domain/shop-mall-request.types.ts';
import { PgShopMallRequestRepository } from '../repositories/pg-shop-mall-request.repository.ts';
import { PgIdempotencyRepository, type TransactionalIdempotencyClaim } from '../../checkout/repositories/pg-idempotency.repository.ts';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class ShopMallRequestService {
  constructor(
    private readonly pool: Pool,
    private readonly repo: PgShopMallRequestRepository,
    private readonly targetRepo: ITargetLookupRepository,
    private readonly auditPort: IAuditPort
  ) {}

  private validateUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new ValidationFailedError('document_url is required');
    }
    const trimmed = rawUrl.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      throw new ValidationFailedError('document_url must be between 10 and 500 characters');
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new ValidationFailedError('document_url is not a valid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ValidationFailedError('document_url must use HTTP or HTTPS protocol');
    }
    if (!parsed.hostname || parsed.hostname.length === 0) {
      throw new ValidationFailedError('document_url must have a valid hostname');
    }
    return trimmed;
  }

  public async submitRequest(
    ctx: RequestContext,
    input: SubmitMallRequestInput,
    idempotencyKey?: string
  ): Promise<ShopMallRequest> {
    if (ctx.role !== 'SELLER') {
      throw new ForbiddenError('RESOURCE_FORBIDDEN', 'Only sellers can submit mall upgrade requests');
    }
    if (!ctx.shop_id) {
      throw new ValidationFailedError('User has no shop associated');
    }

    const cleanReason = input.reason?.trim();
    if (!cleanReason || cleanReason.length < 10 || cleanReason.length > 1000) {
      throw new ValidationFailedError('Reason must be between 10 and 1000 characters');
    }

    const cleanDocUrl = this.validateUrl(input.document_url);

    return await this.withTx(async (trx) => {
      let claim: TransactionalIdempotencyClaim<ShopMallRequest> | undefined;
      let idempotencyRepo: PgIdempotencyRepository | undefined;
      let fingerprint = '';

      if (idempotencyKey) {
        idempotencyRepo = new PgIdempotencyRepository(trx);
        fingerprint = createHash('sha256')
          .update(JSON.stringify({ shop_id: ctx.shop_id, reason: cleanReason, document_url: cleanDocUrl }))
          .digest('hex');
        const scope = { user_id: ctx.user_id, endpoint: '/api/v1/seller/shop/mall-requests', key: idempotencyKey };
        claim = await idempotencyRepo.claim<ShopMallRequest>(scope, fingerprint);

        if (claim.kind === 'replay') return claim.result;
        if (claim.kind === 'conflict') {
          throw new ConflictError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 'Idempotency key reused with different payload');
        }
        if (claim.kind === 'in_progress') {
          throw new ConflictError('OPERATION_IN_PROGRESS', 'Concurrent operation in progress for this key');
        }
      }

      // Check shop eligibility with lock
      const shop = await this.repo.findShopForUpdate(trx, ctx.shop_id!);
      if (!shop) throw new NotFoundError('Shop was not found');
      if (shop.owner_id !== ctx.user_id) {
        throw new ForbiddenError('RESOURCE_FORBIDDEN', 'You do not own this shop');
      }
      if (shop.status !== 'ACTIVE') {
        throw new ConflictError('SHOP_NOT_ACTIVE', 'Shop must be ACTIVE to request Mall tier');
      }
      if (shop.tier === 'MALL') {
        throw new ConflictError('SHOP_ALREADY_MALL', 'Shop already has MALL tier');
      }

      // Check pending request
      const pending = await this.repo.findPendingByShopId(ctx.shop_id!);
      if (pending) {
        throw new ConflictError('PENDING_REQUEST_EXISTS', 'Shop already has a pending mall upgrade request');
      }

      const created = await this.repo.insert(trx, {
        shop_id: ctx.shop_id!,
        seller_id: ctx.user_id,
        reason: cleanReason,
        document_url: cleanDocUrl,
      });

      if (idempotencyRepo && idempotencyKey) {
        const scope = { user_id: ctx.user_id, endpoint: '/api/v1/seller/shop/mall-requests', key: idempotencyKey };
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await idempotencyRepo.complete(scope, fingerprint, created, expiresAt);
      }

      return created;
    });
  }

  public async cancelRequest(ctx: RequestContext, requestId: string): Promise<ShopMallRequest> {
    if (!requestId || !UUID_REGEX.test(requestId.trim())) {
      throw new ValidationFailedError('Invalid request_id format');
    }
    const cleanRequestId = requestId.trim();

    return await this.withTx(async (trx) => {
      const existing = await this.repo.findByIdForUpdate(trx, cleanRequestId);
      if (!existing) {
        throw new NotFoundError('Mall request was not found');
      }
      if (existing.seller_id !== ctx.user_id) {
        throw new ForbiddenError('RESOURCE_FORBIDDEN', 'You do not own this mall request');
      }
      if (existing.status !== 'PENDING') {
        throw new ConflictError('INVALID_STATE_TRANSITION', 'Only PENDING requests can be cancelled');
      }

      return await this.repo.updateStatus(trx, cleanRequestId, {
        status: 'CANCELLED',
        cancelled_at: new Date(),
      });
    });
  }

  public async approveRequest(
    adminId: string,
    requestId: string,
    input: ApproveMallRequestInput,
    idempotencyKey?: string
  ): Promise<ShopMallRequest> {
    if (!adminId || !UUID_REGEX.test(adminId.trim())) {
      throw new ValidationFailedError('Invalid adminId format');
    }
    if (!requestId || !UUID_REGEX.test(requestId.trim())) {
      throw new ValidationFailedError('Invalid requestId format');
    }
    const cleanNote = input.note?.trim();
    if (!cleanNote || cleanNote.length < 5 || cleanNote.length > 500) {
      throw new ReasonRequiredError('Approval note is required and must be between 5 and 500 characters');
    }

    const cleanRequestId = requestId.trim();
    const cleanAdminId = adminId.trim();

    return await this.withTx(async (trx) => {
      let claim: TransactionalIdempotencyClaim<ShopMallRequest> | undefined;
      let idempotencyRepo: PgIdempotencyRepository | undefined;
      let fingerprint = '';

      if (idempotencyKey) {
        idempotencyRepo = new PgIdempotencyRepository(trx);
        fingerprint = createHash('sha256')
          .update(JSON.stringify({ requestId: cleanRequestId, note: cleanNote }))
          .digest('hex');
        const scope = { user_id: cleanAdminId, endpoint: `/api/v1/admin/shops/mall-requests/${cleanRequestId}/approve`, key: idempotencyKey };
        claim = await idempotencyRepo.claim<ShopMallRequest>(scope, fingerprint);

        if (claim.kind === 'replay') return claim.result;
        if (claim.kind === 'conflict') {
          throw new ConflictError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 'Idempotency key reused with different payload');
        }
        if (claim.kind === 'in_progress') {
          throw new ConflictError('OPERATION_IN_PROGRESS', 'Concurrent operation in progress for this key');
        }
      }

      // 1. Fetch request without lock to get shop_id
      const precheck = await this.repo.findByIdForUpdate(trx, cleanRequestId);
      if (!precheck) {
        throw new NotFoundError('Mall request was not found');
      }

      // 2. Lock SHOPS first (Deadlock Prevention: shops -> shop_mall_requests)
      const shop = await this.repo.findShopForUpdate(trx, precheck.shop_id);
      if (!shop) {
        throw new NotFoundError('Associated shop was not found');
      }
      if (shop.status !== 'ACTIVE') {
        throw new ConflictError('SHOP_NOT_ACTIVE', 'Cannot approve Mall tier for inactive or locked shop');
      }
      if (shop.tier === 'MALL') {
        throw new ConflictError('SHOP_ALREADY_MALL', 'Shop already has MALL tier');
      }
      if (shop.owner_id !== precheck.seller_id) {
        throw new ConflictError('SHOP_OWNER_CHANGED', 'Shop ownership has changed since request submission');
      }

      // 3. Re-verify Request is still PENDING
      if (precheck.status !== 'PENDING') {
        throw new ConflictError('REQUEST_ALREADY_RESOLVED', 'Request is not in PENDING state');
      }

      // 4. Update request status to APPROVED
      const approvedRequest = await this.repo.updateStatus(trx, cleanRequestId, {
        status: 'APPROVED',
        admin_id: cleanAdminId,
        admin_note: cleanNote,
        reviewed_at: new Date(),
      });

      // 5. Update shop tier to MALL with override
      if (!this.targetRepo.updateShopTier) {
        throw new Error('targetRepo.updateShopTier is not implemented');
      }
      await this.targetRepo.updateShopTier(trx, precheck.shop_id, 'MALL', cleanNote, cleanAdminId);

      // 6. Record moderation record
      if (!this.targetRepo.insertModerationRecord) {
        throw new Error('targetRepo.insertModerationRecord is not implemented');
      }
      await this.targetRepo.insertModerationRecord(trx, {
        moderation_id: randomUUID(),
        target_type: 'SHOP',
        target_id: precheck.shop_id,
        reason: cleanNote,
        action: 'UPDATE_TIER',
        admin_id: cleanAdminId,
      });

      // 7. Record admin audit log
      try {
        await this.auditPort.logAdminAction(trx, {
          admin_id: cleanAdminId,
          action: 'SHOP_MALL_REQUEST_APPROVE',
          target_type: 'SHOP',
          target_id: precheck.shop_id,
          reason: `[TIER: ${shop.tier} -> MALL] ${cleanNote}`,
        });
      } catch (auditErr) {
        throw new AuditWriteFailedError('Failed to write audit log for mall approval', auditErr);
      }

      if (idempotencyRepo && idempotencyKey) {
        const scope = { user_id: cleanAdminId, endpoint: `/api/v1/admin/shops/mall-requests/${cleanRequestId}/approve`, key: idempotencyKey };
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await idempotencyRepo.complete(scope, fingerprint, approvedRequest, expiresAt);
      }

      return approvedRequest;
    });
  }

  public async rejectRequest(
    adminId: string,
    requestId: string,
    input: RejectMallRequestInput,
    idempotencyKey?: string
  ): Promise<ShopMallRequest> {
    if (!adminId || !UUID_REGEX.test(adminId.trim())) {
      throw new ValidationFailedError('Invalid adminId format');
    }
    if (!requestId || !UUID_REGEX.test(requestId.trim())) {
      throw new ValidationFailedError('Invalid requestId format');
    }
    const cleanReason = input.reason?.trim();
    if (!cleanReason || cleanReason.length < 5 || cleanReason.length > 500) {
      throw new ReasonRequiredError('Rejection reason is required and must be between 5 and 500 characters');
    }

    const cleanRequestId = requestId.trim();
    const cleanAdminId = adminId.trim();

    return await this.withTx(async (trx) => {
      let claim: TransactionalIdempotencyClaim<ShopMallRequest> | undefined;
      let idempotencyRepo: PgIdempotencyRepository | undefined;
      let fingerprint = '';

      if (idempotencyKey) {
        idempotencyRepo = new PgIdempotencyRepository(trx);
        fingerprint = createHash('sha256')
          .update(JSON.stringify({ requestId: cleanRequestId, reason: cleanReason }))
          .digest('hex');
        const scope = { user_id: cleanAdminId, endpoint: `/api/v1/admin/shops/mall-requests/${cleanRequestId}/reject`, key: idempotencyKey };
        claim = await idempotencyRepo.claim<ShopMallRequest>(scope, fingerprint);

        if (claim.kind === 'replay') return claim.result;
        if (claim.kind === 'conflict') {
          throw new ConflictError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 'Idempotency key reused with different payload');
        }
        if (claim.kind === 'in_progress') {
          throw new ConflictError('OPERATION_IN_PROGRESS', 'Concurrent operation in progress for this key');
        }
      }

      const existing = await this.repo.findByIdForUpdate(trx, cleanRequestId);
      if (!existing) {
        throw new NotFoundError('Mall request was not found');
      }
      if (existing.status !== 'PENDING') {
        throw new ConflictError('REQUEST_ALREADY_RESOLVED', 'Request is not in PENDING state');
      }

      const rejectedRequest = await this.repo.updateStatus(trx, cleanRequestId, {
        status: 'REJECTED',
        admin_id: cleanAdminId,
        admin_note: cleanReason,
        reviewed_at: new Date(),
      });

      // Audit rejection
      try {
        await this.auditPort.logAdminAction(trx, {
          admin_id: cleanAdminId,
          action: 'SHOP_MALL_REQUEST_REJECT',
          target_type: 'SHOP',
          target_id: existing.shop_id,
          reason: cleanReason,
        });
      } catch (auditErr) {
        throw new AuditWriteFailedError('Failed to write audit log for mall rejection', auditErr);
      }

      if (idempotencyRepo && idempotencyKey) {
        const scope = { user_id: cleanAdminId, endpoint: `/api/v1/admin/shops/mall-requests/${cleanRequestId}/reject`, key: idempotencyKey };
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await idempotencyRepo.complete(scope, fingerprint, rejectedRequest, expiresAt);
      }

      return rejectedRequest;
    });
  }

  public async listSellerRequests(
    ctx: RequestContext,
    query: { limit?: number; cursor?: string }
  ): Promise<{ items: ShopMallRequest[]; next_cursor: string | null; has_more: boolean }> {
    if (!ctx.shop_id) {
      throw new ValidationFailedError('User has no shop associated');
    }
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    return await this.repo.listByShop(ctx.shop_id, limit, query.cursor);
  }

  public async listAdminRequests(
    query: ListMallRequestsQuery
  ): Promise<{ items: ShopMallRequestListItem[]; next_cursor: string | null; has_more: boolean }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    return await this.repo.listForAdmin({
      status: query.status,
      limit,
      cursor: query.cursor,
    });
  }

  private async withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await fn(client);
      await client.query('COMMIT');
      return res;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
