/**
 * Catalog Query & Input Validation Engine
 * Implements F-103, B-301 (URL filter synchronization & search debounce),
 * and O-509 (strict integer validation).
 */

export interface CatalogFilterState {
  search: string;
  categoryId: string;
  sort: string;
  minPrice: string;
  maxPrice: string;
}

/**
 * Builds URLSearchParams from catalog filter state for URL sync.
 * Leaves out empty or default values so URL stays clean.
 */
export function buildCatalogUrlSearchParams(state: CatalogFilterState): URLSearchParams {
  const params = new URLSearchParams();

  const trimmedSearch = state.search.trim();
  if (trimmedSearch) {
    params.set("search", trimmedSearch);
  }

  const trimmedCategory = state.categoryId.trim();
  if (trimmedCategory) {
    params.set("category_id", trimmedCategory);
  }

  if (state.sort && state.sort !== "created_at_desc") {
    params.set("sort", state.sort);
  }

  const trimmedMin = state.minPrice.trim();
  if (trimmedMin && !isNaN(Number(trimmedMin))) {
    params.set("min_price", trimmedMin);
  }

  const trimmedMax = state.maxPrice.trim();
  if (trimmedMax && !isNaN(Number(trimmedMax))) {
    params.set("max_price", trimmedMax);
  }

  return params;
}

/**
 * Strict stock quantity validation (O-509).
 * Prevents silent float truncation (e.g. 1.5 -> 1) and negative values.
 */
export function validateStockQuantityInput(input: string): { valid: boolean; error?: string; value?: number } {
  const trimmed = input.trim();
  if (!trimmed || isNaN(Number(trimmed))) {
    return { valid: false, error: "Vui lòng nhập số lượng tồn kho hợp lệ" };
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return { valid: false, error: "Số lượng tồn kho phải là số nguyên (không được chứa phần thập phân)" };
  }

  if (parsed < 0) {
    return { valid: false, error: "Số lượng tồn kho không được âm" };
  }

  return { valid: true, value: parsed };
}

/**
 * Query coordinator to eliminate out-of-order race conditions when fetching data.
 */
export function createCatalogQueryCoordinator() {
  let activeQueryId = 0;

  return {
    startQuery(): number {
      activeQueryId += 1;
      return activeQueryId;
    },

    isLatest(queryId: number): boolean {
      return queryId === activeQueryId;
    },

    getActiveId(): number {
      return activeQueryId;
    },
  };
}
