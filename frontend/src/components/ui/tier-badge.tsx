export type ShopTier = 'STANDARD' | 'PREFERRED' | 'MALL';

export function TierBadge({ tier }: { tier?: ShopTier | string | null }) {
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

  return null;
}
