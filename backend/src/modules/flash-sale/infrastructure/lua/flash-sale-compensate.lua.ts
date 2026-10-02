/**
 * Lua Script: Compensate Flash Sale stock and voucher quota safely (Whitelist guard)
 *
 * KEYS[1]: flash_sale:stock:<slot_id>:<item_id>
 * KEYS[2]: flash_sale:buyers:<slot_id>:<item_id>
 * KEYS[3]: voucher:quota:<slot_id>:<voucher_code>
 * KEYS[4]: voucher:used_users:<slot_id>:<voucher_code>
 * KEYS[5]: flash_sale:pending_reservations (ZSet)
 * KEYS[6]: flash_sale:lease:<idemp_key>
 *
 * ARGV[1]: user_id
 * ARGV[2]: voucher_code ("NONE" if not applied)
 * ARGV[3]: reservation_payload (JSON string member to ZREM)
 *
 * Returns:
 *   1 => Compensation applied successfully
 *   0 => Skipped (lease is not HOLD, e.g. COMMITTED or already RECLAIMED)
 */
export const FLASH_SALE_COMPENSATE_LUA = `
local lease = redis.call('GET', KEYS[6])
if lease ~= "HOLD" then
    redis.call('ZREM', KEYS[5], ARGV[3])
    return 0
end

redis.call('SET', KEYS[6], "RECLAIMED", "EX", 86400)
redis.call('ZREM', KEYS[5], ARGV[3])

if redis.call('EXISTS', KEYS[1]) == 1 then
    redis.call('INCR', KEYS[1])
    redis.call('SREM', KEYS[2], ARGV[1])
end

if ARGV[2] ~= "NONE" then
    if redis.call('EXISTS', KEYS[3]) == 1 then
        redis.call('INCR', KEYS[3])
        redis.call('SREM', KEYS[4], ARGV[1])
    end
end

return 1
`;
