import { QueryClient } from "@tanstack/react-query";

/**
 * Cấu hình mặc định cho QueryClient của hệ thống
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000, // 2 phút: dữ liệu còn mới, chuyển trang không cần fetch lại
        gcTime: 10 * 60 * 1000,    // 10 phút: lưu giữ trong RAM trình duyệt
        refetchOnWindowFocus: false, // Tắt tự động refetch khi click qua lại các tab trình duyệt
        retry: 1,                  // Tự thử lại 1 lần nếu lỗi mạng
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Trả về QueryClient duy nhất ở phía browser để giữ cache xuyên suốt các trang
 */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}

/**
 * Xóa sạch toàn bộ cache trong RAM (gọi khi đăng xuất tài khoản)
 */
export function clearAppQueryCache(): void {
  if (browserQueryClient) {
    browserQueryClient.clear();
  }
}
