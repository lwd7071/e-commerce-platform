export type UserRole = "BUYER" | "SELLER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string | null;
  shopId?: string | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: UserRole, fullName?: string, shopName?: string) => Promise<void>;
  loginWithGoogle: (returnTo?: string) => Promise<void>;
  verifySignupOtp: (email: string, token: string) => Promise<void>;
  resendSignupOtp: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeOnboarding: (fullName: string, role: UserRole, shopName?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}
