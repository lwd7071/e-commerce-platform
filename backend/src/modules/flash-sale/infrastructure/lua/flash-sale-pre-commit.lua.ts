/**
 * Lua Script: Pre-Commit Handshake (HOLD -> COMMITTING)
 *
 * KEYS[1]: flash_sale:lease:<idemp_key>
 * ARGV[1]: current_timestamp (epoch ms)
 *
 * Returns:
 *   1 => Lease transitioned HOLD -> COMMITTING:<timestamp>
 *   0 => Lease is not HOLD (already RECLAIMED by Watchdog -> forbid commit)
 */
export const FLASH_SALE_PRE_COMMIT_LUA = `
local current = redis.call('GET', KEYS[1])
if current == "HOLD" then
    redis.call('SET', KEYS[1], "COMMITTING:" .. ARGV[1], "EX", 86400)
    return 1
else
    return 0
end
`;
