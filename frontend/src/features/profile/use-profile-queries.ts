import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buyerApi } from "@/lib/api/buyer.api";
import { queryKeys } from "@/lib/query/query-keys";
import type { UserRole } from "@/lib/auth/types";
import { profileFailureState, type ProfileRequestState } from "./profile-request-state";

/**
 * Hook quản lý song song cache Profile, Loyalty và LoyaltyHistory.
 * Tuân thủ quy tắc Deep Module: đóng gói toàn bộ logic truy vấn, đồng bộ và mutation.
 */
export function useProfileDashboard({
  userId,
  userEmail,
  userRole,
  authLoading,
}: {
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
  authLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const isEnabled = !authLoading && Boolean(userId && userEmail && userRole);
  const isBuyer = userRole === "BUYER";
  const scopedUserId = userId ?? "";

  const profileQuery = useQuery({
    queryKey: queryKeys.profile.details(scopedUserId),
    queryFn: () => buyerApi.getProfile(),
    enabled: isEnabled,
  });

  const loyaltyQuery = useQuery({
    queryKey: queryKeys.profile.loyalty(scopedUserId),
    queryFn: () => buyerApi.getLoyalty().catch(() => null),
    enabled: isEnabled && isBuyer && typeof buyerApi.getLoyalty === "function",
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.profile.loyaltyHistory(scopedUserId, { page: 1, limit: 10 }),
    queryFn: () => buyerApi.getLoyaltyHistory({ page: 1, limit: 10 }).catch(() => null),
    enabled: isEnabled && isBuyer && typeof buyerApi.getLoyaltyHistory === "function",
  });

  const updateProfileMutation = useMutation({
    mutationFn: (payload: { fullName?: string; phone?: string }) => buyerApi.updateProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.profile.details(scopedUserId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.details(scopedUserId) });
    },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: (mediaId: string) => buyerApi.updateAvatar(mediaId),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.profile.details(scopedUserId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.details(scopedUserId) });
    },
  });

  let requestState: ProfileRequestState;

  if (profileQuery.isLoading) {
    requestState = { status: "loading" };
  } else if (profileQuery.isError && !profileQuery.data) {
    requestState = profileFailureState(profileQuery.error);
  } else if (profileQuery.data) {
    const value = profileQuery.data;
    if (
      (value.full_name !== null && typeof value.full_name !== "string") ||
      (value.phone !== null && typeof value.phone !== "string")
    ) {
      requestState = profileFailureState(new Error("Phản hồi hồ sơ không hợp lệ. Vui lòng thử lại."));
    } else {
      requestState = {
        status: "ready",
        profile: {
          userId: scopedUserId,
          email: userEmail!,
          role: userRole!,
          fullName: value.full_name,
          phone: value.phone,
          avatarUrl: value.avatar_url,
          loyalty: loyaltyQuery.data ?? null,
          loyaltyHistory: historyQuery.data ?? null,
        },
      };
    }
  } else {
    requestState = { status: "loading" };
  }

  const retry = () => {
    profileQuery.refetch();
    if (isBuyer) {
      loyaltyQuery.refetch();
      historyQuery.refetch();
    }
  };

  return {
    requestState,
    profileQuery,
    loyaltyQuery,
    historyQuery,
    updateProfileMutation,
    updateAvatarMutation,
    retry,
  };
}
