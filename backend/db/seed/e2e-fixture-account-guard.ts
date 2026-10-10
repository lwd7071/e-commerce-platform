export type ExistingE2EAuthAccount = {
  id: string;
  email: string;
  userMetadata: unknown;
};

/** Refuse to take over real Auth accounts that happen to use fixture emails. */
export function assertE2EFixtureAccountsSafe(
  fixtureEmails: readonly string[],
  existingAccounts: readonly ExistingE2EAuthAccount[],
): void {
  const fixtureEmailSet = new Set(fixtureEmails.map((email) => email.trim().toLowerCase()));
  for (const account of existingAccounts) {
    if (!fixtureEmailSet.has(account.email.trim().toLowerCase())) continue;
    const metadata = account.userMetadata;
    const isFixture = typeof metadata === 'object'
      && metadata !== null
      && 'e2e_fixture' in metadata
      && metadata.e2e_fixture === true;
    if (!isFixture) {
      throw new Error(`Refusing to modify non-fixture Auth account ${account.email}`);
    }
  }
}
