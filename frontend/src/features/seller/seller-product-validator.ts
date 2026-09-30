export interface ProductVariantInput {
  variant_name: string;
  variant_value: string;
  price: number;
  stock_quantity: number;
}

export interface ProductCreationInput {
  name: string;
  description: string;
  category_id: string;
  images: string[];
  variants: ProductVariantInput[];
}

export interface ProductValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Kiểm tra dữ liệu form tạo sản phẩm mới của Seller
 */
export function validateProductCreationInput(input: ProductCreationInput): ProductValidationResult {
  const errors: Record<string, string> = {};

  if (!input.name || !input.name.trim() || input.name.trim().length < 3) {
    errors.name = "Tên sản phẩm phải có ít nhất 3 ký tự";
  }

  if (!input.category_id || !input.category_id.trim()) {
    errors.category_id = "Vui lòng chọn danh mục cho sản phẩm";
  }

  if (!input.variants || input.variants.length === 0) {
    errors.variants = "Sản phẩm phải có ít nhất 1 phân loại biến thể (SKU)";
  } else {
    input.variants.forEach((v, index) => {
      if (typeof v.price !== "number" || isNaN(v.price) || v.price <= 0) {
        errors[`variants_${index}_price`] = "Giá bán biến thể phải lớn hơn 0₫";
      }

      if (
        typeof v.stock_quantity !== "number" ||
        isNaN(v.stock_quantity) ||
        v.stock_quantity < 0 ||
        !Number.isInteger(v.stock_quantity)
      ) {
        errors[`variants_${index}_stock`] = "Tồn kho phải là số nguyên không âm";
      }
    });
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
