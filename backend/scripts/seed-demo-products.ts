import '../src/platform/config/load-root-env.ts';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { v5 as uuidv5 } from 'uuid';
import { loadDatabaseConfig } from '../db/config.ts';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const config = loadDatabaseConfig(process.env);
const projectRef = config.supabaseUrl.hostname.split('.')[0];
if (process.env.ALLOW_DEMO_PRODUCT_SEED !== 'true') throw new Error('Set ALLOW_DEMO_PRODUCT_SEED=true to seed the demo catalog');
if (process.env.DATABASE_ENVIRONMENT !== 'production') throw new Error('This seed expects the explicitly verified Supabase production project');
if (required('EXPECTED_SUPABASE_PROJECT_REF') !== projectRef || required('SUPABASE_PROJECT_REF') !== projectRef) {
  throw new Error('Expected, configured, and URL-derived Supabase project refs must match');
}

const dataset = 'dino-demo-products-2026-09';
const uuidNamespace = 'cddbd42c-f202-43d6-98ad-7621af276746';
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;
type Template = { category: string; name: string; description: string; price: number; variant: string; image: string };
const templates: Template[] = [
  { category: 'Điện thoại & Phụ kiện', name: 'Tai nghe Bluetooth chống ồn', description: 'Tai nghe không dây pin lâu, âm thanh cân bằng, phù hợp làm việc và di chuyển.', price: 489000, variant: 'Màu sắc', image: img('photo-1498049794561-7780e7231661') },
  { category: 'Điện thoại & Phụ kiện', name: 'Đế sạc không dây đa năng', description: 'Đế sạc gọn nhẹ hỗ trợ sạc nhanh cho thiết bị tương thích.', price: 259000, variant: 'Phiên bản', image: img('photo-1511707171634-5f897ff02aa9') },
  { category: 'Điện thoại & Phụ kiện', name: 'Pin dự phòng dung lượng cao', description: 'Pin dự phòng nhỏ gọn, nhiều cổng sạc, tiện mang theo mỗi ngày.', price: 399000, variant: 'Dung lượng', image: img('photo-1498049794561-7780e7231661') },
  { category: 'Điện thoại & Phụ kiện', name: 'Ốp lưng bảo vệ chống sốc', description: 'Ốp lưng ôm sát thiết bị, hạn chế trầy xước và va đập nhẹ.', price: 129000, variant: 'Màu sắc', image: img('photo-1511707171634-5f897ff02aa9') },
  { category: 'Thời trang nữ', name: 'Áo sơ mi linen dáng rộng', description: 'Chất vải thoáng nhẹ, dễ phối đồ cho đi làm và dạo phố.', price: 329000, variant: 'Kích cỡ', image: img('photo-1529139574466-a303027c1d8b') },
  { category: 'Thời trang nữ', name: 'Đầm midi hoa nhí', description: 'Thiết kế thanh lịch, chất liệu mềm nhẹ, phù hợp nhiều dịp.', price: 459000, variant: 'Kích cỡ', image: img('photo-1483985988355-763728e1935b') },
  { category: 'Thời trang nữ', name: 'Túi đeo chéo tối giản', description: 'Ngăn chứa tiện dụng, kiểu dáng gọn cho các hoạt động hằng ngày.', price: 389000, variant: 'Màu sắc', image: img('photo-1529139574466-a303027c1d8b') },
  { category: 'Thời trang nữ', name: 'Giày sneaker phong cách', description: 'Đế êm, nhẹ chân, phù hợp đi học và đi chơi.', price: 599000, variant: 'Kích cỡ', image: img('photo-1483985988355-763728e1935b') },
  { category: 'Thời trang nam', name: 'Áo polo cotton cao cấp', description: 'Vải cotton thoáng mát, đường may chắc chắn, dễ mặc hằng ngày.', price: 299000, variant: 'Kích cỡ', image: img('photo-1523381210434-271e8be1f52b') },
  { category: 'Thời trang nam', name: 'Quần chino co giãn', description: 'Phom dáng gọn gàng, chất vải co giãn nhẹ và dễ phối.', price: 429000, variant: 'Kích cỡ', image: img('photo-1515886657613-9f3515b0c78f') },
  { category: 'Thời trang nam', name: 'Áo hoodie nỉ mềm', description: 'Áo nỉ ấm áp, thiết kế cơ bản, thích hợp thời tiết se lạnh.', price: 499000, variant: 'Kích cỡ', image: img('photo-1523381210434-271e8be1f52b') },
  { category: 'Thời trang nam', name: 'Ví da gập nhỏ gọn', description: 'Ví nhiều ngăn tiện dụng, kiểu dáng đơn giản và bền đẹp.', price: 349000, variant: 'Màu sắc', image: img('photo-1515886657613-9f3515b0c78f') },
  { category: 'Mỹ phẩm & Chăm sóc da', name: 'Serum cấp ẩm Hyaluronic', description: 'Tinh chất dưỡng ẩm dùng hằng ngày, kết cấu mỏng nhẹ.', price: 279000, variant: 'Dung tích', image: img('photo-1608248543803-ba4f8c70ae0b') },
  { category: 'Mỹ phẩm & Chăm sóc da', name: 'Kem chống nắng phổ rộng', description: 'Kem chống nắng tiện dùng mỗi ngày, không gây cảm giác nặng da.', price: 219000, variant: 'Dung tích', image: img('photo-1608248543803-ba4f8c70ae0b') },
  { category: 'Mỹ phẩm & Chăm sóc da', name: 'Sữa rửa mặt dịu nhẹ', description: 'Làm sạch nhẹ nhàng, phù hợp cho quy trình chăm sóc da cơ bản.', price: 169000, variant: 'Dung tích', image: img('photo-1608248543803-ba4f8c70ae0b') },
  { category: 'Mỹ phẩm & Chăm sóc da', name: 'Kem dưỡng phục hồi da', description: 'Kem dưỡng ẩm dùng sáng và tối, kết cấu dễ tán.', price: 319000, variant: 'Dung tích', image: img('photo-1608248543803-ba4f8c70ae0b') },
  { category: 'Nhà cửa & Đời sống', name: 'Đèn bàn LED điều chỉnh sáng', description: 'Đèn bàn tiết kiệm điện, điều chỉnh góc chiếu linh hoạt.', price: 349000, variant: 'Màu sắc', image: img('photo-1507473885765-e6ed057f782c') },
  { category: 'Nhà cửa & Đời sống', name: 'Chăn sofa dệt mềm', description: 'Chăn phủ sofa mềm mại, tạo điểm nhấn ấm cúng cho căn phòng.', price: 289000, variant: 'Kích cỡ', image: img('photo-1555041469-a586c61ea9bc') },
  { category: 'Nhà cửa & Đời sống', name: 'Kệ lưu trữ đa tầng', description: 'Kệ gọn nhẹ giúp sắp xếp đồ dùng trong nhà ngăn nắp.', price: 699000, variant: 'Số tầng', image: img('photo-1616486338812-3dadae4b4ace') },
  { category: 'Nhà cửa & Đời sống', name: 'Bộ tranh treo tường tối giản', description: 'Bộ tranh trang trí phong cách hiện đại cho không gian sống.', price: 259000, variant: 'Bộ sản phẩm', image: img('photo-1616486338812-3dadae4b4ace') },
  { category: 'Nhà bếp', name: 'Bộ nồi inox đáy từ', description: 'Bộ nồi tiện dụng cho bữa cơm gia đình, dùng được trên bếp từ.', price: 899000, variant: 'Số món', image: img('photo-1556911220-e15b29be8c8f') },
  { category: 'Nhà bếp', name: 'Bình giữ nhiệt thép không gỉ', description: 'Bình giữ nhiệt dễ mang theo khi đi học, làm việc hoặc du lịch.', price: 239000, variant: 'Dung tích', image: img('photo-1602143407151-7111542de6e8') },
  { category: 'Nhà bếp', name: 'Bộ ly thủy tinh chịu nhiệt', description: 'Bộ ly trong suốt dùng cho đồ uống nóng và lạnh.', price: 189000, variant: 'Số lượng', image: img('photo-1514228742587-6b1558fcca3d') },
  { category: 'Nhà bếp', name: 'Thớt gỗ kèm dao bếp', description: 'Bộ sơ chế cơ bản cho căn bếp gia đình, dễ vệ sinh sau sử dụng.', price: 279000, variant: 'Bộ sản phẩm', image: img('photo-1556911220-e15b29be8c8f') },
  { category: 'Thể thao & Dã ngoại', name: 'Thảm yoga chống trượt', description: 'Thảm tập bám sàn tốt, cuộn gọn để cất giữ và mang theo.', price: 329000, variant: 'Độ dày', image: img('photo-1599447292180-45fd84092ef4') },
  { category: 'Thể thao & Dã ngoại', name: 'Bộ dây kháng lực tập luyện', description: 'Bộ dây nhiều mức lực cho các bài tập tại nhà.', price: 199000, variant: 'Mức lực', image: img('photo-1517836357463-d25dfeac3438') },
  { category: 'Thể thao & Dã ngoại', name: 'Lều cắm trại gấp gọn', description: 'Lều du lịch gọn nhẹ, dễ dựng cho chuyến đi cuối tuần.', price: 1299000, variant: 'Sức chứa', image: img('photo-1478131143081-80f7f84ca84d') },
  { category: 'Thể thao & Dã ngoại', name: 'Bình nước thể thao có vạch', description: 'Bình dung tích lớn, có vạch chia giúp theo dõi lượng nước uống.', price: 149000, variant: 'Dung tích', image: img('photo-1523362628745-0c100150b504') },
  { category: 'Sách & Văn phòng phẩm', name: 'Tiểu thuyết truyền cảm hứng', description: 'Một lựa chọn thư giãn và khám phá những câu chuyện mới.', price: 119000, variant: 'Bìa sách', image: img('photo-1544947950-fa07a98d237f') },
  { category: 'Sách & Văn phòng phẩm', name: 'Sổ tay bìa cứng tối giản', description: 'Sổ giấy dày, phù hợp ghi chú, lập kế hoạch và viết nhật ký.', price: 79000, variant: 'Số trang', image: img('photo-1517842645767-c639042777db') },
  { category: 'Sách & Văn phòng phẩm', name: 'Bộ bút gel nhiều màu', description: 'Bộ bút viết trơn, phù hợp ghi chú và học tập.', price: 99000, variant: 'Số lượng', image: img('photo-1455390582262-044cju9c7f5') },
  { category: 'Sách & Văn phòng phẩm', name: 'Sổ kế hoạch tuần', description: 'Sổ planner giúp theo dõi lịch trình, mục tiêu và công việc.', price: 109000, variant: 'Bố cục', image: img('photo-1517842645767-c639042777db') },
  { category: 'Mẹ & Bé', name: 'Chăn cotton mềm cho bé', description: 'Chăn cotton nhẹ nhàng, tiện dùng ở nhà hoặc khi đi ra ngoài.', price: 229000, variant: 'Kích cỡ', image: img('photo-1515488042361-ee00e0ddd4e4') },
  { category: 'Mẹ & Bé', name: 'Bình tập uống chống tràn', description: 'Bình tập uống dễ cầm nắm, nắp đóng kín tiện mang theo.', price: 159000, variant: 'Dung tích', image: img('photo-1515488042361-ee00e0ddd4e4') },
  { category: 'Mẹ & Bé', name: 'Túi treo xe đẩy đa năng', description: 'Túi chia ngăn tiện lưu trữ đồ dùng khi đưa bé ra ngoài.', price: 249000, variant: 'Màu sắc', image: img('photo-1515488042361-ee00e0ddd4e4') },
  { category: 'Mẹ & Bé', name: 'Đồ chơi xếp hình an toàn', description: 'Đồ chơi nhiều màu giúp bé khám phá hình khối và phối hợp tay mắt.', price: 189000, variant: 'Số chi tiết', image: img('photo-1599629954294-14df9ec8e8c7') },
  { category: 'Thú cưng', name: 'Dây dắt thú cưng phản quang', description: 'Dây dắt chắc chắn, có chi tiết phản quang khi đi dạo buổi tối.', price: 169000, variant: 'Kích cỡ', image: img('photo-1548199973-03cce0bbc87b') },
  { category: 'Thú cưng', name: 'Đồ chơi gặm bền cho chó', description: 'Đồ chơi dành cho thú cưng vận động và giải trí tại nhà.', price: 99000, variant: 'Kích cỡ', image: img('photo-1548199973-03cce0bbc87b') },
  { category: 'Thú cưng', name: 'Bát ăn chống trượt', description: 'Bát ăn dễ vệ sinh, đế chống trượt phù hợp sử dụng hằng ngày.', price: 139000, variant: 'Dung tích', image: img('photo-1548199973-03cce0bbc87b') },
  { category: 'Thú cưng', name: 'Đệm nằm êm cho mèo', description: 'Đệm mềm tạo chỗ nghỉ ngơi thoải mái cho thú cưng.', price: 299000, variant: 'Kích cỡ', image: img('photo-1548199973-03cce0bbc87b') },
  { category: 'Thực phẩm & Đồ uống', name: 'Cà phê rang xay nguyên chất', description: 'Cà phê rang xay thơm đậm, phù hợp pha phin hoặc máy.', price: 159000, variant: 'Khối lượng', image: img('photo-1445116572660-236099ec97a0') },
  { category: 'Thực phẩm & Đồ uống', name: 'Hạt dinh dưỡng tổng hợp', description: 'Hỗn hợp hạt dùng làm bữa ăn nhẹ hoặc thêm vào sữa chua.', price: 129000, variant: 'Khối lượng', image: img('photo-1505576399274-565b52d4ac71') },
  { category: 'Thực phẩm & Đồ uống', name: 'Mật ong hoa tự nhiên', description: 'Mật ong dùng pha đồ uống, làm bánh hoặc kết hợp bữa sáng.', price: 189000, variant: 'Dung tích', image: img('photo-1587049352846-4a222e784d38') },
  { category: 'Thực phẩm & Đồ uống', name: 'Granola ăn sáng giòn thơm', description: 'Granola tiện dùng cùng sữa, sữa chua hoặc trái cây.', price: 119000, variant: 'Khối lượng', image: img('photo-1517673132405-a56a62b18caf') },
];

