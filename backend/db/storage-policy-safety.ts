export type StoragePolicySafetyEnvironment = {
  databaseEnvironment?: string;
  expectedProjectRef?: string;
  configuredProjectRef?: string;
  allowStoragePolicyDeploy?: string;
};

export function assertStoragePolicyDeploymentAllowed(
  env: StoragePolicySafetyEnvironment,
  actualProjectRef: string,
): void {
  if (env.databaseEnvironment !== 'test') {
    throw new Error('Storage policy deploy requires DATABASE_ENVIRONMENT=test');
  }
  const expected = env.expectedProjectRef?.trim() || env.configuredProjectRef?.trim();
  if (!expected) {
    throw new Error('Storage policy deploy requires a human-supplied project ref');
  }
  if (expected !== actualProjectRef) {
    throw new Error('Storage policy target does not match the human-supplied project ref');
  }
  if (env.allowStoragePolicyDeploy !== 'true') {
    throw new Error('Storage policy deploy requires explicit ALLOW_STORAGE_POLICY_DEPLOY=true confirmation');
  }
}
