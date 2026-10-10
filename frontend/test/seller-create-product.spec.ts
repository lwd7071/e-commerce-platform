import { describe, it, expect } from "vitest";
import { validateProductCreationInput } from "../src/features/seller/seller-product-validator";

describe("Seller Product Creation Validation (Người 3 - TDD)", () => {
  const validProduct = {
    name: "Tai nghe Bluetooth Chống Ồn Dino Pro",
    description: "Tai nghe không dây pin trâu 40h",
    category_id: "00000000-0000-0000-0000-000000000010",
    images: ["https://images.unsplash.com/photo-1?w=400"],
    variants: [
      {
        variant_name: "Màu sắc",
        variant_value: "Đen Nhám",
        price: 590000,
        stock_quantity: 50,
      },
    ],
  };

  it("chấp nhận dữ liệu sản phẩm đầy đủ và hợp lệ", () => {
    const res = validateProductCreationInput(validProduct);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual({});
  });

  it("chặn khi thiếu tên sản phẩm hoặc tên quá ngắn", () => {
    const res = validateProductCreationInput({ ...validProduct, name: "  " });
    expect(res.valid).toBe(false);
    expect(res.errors.name).toContain("Tên sản phẩm");
  });

  it("chặn khi chưa chọn danh mục sản phẩm", () => {
    const res = validateProductCreationInput({ ...validProduct, category_id: "" });
    expect(res.valid).toBe(false);
    expect(res.errors.category_id).toContain("danh mục");
  });

  it("chặn khi không có biến thể SKU nào", () => {
    const res = validateProductCreationInput({ ...validProduct, variants: [] });
    expect(res.valid).toBe(false);
    expect(res.errors.variants).toContain("ít nhất 1");
  });

  it("chặn khi giá bán biến thể nhỏ hơn hoặc bằng 0", () => {
    const res = validateProductCreationInput({
      ...validProduct,
      variants: [
        {
          variant_name: "Tiêu chuẩn",
          variant_value: "Mặc định",
          price: 0,
          stock_quantity: 10,
        },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors["variants_0_price"]).toContain("lớn hơn 0");
  });

  it("chặn khi tồn kho là số thập phân hoặc số âm", () => {
    const res = validateProductCreationInput({
      ...validProduct,
      variants: [
        {
          variant_name: "Tiêu chuẩn",
          variant_value: "Mặc định",
          price: 100000,
          stock_quantity: 1.5,
        },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors["variants_0_stock"]).toContain("số nguyên");
  });

  it("chặn khi số lượng ảnh sản phẩm vượt quá 5 ảnh (B-202)", () => {
    const res = validateProductCreationInput({
      ...validProduct,
      images: [
        "img1.png",
        "img2.png",
        "img3.png",
        "img4.png",
        "img5.png",
        "img6.png",
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.images).toContain("tối đa 5");
  });
});
