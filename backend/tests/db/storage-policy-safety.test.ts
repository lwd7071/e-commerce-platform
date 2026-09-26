import { describe, expect, it } from 'vitest';
import { assertStoragePolicyDeploymentAllowed } from '../../db/storage-policy-safety.js';

describe('storage policy deployment safety', () => {
  it('requires a test target, human project ref and explicit confirmation', () => {
    expect(() => assertStoragePolicyDeploymentAllowed({}, 'demo123')).toThrow('DATABASE_ENVIRONMENT=test');
    expect(() => assertStoragePolicyDeploymentAllowed({ databaseEnvironment: 'test' }, 'demo123'))
      .toThrow('human-supplied project ref');
    expect(() => assertStoragePolicyDeploymentAllowed({
      databaseEnvironment: 'test', configuredProjectRef: 'demo123',
    }, 'demo123')).toThrow('ALLOW_STORAGE_POLICY_DEPLOY=true');
  });

  it('rejects a mismatched target and accepts a confirmed matching test project', () => {
    expect(() => assertStoragePolicyDeploymentAllowed({
      databaseEnvironment: 'test', expectedProjectRef: 'expected', allowStoragePolicyDeploy: 'true',
    }, 'actual')).toThrow('does not match');
    expect(() => assertStoragePolicyDeploymentAllowed({
      databaseEnvironment: 'test', expectedProjectRef: 'demo123', allowStoragePolicyDeploy: 'true',
    }, 'demo123')).not.toThrow();
  });
});
