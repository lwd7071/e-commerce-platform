// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '@/lib/auth/auth-context';
import { useQuery } from '@tanstack/react-query';
import { QueryProvider } from '@/lib/query/query-provider';
import { clearAppQueryCache } from '@/lib/query/query-client';
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
  beforeEach(() => {
    vi.clearAllMocks();
    clearAppQueryCache();
  });

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

  it('clears private query data after sign-out before the same account signs in again', async () => {
    let onAuthStateChange!: (event: string, session: { access_token: string; user: { id: string; email: string } } | null) => void;
    let identityUserId = 'buyer-1';
    mockApiGet.mockImplementation(async () => ({ user_id: identityUserId, email: `${identityUserId}@test.local`, role: 'BUYER', shop_id: null }));
    mockGetSupabaseClient.mockReturnValue({ auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn((callback: typeof onAuthStateChange) => {
        onAuthStateChange = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(async () => {
        onAuthStateChange('SIGNED_OUT', null);
        return { error: null };
      }),
    } });

    let fetchCount = 0;
    function PrivateQueryProbe() {
      const { user, logout } = useAuth();
      const { data } = useQuery({
        queryKey: ['private-probe', user?.id],
        queryFn: async () => `private-${++fetchCount}`,
        enabled: Boolean(user),
      });
      return <><output>{user ? data ?? 'loading-private' : 'signed-out'}</output><button onClick={() => void logout()}>Log out</button></>;
    }

    render(<QueryProvider><AuthProvider><PrivateQueryProbe /></AuthProvider></QueryProvider>);
    await waitFor(() => expect(onAuthStateChange).toBeTypeOf('function'));
    const session = { access_token: 'token-1', user: { id: 'buyer-1', email: 'buyer@test.local' } };

    await act(async () => { onAuthStateChange('SIGNED_IN', session); });
    await waitFor(() => expect(screen.getByText('private-1')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(screen.getByText('signed-out')).toBeTruthy());

    await act(async () => { onAuthStateChange('SIGNED_IN', session); });
    await waitFor(() => expect(screen.getByText('private-2')).toBeTruthy());
    expect(fetchCount).toBe(2);

    identityUserId = 'buyer-2';
    act(() => onAuthStateChange('SIGNED_IN', { access_token: 'token-2', user: { id: 'buyer-2', email: 'buyer-2@test.local' } }));
    expect(screen.getByText('signed-out')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('private-3')).toBeTruthy());
    expect(fetchCount).toBe(3);
  });
});
