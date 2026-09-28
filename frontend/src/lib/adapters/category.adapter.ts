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
 * Verified category fixture from dev environment seed / domain tests.
 * GAP-05 requirement: Do NOT invent fake random UUIDs. Only use verified IDs or leave empty.
 */
export const VERIFIED_CATEGORY_FIXTURES: CategoryItem[] = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    parentId: null,
    name: "Mỹ phẩm & Chăm sóc sắc đẹp",
    description: "Sản phẩm chăm sóc da và làm đẹp chính hãng",
    status: "ACTIVE",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    parentId: null,
    name: "Thiết bị điện tử & Phụ kiện",
    description: "Điện thoại, tai nghe và phụ kiện công nghệ",
    status: "ACTIVE",
  },
  {
    id: "55555555-5555-4555-8555-555555555556",
    parentId: "55555555-5555-4555-8555-555555555555",
    name: "Phụ kiện điện thoại",
    description: "Cáp sạc, ốp lưng, tai nghe",
    status: "ACTIVE",
  },
];

class CategoryAdapterImpl implements ICategoryAdapter {
  private categories: CategoryItem[];

  constructor(initialData: CategoryItem[] = VERIFIED_CATEGORY_FIXTURES) {
    this.categories = initialData;
  }

  async getCategories(): Promise<CategoryItem[]> {
    // Only return ACTIVE categories for public catalog display
    return this.categories.filter((cat) => cat.status === "ACTIVE");
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
    const found = this.categories.find((c) => c.id === id);
    return found ? { ...found } : null;
  }

  async isValidCategory(id: string | null | undefined): Promise<boolean> {
    if (!id) return false;
    const cat = await this.getCategoryById(id);
    return cat !== null && cat.status === "ACTIVE";
  }
}

export const categoryAdapter = new CategoryAdapterImpl();
