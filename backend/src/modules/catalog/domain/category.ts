import type { Category, UUID, CategoryStatus } from './types.ts';
import { ValidationError } from './errors.ts';

export class CategoryEntity implements Category {
  public readonly categoryId: UUID;
  public readonly parentCategoryId: UUID | null;
  public categoryName: string;
  public description: string | null;
  public status: CategoryStatus;
  public readonly createdAt: string;
  public updatedAt: string;

  constructor(params: {
    categoryId: UUID;
    parentCategoryId: UUID | null;
    categoryName: string;
    description: string | null;
    status: CategoryStatus;
    createdAt: string;
    updatedAt: string;
    parentDepth?: number; // Cấp độ sâu của danh mục cha (nếu có)
  }) {
    // RB-KN04 & Schema Freeze: Cây danh mục tối đa 2 cấp
    if (params.parentDepth !== undefined && params.parentDepth >= 2) {
      throw new ValidationError(
        'Cây danh mục chỉ cho phép tối đa 2 cấp (RB-KN04, Schema Freeze). Danh mục cha đã là cấp 2 nên không thể tạo thêm cấp con.',
        { parentCategoryId: params.parentCategoryId, parentDepth: params.parentDepth }
      );
    }

    this.categoryId = params.categoryId;
    this.parentCategoryId = params.parentCategoryId;
    this.categoryName = params.categoryName;
    this.description = params.description;
    this.status = params.status;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}
