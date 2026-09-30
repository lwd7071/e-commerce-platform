import { envConfig } from "./env";

/**
 * Feature Flags Management (C-003)
 */
export const features = {
  /**
   * Global toggle for mock repositories.
   * If true, domain repositories return fixture data instead of calling live backend.
   */
  useMock: (): boolean => {
    return envConfig.useMock;
  },

  /**
   * Debug logging enabled check.
   */
  isDebugEnabled: (): boolean => {
    return envConfig.debugLogs;
  },

  /**
   * Domain-level mock overrides.
   */
  domains: {
    catalogLive: (): boolean => !envConfig.useMock,
    cartMock: (): boolean => Boolean(envConfig.useMock),
    checkoutMock: (): boolean => Boolean(envConfig.useMock),
    ordersMock: (): boolean => Boolean(envConfig.useMock),
    adminMock: (): boolean => Boolean(envConfig.useMock),
  },
};
