export type TierType = 'STANDARD' | 'PREFERRED' | 'MALL' | 'VIP';

export function TierBadge({ tier }: { tier?: TierType | string | null }) {
  if (!tier || tier === 'STANDARD') return null;

  if (tier === 'MALL') {
    return (
      <span className="tier-badge tier-badge--mall" aria-label="Mall">
        Mall
      </span>
    );
  }

  if (tier === 'PREFERRED') {
    return (
      <span className="tier-badge tier-badge--preferred" aria-label="Yêu thích">
        Yêu thích
      </span>
    );
  }

  if (tier === 'VIP') {
    return (
      <span className="tier-badge tier-badge--vip" aria-label="Thành viên VIP">
        VIP
      </span>
    );
  }

  return null;
}