type ProductRow = {
  productId: string; shopId: string; categoryId: string; name: string; description: string;
  imageUrl: string; variantName: string; skuBase: string; price: number; stock: number;
};
const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 2 });
const db = await pool.connect();

try {
  await db.query('BEGIN');
  const shopResult = await db.query<{ shop_id: string; shop_name: string; owner_id: string; email: string }>(
    `SELECT s.shop_id,s.shop_name,s.owner_id,u.email
     FROM shops s JOIN app_users u ON u.user_id=s.owner_id
     WHERE s.shop_name LIKE 'Dino Demo Shop %' AND u.email LIKE 'seller%@dino-demo.test'
     ORDER BY s.shop_name FOR UPDATE OF s`,
  );
  if (shopResult.rowCount !== 20) throw new Error(`Expected exactly 20 demo seller shops; found ${shopResult.rowCount ?? 0}`);

  const categoryIds = new Map<string, string>();
  for (const categoryName of [...new Set(templates.map(item => item.category))]) {
    const found = await db.query<{ category_id: string }>(
      'SELECT category_id FROM categories WHERE category_name=$1 ORDER BY created_at,category_id LIMIT 1 FOR UPDATE', [categoryName],
    );
    const categoryId = found.rows[0]?.category_id ?? randomUUID();
    if (!found.rows[0]) {
      await db.query(
        `INSERT INTO categories (category_id,parent_category_id,category_name,description,status,created_at,updated_at)
         VALUES ($1,NULL,$2,$3,'ACTIVE',now(),now())`,
        [categoryId, categoryName, `Danh mục demo cho bộ dữ liệu ${dataset}.`],
      );
    } else {
      await db.query("UPDATE categories SET status='ACTIVE',updated_at=now() WHERE category_id=$1", [categoryId]);
    }
    categoryIds.set(categoryName, categoryId);
  }

  const rows: ProductRow[] = [];
  shopResult.rows.forEach((shop, shopIndex) => {
    for (let offset = 0; offset < 12; offset++) {
      const templateIndex = (shopIndex * 7 + offset * 3) % templates.length;
      const template = templates[templateIndex];
      const shopNo = shopIndex + 1;
      const productNo = offset + 1;
      const code = `S${String(shopNo).padStart(2, '0')}P${String(productNo).padStart(2, '0')}`;
      const factor = 0.92 + (shopNo % 6) * 0.035;
      const price = Math.round((template.price * factor) / 1000) * 1000;
      rows.push({
        productId: uuidv5(`${dataset}:${code}`, uuidNamespace),
        shopId: shop.shop_id,
        categoryId: categoryIds.get(template.category)!,
        name: `${template.name} - Shop ${String(shopNo).padStart(2, '0')}`,
        description: `${template.description} Bộ sưu tập ${dataset}.`,
        imageUrl: template.image,
        variantName: template.variant,
        skuBase: `DDEMO-${code}`,
        price,
        stock: 25 + ((shopNo * 17 + productNo * 11) % 180),
      });
    }
  });

  const productParams: unknown[] = [];
  const productValues = rows.map((row, index) => {
    const start = index * 6;
    productParams.push(row.productId, row.shopId, row.categoryId, row.name, row.description, 'ACTIVE');
    return `($${start + 1}::uuid,$${start + 2}::uuid,$${start + 3}::uuid,$${start + 4}::text,$${start + 5}::text,$${start + 6}::text,now(),now())`;
  });
  await db.query(
    `INSERT INTO products (product_id,shop_id,category_id,product_name,description,status,created_at,updated_at)
     VALUES ${productValues.join(',')}
     ON CONFLICT (product_id) DO UPDATE SET category_id=EXCLUDED.category_id,product_name=EXCLUDED.product_name,
       description=EXCLUDED.description,status='ACTIVE',updated_at=now()`, productParams,
  );

  const variantParams: unknown[] = [];
  const variantValues: string[] = [];
  const imageParams: unknown[] = [];
  const imageValues: string[] = [];
  for (const row of rows) {
    for (const [variantIndex, value] of ['Tiêu chuẩn', 'Cao cấp'].entries()) {
      const variantId = uuidv5(`${dataset}:${row.skuBase}:V${variantIndex + 1}`, uuidNamespace);
      const start = variantParams.length;
      const price = Math.round((row.price * (variantIndex === 0 ? 1 : 1.22)) / 1000) * 1000;
      variantParams.push(variantId, row.productId, row.variantName, value, `${row.skuBase}-V${variantIndex + 1}`, price, row.stock + variantIndex * 20, 'ACTIVE');
      variantValues.push(`($${start + 1}::uuid,$${start + 2}::uuid,$${start + 3}::text,$${start + 4}::text,$${start + 5}::text,$${start + 6}::numeric,$${start + 7}::int,$${start + 8}::text,now(),now())`);
    }
    const imageId = uuidv5(`${dataset}:${row.productId}:image:1`, uuidNamespace);
    const start = imageParams.length;
    imageParams.push(imageId, row.productId, row.imageUrl);
    imageValues.push(`($${start + 1}::uuid,$${start + 2}::uuid,$${start + 3}::text,0)`);
  }
  await db.query(
    `INSERT INTO product_variants (variant_id,product_id,variant_name,variant_value,sku,price,stock_quantity,status,created_at,updated_at)
     VALUES ${variantValues.join(',')}
     ON CONFLICT (variant_id) DO UPDATE SET variant_name=EXCLUDED.variant_name,variant_value=EXCLUDED.variant_value,
       sku=EXCLUDED.sku,price=EXCLUDED.price,stock_quantity=EXCLUDED.stock_quantity,status='ACTIVE',updated_at=now()`, variantParams,
  );
  await db.query(
    `INSERT INTO product_images (image_id,product_id,image_url,sort_order) VALUES ${imageValues.join(',')}
     ON CONFLICT (image_id) DO UPDATE SET image_url=EXCLUDED.image_url,sort_order=0`, imageParams,
  );

  const verification = await db.query<{ products: number; variants: number; images: number; pending_shops: number }>(
    `SELECT count(DISTINCT p.product_id)::int AS products,
       count(DISTINCT v.variant_id)::int AS variants,
       count(DISTINCT pi.image_id)::int AS images,
       (SELECT count(*)::int FROM shops WHERE shop_id=ANY($1::uuid[]) AND status='PENDING') AS pending_shops
     FROM products p
     JOIN product_variants v ON v.product_id=p.product_id
     LEFT JOIN product_images pi ON pi.product_id=p.product_id
     WHERE p.description LIKE $2`,
    [rows.map(row => row.shopId), `%${dataset}%`],
  );
  const counts = verification.rows[0];
  if (counts.products !== 240 || counts.variants !== 480 || counts.images !== 240 || counts.pending_shops !== 20) {
    throw new Error(`Verification mismatch: ${JSON.stringify(counts)}`);
  }
  await db.query('COMMIT');
  console.log(JSON.stringify({ project_ref: projectRef, shops_pending: counts.pending_shops, products: counts.products, variants: counts.variants, images: counts.images, categories: categoryIds.size, product_status: 'ACTIVE' }, null, 2));
} catch (error) {
  await db.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  db.release();
  await pool.end();
}
