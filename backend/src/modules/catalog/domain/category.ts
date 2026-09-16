import type { Category, UUID, CategoryStatus } from './types';
import { ValidationError } from './errors';

export class CategoryEntity implements Category {
  public readonly categoryId: UUID;
  public parentCategoryId: UUID | null;
  public categoryName: string;
  public description: string | null;
  public status: CategoryStatus;
  public depth: number;
  public readonly createdAt: string;
  public updatedAt: string;

  constructor(params: {
    categoryId: UUID;
    parentCategoryId: UUID | null;
    categoryName: string;
    description: string | null;
    status: CategoryStatus;
    depth?: number;
    createdAt: string;
    updatedAt: string;
  }) {
    const calculatedDepth = params.depth ?? (params.parentCategoryId === null ? 1 : 2);
    
    // RB-KN04 & Schema Freeze: Cây danh mục hỗ trợ tối đa 2 cấp trong MVP
    if (calculatedDepth > 2) {
      throw new ValidationError('Cây danh mục sản phẩm chỉ hỗ trợ tối đa 2 cấp trong MVP (RB-KN04).', {
        depth: calculatedDepth,
      });
    }

    this.categoryId = params.categoryId;
    this.parentCategoryId = params.parentCategoryId;
    this.categoryName = params.categoryName;
    this.description = params.description;
    this.status = params.status;
    this.depth = calculatedDepth;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}
