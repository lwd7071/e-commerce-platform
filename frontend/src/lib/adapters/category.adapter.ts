import { features } from "../config/features";

/**
 * CategoryAdapter - Safe category retrieval and tree representation.
 * Complies with RB-KN04 (max 2 levels hierarchy), GAP-05, and A-700/B-305.
 * Shared interface for public catalog and admin moderation.
 */

export interface WireCategoryItem {
  category_id: string;
  parent_category_id: string | null;
  category_name: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at?: string;
  updated_at?: string;
}

export interface CategoryItem {
  id: string;
  parentId: string | null;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export interface CategoryTreeNode extends CategoryItem {
  children: CategoryItem[];
}

export interface ICategoryAdapter {
  getCategories(): Promise<CategoryItem[]>;
  getCategoryTree(): Promise<CategoryTreeNode[]>;
  getCategoryById(id: string): Promise<CategoryItem | null>;
  isValidCategory(id: string | null | undefined): Promise<boolean>;
}

/**
 * Development category fixtures for mock and UI testing.
 * Note: Under GAP-05, backend does not have public categories API or seed in DB.
 * Therefore, in live mode without verified DB categories, the adapter safely returns []
 * to hide the filter and prevent sending invalid UUIDs that would yield empty product lists.
 */
export const DEV_CATEGORY_FIXTURES: CategoryItem[] = [
  // Cấp 1: Danh mục gốc (Roots - level 1)
  {
    id: "00000000-0000-0000-0000-000000000010",
    parentId: null,
    name: "Mỹ phẩm & Chăm sóc sắc đẹp",
    description: "Sản phẩm chăm sóc da và làm đẹp chính hãng",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000011",
    parentId: null,
    name: "Thời trang & Phụ kiện",
    description: "Quần áo, giày dép thời trang",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    parentId: null,
    name: "Thiết bị điện tử",
    description: "Điện thoại, bàn phím và phụ kiện công nghệ",
    status: "ACTIVE",
  },
  // Cấp 2: Danh mục con (Children - level 2 theo RB-KN04)
  {
    id: "00000000-0000-0000-0000-000000000110",
    parentId: "00000000-0000-0000-0000-000000000010",
    name: "Chăm sóc da mặt & Serum",
    description: "Serum, kem dưỡng, mặt nạ chuyên sâu",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000111",
    parentId: "00000000-0000-0000-0000-000000000011",
    name: "Áo sơ mi & Áo thun nam",
    description: "Trang phục nam cao cấp",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000112",
    parentId: "00000000-0000-0000-0000-000000000012",
    name: "Phụ kiện máy tính & Bàn phím",
    description: "Bàn phím cơ, chuột và tai nghe",
    status: "ACTIVE",
  },
];

export class CategoryAdapterImpl implements ICategoryAdapter {
  private mockFixtures: CategoryItem[];
  private forceMock: boolean | null;

  constructor(initialData: CategoryItem[] = DEV_CATEGORY_FIXTURES, forceMock: boolean | null = null) {
    this.mockFixtures = initialData;
    this.forceMock = forceMock;
  }

  private isMockMode(): boolean {
    if (this.forceMock !== null) {
      return this.forceMock;
    }
    return features.useMock();
  }

  async getCategories(): Promise<CategoryItem[]> {
    // GAP-05: In live mode, backend has no GET /categories route yet and DB seed is unverified.
    // If not in mock mode, return empty list so UI safely hides the filter chips.
    if (!this.isMockMode()) {
      return [];
    }

    // In mock mode, return active mock categories
    return this.mockFixtures.filter((cat) => cat.status === "ACTIVE");
  }

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const active = await this.getCategories();
    const rootNodes = active.filter((cat) => !cat.parentId);

    return rootNodes.map((root) => {
      const children = active.filter((cat) => cat.parentId === root.id);
      return {
        ...root,
        children,
      };
    });
  }

  async getCategoryById(id: string): Promise<CategoryItem | null> {
    if (!this.isMockMode()) {
      return null;
    }
    const found = this.mockFixtures.find((c) => c.id === id);
    return found ? { ...found } : null;
  }

  async isValidCategory(id: string | null | undefined): Promise<boolean> {
    if (!id) return false;
    const cat = await this.getCategoryById(id);
    return cat !== null && cat.status === "ACTIVE";
  }
}

export const categoryAdapter = new CategoryAdapterImpl();
