/**
 * Lua Script: Deduct Flash Sale stock & reserve voucher quota atomically
 *
 * KEYS[1]: flash_sale:stock:<slot_id>:<item_id>
 * KEYS[2]: flash_sale:buyers:<slot_id>:<item_id>
 * KEYS[3]: voucher:quota:<slot_id>:<voucher_code>
 * KEYS[4]: voucher:used_users:<slot_id>:<voucher_code>
 * KEYS[5]: flash_sale:slot_status:<slot_id>
 * KEYS[6]: flash_sale:pending_reservations (ZSet)
 * KEYS[7]: flash_sale:lease:<idemp_key>
 *
 * ARGV[1]: user_id
 * ARGV[2]: voucher_code ("NONE" if not applied)
 * ARGV[3]: timestamp_now (epoch ms string/number)
 * ARGV[4]: reservation_payload (JSON string)
 *
 * Returns:
 *   1  => SUCCESS
 *   0  => PRODUCT_OUT_OF_STOCK
 *  -1  => SLOT_NOT_ACTIVE
 *  -2  => USER_PURCHASE_LIMIT_EXCEEDED
 *  -3  => VOUCHER_ALREADY_USED_BY_USER
 *  -4  => VOUCHER_OUT_OF_STOCK
 */
export const FLASH_SALE_DEDUCT_LUA = `
local slot_status = redis.call('GET', KEYS[5])
if slot_status ~= "ACTIVE" then
    return -1
end

if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then
    return -2
end

if ARGV[2] ~= "NONE" then
    if redis.call('SISMEMBER', KEYS[4], ARGV[1]) == 1 then
        return -3
    end
    local v_quota = tonumber(redis.call('GET', KEYS[3]))
    if not v_quota or v_quota <= 0 then
        return -4
    end
end

local stock = tonumber(redis.call('GET', KEYS[1]))
if not stock or stock <= 0 then
    return 0
end

redis.call('DECR', KEYS[1])
redis.call('SADD', KEYS[2], ARGV[1])

if ARGV[2] ~= "NONE" then
    redis.call('DECR', KEYS[3])
    redis.call('SADD', KEYS[4], ARGV[1])
end

redis.call('ZADD', KEYS[6], tonumber(ARGV[3]), ARGV[4])
redis.call('SET', KEYS[7], "HOLD", "EX", 600)

return 1
`;
