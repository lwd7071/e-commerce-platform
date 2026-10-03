import { describe, expect, it } from 'vitest';
import { assertE2EFixtureAccountsSafe } from '../../db/seed/e2e-fixture-account-guard.js';

const fixtureEmails = ['buyer@dino-e2e.test', 'seller@dino-e2e.test'];

describe('assertE2EFixtureAccountsSafe', () => {
  it('allows fixture accounts previously created by the E2E seed', () => {
    expect(() => assertE2EFixtureAccountsSafe(fixtureEmails, [
      { id: 'buyer-id', email: fixtureEmails[0], userMetadata: { e2e_fixture: true } },
    ])).not.toThrow();
  });

  it('rejects an account with a fixture email that is not owned by the E2E seed', () => {
    expect(() => assertE2EFixtureAccountsSafe(fixtureEmails, [
      { id: 'real-user-id', email: fixtureEmails[1], userMetadata: { full_name: 'Real user' } },
    ])).toThrow(/refusing to modify non-fixture auth account/i);
  });

  it('checks every matching account before allowing the seed to write', () => {
    expect(() => assertE2EFixtureAccountsSafe(fixtureEmails, [
      { id: 'fixture-id', email: fixtureEmails[0], userMetadata: { e2e_fixture: true } },
      { id: 'collision-id', email: fixtureEmails[1], userMetadata: {} },
    ])).toThrow(/seller@dino-e2e\.test/);
  });
});
