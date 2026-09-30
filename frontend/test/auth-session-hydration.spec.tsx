// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '@/lib/auth/auth-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSupabaseClient = vi.hoisted(() => vi.fn());
const mockApiGet = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/supabase-client', () => ({ getSupabaseClient: mockGetSupabaseClient }));
vi.mock('@/lib/api/client', () => ({
  apiClient: { get: mockApiGet },
  setAuthTokenProvider: vi.fn(),
}));

function AuthStateProbe() {
  const { isLoading, user } = useAuth();
  return <output>{isLoading ? 'loading' : user ? 'signed-in' : 'signed-out'}</output>;
}

describe('AuthProvider initial session hydration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not treat INITIAL_SESSION null as signed out before getSession finishes', async () => {
    let resolveSession!: (result: { data: { session: null } }) => void;
    let onAuthStateChange!: (event: string, session: null) => void;
    const sessionRequest = new Promise<{ data: { session: null } }>((resolve) => { resolveSession = resolve; });
    mockGetSupabaseClient.mockReturnValue({ auth: {
      getSession: vi.fn(() => sessionRequest),
      onAuthStateChange: vi.fn((callback: typeof onAuthStateChange) => {
        onAuthStateChange = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    } });

    render(<AuthProvider><AuthStateProbe /></AuthProvider>);
    await waitFor(() => expect(onAuthStateChange).toBeTypeOf('function'));
    act(() => onAuthStateChange('INITIAL_SESSION', null));

    expect(screen.getByText('loading')).toBeTruthy();
    await act(async () => { resolveSession({ data: { session: null } }); await sessionRequest; });
    expect(screen.getByText('signed-out')).toBeTruthy();
  });

  it('keeps route protection loading until a signed-in session is synced with the API', async () => {
    let resolveSession!: (result: { data: { session: null } }) => void;
    let resolveIdentity!: (identity: { user_id: string; email: string; role: 'BUYER'; shop_id: null }) => void;
    let onAuthStateChange!: (event: string, session: { access_token: string; user: { id: string; email: string } } | null) => void;
    const sessionRequest = new Promise<{ data: { session: null } }>((resolve) => { resolveSession = resolve; });
    const identityRequest = new Promise<{ user_id: string; email: string; role: 'BUYER'; shop_id: null }>((resolve) => { resolveIdentity = resolve; });
    const session = { access_token: 'test-access-token', user: { id: 'buyer-1', email: 'buyer@test.local' } };
    mockApiGet.mockReturnValue(identityRequest);
    mockGetSupabaseClient.mockReturnValue({ auth: {
      getSession: vi.fn(() => sessionRequest),
      onAuthStateChange: vi.fn((callback: typeof onAuthStateChange) => {
        onAuthStateChange = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    } });

    render(<AuthProvider><AuthStateProbe /></AuthProvider>);
    await waitFor(() => expect(onAuthStateChange).toBeTypeOf('function'));
    act(() => onAuthStateChange('SIGNED_IN', session));
    expect(screen.getByText('loading')).toBeTruthy();

    await act(async () => { resolveIdentity({ user_id: 'buyer-1', email: 'buyer@test.local', role: 'BUYER', shop_id: null }); await identityRequest; });
    expect(screen.getByText('signed-in')).toBeTruthy();
    await act(async () => { resolveSession({ data: { session: null } }); await sessionRequest; });
  });
});
